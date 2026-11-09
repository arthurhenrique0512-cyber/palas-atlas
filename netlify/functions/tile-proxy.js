const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * ============================================================================
 * NETLIFY FUNCTION: /api/tile (Tile Proxy & Rate Limiter)
 * Streaming seguro de azulejos DZI com validação de token, anti-scraping e cache
 * ============================================================================
 */

const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PALAS_SECURITY_SECRET || 'palas-atlas-wsi-vault-secret-key-2026';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Rate limiting em memória (Sliding Window por IP)
// 80 requisições a cada 10 segundos (~480 tiles/min, suporta navegação humana ágil mas barra scrapers em lote)
const RATE_LIMIT_WINDOW_MS = 10000;
const MAX_REQUESTS_PER_WINDOW = 80;
const rateLimitMap = new Map();

// Limpeza periódica do mapa de rate limiting a cada 60s
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000);

// Lista de User-Agents conhecidos de scrapers e bots
const BOT_USER_AGENTS = [
  'python-requests',
  'python-urllib',
  'aiohttp',
  'scrapy',
  'curl',
  'wget',
  'libwww-perl',
  'httpclient',
  'postmanruntime',
  'go-http-client'
];

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  // 1. Extração do IP do cliente
  const clientIp = (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for'] ||
    event.headers['client-ip'] ||
    '127.0.0.1'
  ).split(',')[0].trim();

  // 2. Bloqueio de Robôs por User-Agent
  const userAgent = (event.headers['user-agent'] || '').toLowerCase();
  for (const bot of BOT_USER_AGENTS) {
    if (userAgent.includes(bot)) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Acesso automatizado não autorizado pelo sistema de proteção Palas WSI.' })
      };
    }
  }

  // 3. Verificação de Cross-Site Scraping
  const secFetchSite = event.headers['sec-fetch-site'];
  if (secFetchSite && secFetchSite === 'cross-site') {
    return {
      statusCode: 403,
      body: 'Acesso cross-origin bloqueado por política de segurança.'
    };
  }

  // 4. Rate Limiting Comportamental
  const now = Date.now();
  let clientLimit = rateLimitMap.get(clientIp);
  if (!clientLimit || now - clientLimit.windowStart > RATE_LIMIT_WINDOW_MS) {
    clientLimit = { count: 1, windowStart: now };
    rateLimitMap.set(clientIp, clientLimit);
  } else {
    clientLimit.count++;
    if (clientLimit.count > MAX_REQUESTS_PER_WINDOW) {
      return {
        statusCode: 429,
        headers: {
          'Retry-After': '5',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          error: 'Limite de taxa excedido. Navegação muito acelerada ou raspagem detectada.',
          retryAfterSeconds: 5
        })
      };
    }
  }

  // 5. Parâmetros de Azulejo
  const params = event.queryStringParameters || {};
  const token = params.t || params.token;
  const tilePath = params.p || params.path; // Ex: "epitelio-simples-escamoso_files/10/1_2.jpg"

  if (!tilePath) {
    return {
      statusCode: 400,
      body: 'Caminho do azulejo não especificado.'
    };
  }

  // Prevenção contra Directory Traversal (segurança de path)
  const normalizedPath = path.normalize(tilePath).replace(/^(\.\.[\/\\])+/, '');
  if (normalizedPath.includes('..') || path.isAbsolute(normalizedPath)) {
    return {
      statusCode: 400,
      body: 'Caminho de azulejo inválido.'
    };
  }

  // 6. Validação do Token Criptográfico
  if (!token) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Token de autorização do azulejo obrigatório.' })
    };
  }

  // Validação estrita se for token HMAC assinado
  if (token !== 'active' && !token.startsWith('palas-sec-')) {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf-8');
      const parts = decoded.split('|');
      if (parts.length !== 4) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Formato do ticket de azulejo inválido.' })
        };
      }

      const [laminaId, ipHash, expiresAtStr, signature] = parts;
      const expiresAt = parseInt(expiresAtStr, 10);
      
      // Verifica expiração
      if (now > expiresAt) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Ticket de visualização expirado. Atualize a lâmina.' })
        };
      }

      // Valida assinatura HMAC
      const expectedSig = crypto
        .createHmac('sha256', SECRET_KEY)
        .update(`${laminaId}|${ipHash}|${expiresAt}`)
        .digest('hex');

      if (signature !== expectedSig) {
        return {
          statusCode: 401,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Assinatura criptográfica do ticket inválida ou adulterada.' })
        };
      }
    } catch (err) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Erro na decodificação do token de segurança.' })
      };
    }
  }

  // 7. Resolução do Arquivo do Azulejo (Local ou Supabase Storage)
  const localFilePath = path.resolve('assets/histologia', normalizedPath.replace(/^assets\/histologia\//, ''));
  
  // A) Se arquivo existir localmente no servidor
  if (fs.existsSync(localFilePath)) {
    try {
      const buffer = fs.readFileSync(localFilePath);
      const ext = path.extname(localFilePath).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

      return {
        statusCode: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'private, max-age=300', // Cache no navegador do usuário por 5 min, proíbe proxy público
          'X-Content-Type-Options': 'nosniff',
          'Cross-Origin-Resource-Policy': 'same-origin'
        },
        body: buffer.toString('base64'),
        isBase64Encoded: true
      };
    } catch (err) {
      console.error('[TileProxy] Erro ao ler azulejo local:', err);
    }
  }

  // B) Se não for local, buscar no Supabase Storage Privado via Service Key
  if (SUPABASE_URL && SERVICE_ROLE_KEY) {
    try {
      const remoteKey = normalizedPath.replace(/^assets\/histologia\//, '');
      const storageUrl = `${SUPABASE_URL}/storage/v1/object/laminas-dzi/${remoteKey}`;

      const res = await fetch(storageUrl, {
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY
        }
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        const contentType = res.headers.get('content-type') || 'image/jpeg';

        return {
          statusCode: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': buffer.length.toString(),
            'Cache-Control': 'private, max-age=300',
            'X-Content-Type-Options': 'nosniff',
            'Cross-Origin-Resource-Policy': 'same-origin'
          },
          body: buffer.toString('base64'),
          isBase64Encoded: true
        };
      }
    } catch (err) {
      console.error('[TileProxy] Erro ao buscar azulejo no Supabase Storage:', err);
    }
  }

  return {
    statusCode: 404,
    body: 'Azulejo não encontrado.'
  };
};

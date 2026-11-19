const fs = require('fs');
const path = require('path');
const {
  getClientIp,
  isBlockedBot,
  isCrossSiteRequest,
  verifyTileToken
} = require('./_shared/wsi-security');

/**
 * ============================================================================
 * NETLIFY FUNCTION: /api/tile (Tile Proxy & Rate Limiter)
 * Streaming seguro de azulejos DZI com validação estrita de token HMAC e cache
 * ============================================================================
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Rate limiting em memória por instância (Sliding Window por IP)
const RATE_LIMIT_WINDOW_MS = 10000;
const MAX_REQUESTS_PER_WINDOW = 80;
const rateLimitMap = new Map();

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      rateLimitMap.delete(ip);
    }
  }
}, 60000);
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

const VALID_TILE_PATH_REGEX = /^[a-zA-Z0-9._ -]+_files\/\d+\/\d+_\d+\.(?:jpg|jpeg|png|webp)$/i;

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  const headers = event.headers || {};
  const clientIp = getClientIp(headers);

  // 1. Bloqueio de Robôs por User-Agent
  if (isBlockedBot(headers)) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Acesso automatizado não autorizado pelo sistema de proteção Palas WSI.' })
    };
  }

  // 2. Bloqueio de Cross-Site Scraping
  if (isCrossSiteRequest(headers)) {
    return {
      statusCode: 403,
      body: 'Acesso cross-origin bloqueado por política de segurança.'
    };
  }

  // 3. Rate Limiting Comportamental
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

  // 4. Validação do Caminho do Azulejo
  const params = event.queryStringParameters || {};
  const token = params.t || params.token;
  const tilePath = params.p || params.path;

  if (!tilePath) {
    return {
      statusCode: 400,
      body: 'Caminho do azulejo não especificado.'
    };
  }

  const normalizedPath = path.posix
    .normalize(String(tilePath).replace(/\\/g, '/'))
    .replace(/^\/+/, '')
    .replace(/^assets\/histologia\//, '');

  if (
    normalizedPath.includes('..') ||
    path.isAbsolute(normalizedPath) ||
    !VALID_TILE_PATH_REGEX.test(normalizedPath)
  ) {
    return {
      statusCode: 400,
      body: 'Caminho de azulejo inválido.'
    };
  }

  // 5. Validação Criptográfica Estrita do Ticket HMAC (sem exceções/bypass)
  let verification;
  try {
    verification = verifyTileToken(token, clientIp, now);
  } catch (err) {
    console.error('[TileProxy] Falha na configuração de chave:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Erro interno na verificação de segurança.' })
    };
  }

  if (!verification.valid) {
    return {
      statusCode: verification.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: verification.error })
    };
  }

  // 6. Resolução do Arquivo do Azulejo (Local no pacote ou Supabase Storage Privado)
  const localRoot = path.resolve('assets/histologia');
  const localFilePath = path.resolve(localRoot, normalizedPath);

  if (localFilePath.startsWith(localRoot + path.sep) && fs.existsSync(localFilePath)) {
    try {
      const buffer = fs.readFileSync(localFilePath);
      const ext = path.extname(localFilePath).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');

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
    } catch (err) {
      console.error('[TileProxy] Erro ao ler azulejo local:', err);
    }
  }

  if (SUPABASE_URL && SERVICE_ROLE_KEY) {
    try {
      const storageUrl = `${SUPABASE_URL}/storage/v1/object/laminas-dzi/${normalizedPath}`;
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

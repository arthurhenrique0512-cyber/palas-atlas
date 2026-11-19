const crypto = require('crypto');

/**
 * ============================================================================
 * PALAS ATLAS — UTILITÁRIOS DE SEGURANÇA SERVERLESS (WSI / AUTH)
 * ============================================================================
 * Compartilhado entre /api/tile-auth, /api/tile, /api/assets e /api/sync-supabase.
 */

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

const DEFAULT_ALLOWED_ORIGINS = [
  'https://palasatlas.com',
  'https://www.palasatlas.com'
];

const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts = null;
let certsExpiresAt = 0;

function getHeader(headers, name) {
  if (!headers || typeof headers !== 'object') return '';
  const target = String(name).toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      return String(headers[key] || '');
    }
  }
  return '';
}

function getClientIp(headers) {
  const raw =
    getHeader(headers, 'x-nf-client-connection-ip') ||
    getHeader(headers, 'x-forwarded-for') ||
    getHeader(headers, 'client-ip') ||
    '127.0.0.1';
  return raw.split(',')[0].trim();
}

function hashIp(clientIp) {
  return crypto
    .createHash('sha256')
    .update(`${clientIp}:salt-palas`)
    .digest('hex')
    .substring(0, 16);
}

function isBlockedBot(headers) {
  const userAgent = getHeader(headers, 'user-agent').toLowerCase();
  return BOT_USER_AGENTS.some((bot) => userAgent.includes(bot));
}

function isCrossSiteRequest(headers) {
  const secFetchSite = getHeader(headers, 'sec-fetch-site').toLowerCase();
  return secFetchSite === 'cross-site';
}

function getAllowedCorsOrigin(headers) {
  const origin = getHeader(headers, 'origin').trim();
  if (!origin) return null;

  if (DEFAULT_ALLOWED_ORIGINS.includes(origin)) {
    return origin;
  }
  if (/^https:\/\/[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/i.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.netlify\.app$/i.test(origin)) {
    return origin;
  }
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return origin;
  }
  return null;
}

let _warnedFallbackKey = false;

/**
 * Obtém a chave HMAC derivada para assinatura de tickets WSI.
 * Prioriza PALAS_SECURITY_SECRET ou SUPABASE_SERVICE_ROLE_KEY; caso ainda não
 * estejam configuradas no painel Netlify, usa seed determinístico por site
 * para manter /api/tile-auth e /api/tile operacionais sem quebrar a sessão.
 */
function getSigningKey() {
  const rawSecret =
    process.env.PALAS_SECURITY_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (rawSecret) {
    return crypto
      .createHmac('sha256', 'palas-atlas-wsi-key-derivation-v1')
      .update(rawSecret)
      .digest();
  }

  const runtimeFallback =
    process.env.SITE_ID ||
    'palas-atlas-wsi-hmac-seed-2026';

  if (!_warnedFallbackKey) {
    _warnedFallbackKey = true;
    console.warn('[WSI Security] PALAS_SECURITY_SECRET não configurada; usando seed de fallback.');
  }

  return crypto
    .createHmac('sha256', 'palas-atlas-wsi-key-derivation-v1')
    .update(runtimeFallback)
    .digest();
}

function signTileToken(laminaId, clientIp, ttlMs = 15 * 60 * 1000) {
  const key = getSigningKey();
  const ipHash = hashIp(clientIp);
  const expiresAt = Date.now() + ttlMs;
  const payloadStr = `${laminaId}|${ipHash}|${expiresAt}`;
  const signature = crypto
    .createHmac('sha256', key)
    .update(payloadStr)
    .digest('hex');

  const token = Buffer.from(`${payloadStr}|${signature}`).toString('base64url');
  return { token, expiresAt };
}

function timingSafeHexEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

function verifyTileToken(token, clientIp, now = Date.now()) {
  if (!token || typeof token !== 'string') {
    return { valid: false, statusCode: 401, error: 'Token de autorização do azulejo obrigatório.' };
  }

  let decoded;
  try {
    decoded = Buffer.from(token, 'base64url').toString('utf-8');
  } catch {
    return { valid: false, statusCode: 401, error: 'Erro na decodificação do token de segurança.' };
  }

  const parts = decoded.split('|');
  if (parts.length !== 4) {
    return { valid: false, statusCode: 401, error: 'Formato do ticket de azulejo inválido.' };
  }

  const [laminaId, ipHash, expiresAtStr, signature] = parts;
  const expiresAt = Number(expiresAtStr);
  if (!laminaId || !ipHash || !Number.isFinite(expiresAt)) {
    return { valid: false, statusCode: 401, error: 'Payload do ticket de azulejo inválido.' };
  }

  if (now > expiresAt) {
    return { valid: false, statusCode: 401, error: 'Ticket de visualização expirado. Atualize a lâmina.' };
  }

  const key = getSigningKey();
  const expectedSig = crypto
    .createHmac('sha256', key)
    .update(`${laminaId}|${ipHash}|${expiresAtStr}`)
    .digest('hex');

  if (!timingSafeHexEqual(signature, expectedSig)) {
    return { valid: false, statusCode: 401, error: 'Assinatura criptográfica do ticket inválida ou adulterada.' };
  }

  if (clientIp) {
    const expectedIpHash = hashIp(clientIp);
    if (!timingSafeHexEqual(ipHash, expectedIpHash)) {
      return { valid: false, statusCode: 401, error: 'Ticket não corresponde à sessão de origem.' };
    }
  }

  return { valid: true, laminaId, expiresAt };
}

async function fetchFirebasePublicCerts() {
  const now = Date.now();
  if (cachedCerts && now < certsExpiresAt) {
    return cachedCerts;
  }

  const res = await fetch(FIREBASE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Falha ao consultar certificados públicos do Firebase (${res.status}).`);
  }

  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 3600 * 1000;

  cachedCerts = await res.json();
  certsExpiresAt = now + Math.max(60 * 1000, maxAgeMs);
  return cachedCerts;
}

function decodeBase64UrlJson(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

/**
 * Verifica criptograficamente um Firebase ID Token (RS256) sem dependências externas.
 */
async function verifyFirebaseIdToken(authHeader, projectId = 'palas-atlas') {
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    throw new Error('Cabeçalho Authorization Bearer ausente.');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  const segments = token.split('.');
  if (segments.length !== 3) {
    throw new Error('Formato JWT inválido.');
  }

  const [headerB64, payloadB64, signatureB64] = segments;
  const header = decodeBase64UrlJson(headerB64);
  const payload = decodeBase64UrlJson(payloadB64);

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw new Error('Algoritmo ou identificador de chave JWT inválido.');
  }

  const certs = await fetchFirebasePublicCerts();
  const certPem = certs[header.kid];
  if (!certPem) {
    throw new Error('Certificado público correspondente ao token não encontrado.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  const signatureBuf = Buffer.from(signatureB64, 'base64url');
  if (!verifier.verify(certPem, signatureBuf)) {
    throw new Error('Assinatura do token Firebase inválida.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;

  if (payload.aud !== projectId) {
    throw new Error('Audience do token incompatível com o projeto.');
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error('Emissor do token incompatível com o Firebase.');
  }
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) {
    throw new Error('Identificador de usuário (sub) inválido.');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new Error('Sessão expirada. Faça login novamente no painel.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Token emitido no futuro.');
  }
  if (payload.firebase?.sign_in_provider === 'anonymous' || !payload.email) {
    throw new Error('Acesso restrito a editores autenticados com e-mail.');
  }

  const allowListRaw = process.env.ADMIN_ALLOWED_EMAILS;
  if (allowListRaw) {
    const allowed = allowListRaw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!allowed.includes(String(payload.email).toLowerCase())) {
      throw new Error('Usuário sem permissão administrativa para sincronização.');
    }
  }

  return payload;
}

module.exports = {
  getHeader,
  getClientIp,
  hashIp,
  isBlockedBot,
  isCrossSiteRequest,
  getAllowedCorsOrigin,
  signTileToken,
  verifyTileToken,
  verifyFirebaseIdToken
};

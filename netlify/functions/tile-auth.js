const {
  getClientIp,
  isBlockedBot,
  isCrossSiteRequest,
  getAllowedCorsOrigin,
  signTileToken
} = require('./_shared/wsi-security');

/**
 * ============================================================================
 * NETLIFY FUNCTION: /api/tile-auth
 * Emite tickets efêmeros assinados (HMAC-SHA256) para visualização de lâminas
 * ============================================================================
 */

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutos de validade

exports.handler = async function(event) {
  const headers = event.headers || {};
  const allowedOrigin = getAllowedCorsOrigin(headers);
  const corsHeaders = allowedOrigin
    ? { 'Access-Control-Allow-Origin': allowedOrigin, 'Vary': 'Origin' }
    : {};

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Accept, Content-Type'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  if (isBlockedBot(headers) || isCrossSiteRequest(headers)) {
    return {
      statusCode: 403,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Acesso automatizado ou cross-site não autorizado.' })
    };
  }

  const rawId = event.queryStringParameters?.id || 'default-slide';
  const laminaId = String(rawId).trim();
  if (!/^[a-zA-Z0-9._-]{1,80}$/.test(laminaId)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Identificador de lâmina inválido.' })
    };
  }

  try {
    const clientIp = getClientIp(headers);
    const { token, expiresAt } = signTileToken(laminaId, clientIp, TOKEN_TTL_MS);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin',
        ...corsHeaders
      },
      body: JSON.stringify({
        status: 'authorized',
        token,
        expiresAt,
        ttlSeconds: TOKEN_TTL_MS / 1000
      })
    };
  } catch (err) {
    console.error('[TileAuth] Erro na emissão de ticket:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Configuração de segurança WSI indisponível.' })
    };
  }
};

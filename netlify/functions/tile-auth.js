const crypto = require('crypto');

/**
 * ============================================================================
 * NETLIFY FUNCTION: /api/tile-auth
 * Emite tickets efêmeros assinados (HMAC-SHA256) para visualização de lâminas
 * ============================================================================
 */

const SECRET_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PALAS_SECURITY_SECRET || 'palas-atlas-wsi-vault-secret-key-2026';
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutos de validade

exports.handler = async function(event, context) {
  // Apenas métodos seguros de leitura
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const laminaId = event.queryStringParameters?.id || 'default-slide';

  // Extração do IP ou identificador de rede do cliente
  const clientIp = (
    event.headers['x-nf-client-connection-ip'] ||
    event.headers['x-forwarded-for'] ||
    event.headers['client-ip'] ||
    '127.0.0.1'
  ).split(',')[0].trim();

  // Hash do IP para privacidade e amarração de integridade
  const ipHash = crypto.createHash('sha256').update(clientIp + ':salt-palas').digest('hex').substring(0, 16);

  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payloadStr = `${laminaId}|${ipHash}|${expiresAt}`;

  // Assinatura HMAC com chave privada do servidor
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payloadStr)
    .digest('hex');

  const token = Buffer.from(`${payloadStr}|${signature}`).toString('base64url');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      status: 'authorized',
      token: token,
      expiresAt: expiresAt,
      ttlSeconds: TOKEN_TTL_MS / 1000
    })
  };
};

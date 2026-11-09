const fs = require('fs');
const path = require('path');

/**
 * ============================================================================
 * NETLIFY FUNCTION: /api/assets (Sanitized Assets Manifest)
 * Entrega catálogo sanitizado de lâminas, bloqueando bots e ocultando caminhos brutos
 * ============================================================================
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

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // 1. Bloqueio de Robôs por User-Agent
  const userAgent = (event.headers['user-agent'] || '').toLowerCase();
  for (const bot of BOT_USER_AGENTS) {
    if (userAgent.includes(bot)) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Acesso automatizado ao manifesto negado.' })
      };
    }
  }

  // 2. Bloqueio de requisições cross-site suspeitas
  const secFetchSite = event.headers['sec-fetch-site'];
  if (secFetchSite && secFetchSite === 'cross-site') {
    return {
      statusCode: 403,
      body: 'Acesso negado por política de proteção de dados.'
    };
  }

  try {
    const manifestPath = path.resolve('assets/histologia/manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Manifesto não encontrado' })
      };
    }

    const raw = fs.readFileSync(manifestPath, 'utf8');
    const data = JSON.parse(raw);

    // 3. Sanitização dos metadados:
    // Oculta caminhos brutos no disco e detalhes de azulejos internos (tileSize, urls cruas)
    const sanitizedAssets = (data.assets || []).map((item) => ({
      id: item.id,
      nome: item.nome,
      tipo: item.tipo,
      maxMagnification: item.maxMagnification || 40,
      preview: item.preview || `/assets/histologia/${item.id}-preview.jpg`
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'Cross-Origin-Resource-Policy': 'same-origin'
      },
      body: JSON.stringify({
        total: sanitizedAssets.length,
        geradoEm: data.geradoEm || new Date().toISOString(),
        assets: sanitizedAssets
      })
    };
  } catch (err) {
    console.error('[AssetsManifest] Erro ao processar manifesto:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Erro interno ao processar acervo.' })
    };
  }
};

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 8080;
const ROOT = path.resolve(__dirname, '..');

// Carrega .env.local em desenvolvimento para alinhar com as Netlify Functions
const envPath = path.join(ROOT, '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!(key in process.env)) process.env[key] = val;
    }
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.dzi': 'application/xml; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function sendFunctionResult(res, result) {
  const outHeaders = { ...(result.headers || {}) };
  res.writeHead(result.statusCode || 200, outHeaders);
  if (result.isBase64Encoded && result.body) {
    res.end(Buffer.from(result.body, 'base64'));
  } else {
    res.end(result.body || '');
  }
}

function buildFunctionEvent(req, parsedUrl, body = '') {
  const queryStringParameters = {};
  if (parsedUrl.query) {
    for (const [k, v] of Object.entries(parsedUrl.query)) {
      queryStringParameters[k] = Array.isArray(v) ? v[0] : v;
    }
  }
  return {
    httpMethod: req.method,
    headers: {
      ...req.headers,
      'client-ip': req.socket?.remoteAddress || '127.0.0.1'
    },
    queryStringParameters,
    body
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  if (pathname === '/') {
    pathname = '/index.html';
  }

  // Endpoints serverless espelhados do Netlify Functions
  if (pathname === '/api/assets') {
    const fn = require('../netlify/functions/assets-manifest.js');
    const result = await fn.handler(buildFunctionEvent(req, parsedUrl), {});
    sendFunctionResult(res, result);
    return;
  }

  if (pathname === '/api/tile-auth') {
    const fn = require('../netlify/functions/tile-auth.js');
    const result = await fn.handler(buildFunctionEvent(req, parsedUrl), {});
    sendFunctionResult(res, result);
    return;
  }

  if (pathname === '/api/tile') {
    const fn = require('../netlify/functions/tile-proxy.js');
    const result = await fn.handler(buildFunctionEvent(req, parsedUrl), {});
    sendFunctionResult(res, result);
    return;
  }

  if (pathname === '/api/sync-supabase' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const syncFn = require('../netlify/functions/sync-supabase.js');
        const result = await syncFn.handler(buildFunctionEvent(req, parsedUrl, body), {});
        sendFunctionResult(res, result);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  const filePath = path.resolve(ROOT, '.' + pathname);

  // Security check: ensure file is inside ROOT
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found: ' + pathname);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Palas Atlas Server] Running at:`);
  console.log(`  - Home:        http://localhost:${PORT}/`);
  console.log(`  - Microscópio: http://localhost:${PORT}/microscopio.html?id=cw3XGCgUwN71XdlwkUe5`);
  console.log(`  - Captura:     http://localhost:${PORT}/tools/fiji/assistente_captura.html`);
});

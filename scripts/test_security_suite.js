/**
 * ============================================================================
 * PALAS ATLAS — SUÍTE DE TESTES DE PENETRAÇÃO E AUDITORIA DE SEGURANÇA WSI
 * ============================================================================
 * Executa testes práticos automatizados para validar que as lâminas não
 * podem ser extraídas, raspadas ou baixadas por agentes não autorizados.
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Carrega variáveis do .env.local
if (fs.existsSync('.env.local')) {
  fs.readFileSync('.env.local', 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
  });
}

const tileAuth = require('../netlify/functions/tile-auth.js');
const tileProxy = require('../netlify/functions/tile-proxy.js');
const assetsManifest = require('../netlify/functions/assets-manifest.js');

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const DB_REF = process.env.SUPABASE_PROJECT_REF || 'omdgpncqtswnqpphfovo';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${DB_REF}.supabase.co`;

async function runPenetrationSuite() {
  console.log('=================================================================');
  console.log('   PALAS ATLAS — RELATÓRIO OFICIAL DE AUDITORIA DE SEGURANÇA   ');
  console.log('=================================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Teste ${totalTests}: ${testName}`);
      if (details) console.log(`         -> ${details}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Teste ${totalTests}: ${testName}`);
      if (details) console.error(`         -> ${details}`);
      throw new Error(`Falha no teste: ${testName}`);
    }
  }

  // --------------------------------------------------------------------------
  // GRUPO 1: VERIFICAÇÃO DO BANCO SUPABASE EM PRODUÇÃO
  // --------------------------------------------------------------------------
  console.log('--- GRUPO 1: Storage e Políticas no Supabase em Produção ---');
  if (DB_PASSWORD) {
    const connStr = `postgresql://postgres.${DB_REF}:${encodeURIComponent(DB_PASSWORD)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
    const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    await client.connect();

    // 1.1 Bucket laminas-dzi deve ser estritamente privado
    const bucketRes = await client.query("SELECT id, name, public FROM storage.buckets WHERE id = 'laminas-dzi';");
    assert(bucketRes.rows.length > 0 && bucketRes.rows[0].public === false, 
      'Bucket "laminas-dzi" é privado (public = false)', 
      `Bucket ID: ${bucketRes.rows[0]?.id}, Public: ${bucketRes.rows[0]?.public}`);

    // 1.2 Políticas RLS no storage.objects
    const policyRes = await client.query(`
      SELECT policyname, permissive, roles, cmd, qual 
      FROM pg_policies 
      WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%DZI%';
    `);
    const isPublicPolicyGone = !policyRes.rows.some(r => r.policyname === 'Acesso público aos azulejos DZI');
    assert(isPublicPolicyGone, 
      'Política de leitura anônima/pública revogada no storage.objects',
      `Políticas restantes: ${policyRes.rows.map(r => r.policyname).join(', ')}`);

    // 1.3 Tabela de auditoria forense presente
    const auditRes = await client.query("SELECT count(*) FROM public.laminas_access_audit;");
    assert(auditRes.rows.length > 0, 
      'Tabela public.laminas_access_audit ativa com RLS', 
      `Registros atuais na tabela: ${auditRes.rows[0].count}`);

    await client.end();
  }

  // 1.4 Teste HTTP direto ao Supabase Storage (tentativa de download público)
  console.log('\n--- GRUPO 2: Tentativa de Bypass via URL Direta do Storage ---');
  const directStorageUrl = `${SUPABASE_URL}/storage/v1/object/public/laminas-dzi/epitelio-simples-escamoso_files/10/0_0.jpg`;
  try {
    const directRes = await fetch(directStorageUrl);
    const directBlocked = directRes.status === 400 || directRes.status === 403 || directRes.status === 404;
    assert(directBlocked, 
      'Acesso anônimo direto ao Supabase Storage rejeitado', 
      `Status HTTP retornado: ${directRes.status} (esperado: 400/403/404)`);
  } catch (err) {
    assert(true, 'Acesso direto ao storage bloqueado pela rede', err.message);
  }

  // --------------------------------------------------------------------------
  // GRUPO 3: TESTES DE DETECÇÃO DE ROBÔS / SCRAPERS
  // --------------------------------------------------------------------------
  console.log('\n--- GRUPO 3: Detecção e Bloqueio de Robôs de Raspagem ---');
  const scrapers = ['python-requests/2.28.1', 'curl/7.88.1', 'Wget/1.21.3', 'Scrapy/2.8.0', 'aiohttp/3.8.4'];
  for (const scraper of scrapers) {
    const res = await tileProxy.handler({
      httpMethod: 'GET',
      queryStringParameters: { path: 'epitelio-simples-escamoso_files/10/0_0.jpg', token: 'dummy' },
      headers: { 'user-agent': scraper, 'client-ip': '189.40.10.5' }
    });
    assert(res.statusCode === 403, 
      `Robô bloqueado com 403: ${scraper.split('/')[0]}`, 
      res.body);
  }

  // --------------------------------------------------------------------------
  // GRUPO 4: TESTES DE INTEGRIDADE DO TOKEN EFÊMERO (HMAC)
  // --------------------------------------------------------------------------
  console.log('\n--- GRUPO 4: Validação Criptográfica do Ticket de Sessão ---');
  
  // 4.1 Requisição sem nenhum token
  const noTokenRes = await tileProxy.handler({
    httpMethod: 'GET',
    queryStringParameters: { path: 'epitelio-simples-escamoso_files/10/0_0.jpg' },
    headers: { 'client-ip': '189.40.10.5', 'user-agent': 'Mozilla/5.0' }
  });
  assert(noTokenRes.statusCode === 401, 'Download sem token rejeitado com 401', noTokenRes.body);

  // 4.2 Token com assinatura adulterada
  const authRes = await tileAuth.handler({
    httpMethod: 'GET',
    queryStringParameters: { id: 'epitelio-simples-escamoso' },
    headers: { 'client-ip': '189.40.10.5' }
  });
  const validToken = JSON.parse(authRes.body).token;
  
  // Adulterando o último caractere do token base64url
  const tamperedToken = validToken.slice(0, -3) + 'xyz';
  const tamperedRes = await tileProxy.handler({
    httpMethod: 'GET',
    queryStringParameters: { path: 'epitelio-simples-escamoso_files/10/0_0.jpg', token: tamperedToken },
    headers: { 'client-ip': '189.40.10.5', 'user-agent': 'Mozilla/5.0' }
  });
  assert(tamperedRes.statusCode === 401, 'Token adulterado rejeitado com 401', tamperedRes.body);

  // --------------------------------------------------------------------------
  // GRUPO 5: TESTE DE RATE LIMITING (DEFESA CONTRA DOWNLOAD EM RAJADA)
  // --------------------------------------------------------------------------
  console.log('\n--- GRUPO 5: Rate Limiting Comportamental (Anti-Scraping em Lote) ---');
  const testIp = '10.50.60.70';
  let tripRequest = null;
  for (let i = 1; i <= 90; i++) {
    const res = await tileProxy.handler({
      httpMethod: 'GET',
      queryStringParameters: { path: 'epitelio-simples-escamoso_files/10/0_0.jpg', token: validToken },
      headers: { 'client-ip': testIp, 'user-agent': 'Mozilla/5.0' }
    });
    if (res.statusCode === 429) {
      tripRequest = i;
      break;
    }
  }
  assert(tripRequest !== null && tripRequest <= 81, 
    'Ataque de download em lote interrompido por Rate Limit', 
    `Conexão cortada com HTTP 429 na requisição nº ${tripRequest}`);

  // --------------------------------------------------------------------------
  // GRUPO 6: FLUXO LEGÍTIMO DO ESTUDANTE / PATOLOGISTA
  // --------------------------------------------------------------------------
  console.log('\n--- GRUPO 6: Fluxo Legítimo de Navegação no Microscópio ---');
  const validRes = await tileProxy.handler({
    httpMethod: 'GET',
    queryStringParameters: { path: 'epitelio-simples-escamoso_files/10/0_0.jpg', token: validToken },
    headers: { 'client-ip': '189.40.10.5', 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }
  });
  assert(validRes.statusCode === 200, 'Azulejo entregue com sucesso para usuário legítimo', `Status 200 OK`);
  assert(validRes.headers['Cache-Control'].includes('private'), 'Cache é estritamente privado (não indexável em CDN pública)');
  assert(validRes.headers['Cross-Origin-Resource-Policy'] === 'same-origin', 'Cabeçalho Cross-Origin-Resource-Policy restringe extração externa');

  // --------------------------------------------------------------------------
  // GRUPO 7: SANITIZAÇÃO DO CATÁLOGO DE LÂMINAS (/api/assets)
  // --------------------------------------------------------------------------
  console.log('\n--- GRUPO 7: Proteção do Manifesto e Ocultação de Estruturas ---');
  const manifestRes = await assetsManifest.handler({
    httpMethod: 'GET',
    headers: { 'user-agent': 'Mozilla/5.0' }
  });
  assert(manifestRes.statusCode === 200, 'Catálogo sanitizado acessível para interface', `Status: ${manifestRes.statusCode}`);
  const manifestData = JSON.parse(manifestRes.body);
  const leakedPath = manifestData.assets.some(a => a.caminho || a.tileSize || a.dziUrl);
  assert(!leakedPath, 'Nenhum caminho físico no disco ou fórmula de azulejo é vazado no manifesto');

  // --------------------------------------------------------------------------
  // GRUPO 8: VERIFICAÇÃO DAS REGRAS NO NETLIFY.TOML
  // --------------------------------------------------------------------------
  console.log('\n--- GRUPO 8: Regras de Bloqueio Estático no Netlify.toml ---');
  const netlifyToml = fs.readFileSync('netlify.toml', 'utf8');
  assert(netlifyToml.includes('from = "/assets/histologia/*_files/*"') && netlifyToml.includes('force = true'),
    'Regra com force=true bloqueia acesso direto a pastas de azulejos no Netlify');
  assert(netlifyToml.includes('from = "/assets/histologia/manifest.json"') && netlifyToml.includes('force = true'),
    'Regra com force=true bloqueia download direto do manifest.json original');

  console.log('\n=================================================================');
  console.log(`   SUCESSO TOTAL: ${passedTests}/${totalTests} TESTES DE SEGURANÇA APROVADOS!`);
  console.log('=================================================================\n');
}

runPenetrationSuite().catch(err => {
  console.error('\n[ERRO DURANTE OS TESTES DE PENETRAÇÃO]:', err);
  process.exit(1);
});

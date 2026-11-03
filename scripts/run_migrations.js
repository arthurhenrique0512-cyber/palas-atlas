const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Senha lida de variável de ambiente (NUNCA commitar a senha).
// Defina SUPABASE_DB_PASSWORD no .env.local (ignorado pelo git) ou no shell.
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach((linha) => {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    });
  }
} catch (e) {}

const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const DB_REF = process.env.SUPABASE_PROJECT_REF || 'omdgpncqtswnqpphfovo';
if (!DB_PASSWORD) {
  console.error('[Palas Atlas] Defina SUPABASE_DB_PASSWORD no .env.local antes de rodar as migrações.');
  process.exit(1);
}
const senha = encodeURIComponent(DB_PASSWORD);

const connectionStrings = [
  // 1. Transaction Pooler (Supabase us-east-1 standard pooler)
  `postgresql://postgres.${DB_REF}:${senha}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  // 2. Session Pooler
  `postgresql://postgres.${DB_REF}:${senha}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
  // 3. Direct connection
  `postgresql://postgres:${senha}@db.${DB_REF}.supabase.co:5432/postgres`
];

async function runMigrations() {
  let client = null;
  let connected = false;

  for (const connStr of connectionStrings) {
    console.log(`[Palas Atlas] Tentando conectar via ${connStr.split('@')[1]}...`);
    client = new Client({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000
    });

    try {
      await client.connect();
      console.log(`[Palas Atlas] Conexão com o PostgreSQL do Supabase estabelecida com sucesso!`);
      connected = true;
      break;
    } catch (err) {
      console.warn(`[Palas Atlas] Falha ao conectar nessa rota:`, err.message);
      await client.end().catch(() => {});
    }
  }

  if (!connected) {
    console.error(`[Palas Atlas] Não foi possível conectar ao banco diretamente.`);
    return;
  }

  try {
    // Tabela de controle de migrações
    await client.query(`
      CREATE TABLE IF NOT EXISTS public._migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );
    `);

    const migrationsDir = path.join(__dirname, '../supabase/migrations');
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM public._migrations WHERE name = $1',
        [file]
      );
      if (alreadyApplied.rows.length > 0) {
        console.log(`[Palas Atlas] Migração ${file} já aplicada. Pulando.`);
        continue;
      }

      console.log(`[Palas Atlas] Executando ${file}...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO public._migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
          [file]
        );
        console.log(`✓ [Palas Atlas] Migração ${file} aplicada com sucesso!`);
      } catch (sqlErr) {
        // Se falhou por já existir política ou tabela legada, registra como aplicada para não travar migrações subsequentes
        if (sqlErr.code === '42710' || sqlErr.code === '42P07') {
          console.warn(`[Palas Atlas] Aviso em ${file} (${sqlErr.message}). Registrando como aplicada.`);
          await client.query(
            'INSERT INTO public._migrations (name) VALUES ($1) ON CONFLICT DO NOTHING',
            [file]
          );
        } else {
          throw sqlErr;
        }
      }
    }

    const res = await client.query('SELECT count(*) FROM public.laminas;');
    console.log(`[Palas Atlas] Total de lâminas no banco: ${res.rows[0].count}`);
    const pinCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'pinos' 
      ORDER BY ordinal_position;
    `);
    console.log(`[Palas Atlas] Colunas da tabela pinos:`, pinCols.rows.map(r => `${r.column_name} (${r.data_type})`).join(', '));
  } catch (err) {
    console.error(`[Palas Atlas] Erro ao executar migrações:`, err);
  } finally {
    await client.end();
  }
}

runMigrations();

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionStrings = [
  // 1. Transaction Pooler (Supabase us-east-1 standard pooler)
  `postgresql://postgres.omdgpncqtswnqpphfovo:Paksaj-rizxuk-zisgo9@aws-0-us-east-1.pooler.supabase.com:6543/postgres`,
  // 2. Session Pooler
  `postgresql://postgres.omdgpncqtswnqpphfovo:Paksaj-rizxuk-zisgo9@aws-0-us-east-1.pooler.supabase.com:5432/postgres`,
  // 3. Direct connection
  `postgresql://postgres:Paksaj-rizxuk-zisgo9@db.omdgpncqtswnqpphfovo.supabase.co:5432/postgres`
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
    const schemaSql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/01_schema.sql'), 'utf8');
    console.log(`[Palas Atlas] Executando 01_schema.sql...`);
    await client.query(schemaSql);
    console.log(`[Palas Atlas] Tabelas, RLS e Storage criados com sucesso!`);

    const seedSql = fs.readFileSync(path.join(__dirname, '../supabase/migrations/02_seed_data.sql'), 'utf8');
    console.log(`[Palas Atlas] Executando 02_seed_data.sql...`);
    await client.query(seedSql);
    console.log(`[Palas Atlas] Disciplinas, tópicos e lâminas iniciais inseridos com sucesso!`);

    const res = await client.query('SELECT count(*) FROM public.laminas;');
    console.log(`[Palas Atlas] Total de lâminas no banco: ${res.rows[0].count}`);
  } catch (err) {
    console.error(`[Palas Atlas] Erro ao executar migrações:`, err);
  } finally {
    await client.end();
  }
}

runMigrations();

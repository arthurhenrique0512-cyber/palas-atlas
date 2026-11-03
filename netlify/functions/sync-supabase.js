const { Client } = require('pg');

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  const password = process.env.SUPABASE_DB_PASSWORD;
  const projectRef = process.env.SUPABASE_PROJECT_REF || 'omdgpncqtswnqpphfovo';

  if (!password) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'SUPABASE_DB_PASSWORD não configurado' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'JSON inválido' })
    };
  }

  const { laminaId, laminaData, pinos } = payload;
  if (!laminaId || !laminaData) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Campos laminaId e laminaData são obrigatórios' })
    };
  }

  const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    const disciplinaId = laminaData.disciplina || 'histologia';
    const topicoId = laminaData.topico || null;
    const nome = laminaData.nome || 'Lâmina Sem Título';
    const slug = laminaId.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const coloracao = laminaData.coloracao || 'H&E';
    const dziUrl = laminaData.imagemUrl || '';
    const descHtml = laminaData.descricaoHTML || '';
    const status = laminaData.status === 'ativa' ? 'ativa' : 'inativa';
    const maxMag = Number(laminaData.maxMagnification) || 40;

    // 1. Upsert na tabela public.laminas
    await client.query(`
      INSERT INTO public.laminas (id, disciplina_id, topico_id, nome, slug, coloracao, dzi_url, descricao_html, status, max_magnification, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (id) DO UPDATE SET
        disciplina_id = EXCLUDED.disciplina_id,
        topico_id = EXCLUDED.topico_id,
        nome = EXCLUDED.nome,
        slug = EXCLUDED.slug,
        coloracao = EXCLUDED.coloracao,
        dzi_url = EXCLUDED.dzi_url,
        descricao_html = EXCLUDED.descricao_html,
        status = EXCLUDED.status,
        max_magnification = EXCLUDED.max_magnification,
        updated_at = NOW();
    `, [laminaId, disciplinaId, topicoId, nome, slug, coloracao, dziUrl, descHtml, status, maxMag]);

    // 2. Remove pinos antigos da lâmina para regravar com precisão
    await client.query(`DELETE FROM public.pinos WHERE lamina_id = $1`, [laminaId]);

    // 3. Insere pinos com novos tipos geométricos
    if (Array.isArray(pinos) && pinos.length > 0) {
      for (let i = 0; i < pinos.length; i++) {
        const p = pinos[i];
        const pId = p.id || `pin_${laminaId}_${i + 1}`;
        const rotulo = p.rotulo || `P${i + 1}`;
        const x = Number(p.x) || 0;
        const y = Number(p.y) || 0;
        const type = p.type || 'pin';
        const radius = p.radius ? Number(p.radius) : null;
        const angle = p.angle ? Number(p.angle) : null;
        const endX = (p.endX != null ? p.endX : p.end_x) ? Number(p.endX ?? p.end_x) : null;
        const endY = (p.endY != null ? p.endY : p.end_y) ? Number(p.endY ?? p.end_y) : null;
        const strokeColor = p.stroke_color || '#d4af37';
        const fillColor = p.fill_color || null;

        await client.query(`
          INSERT INTO public.pinos (id, lamina_id, rotulo, x, y, type, radius, angle, end_x, end_y, stroke_color, fill_color, ordem)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `, [pId, laminaId, rotulo, x, y, type, radius, angle, endX, endY, strokeColor, fillColor, i]);
      }
    }

    await client.end();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        laminaId,
        pinosSincronizados: (pinos || []).length
      })
    };
  } catch (err) {
    try { await client.end(); } catch (e) {}
    console.error('[Supabase Sync Error]', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};

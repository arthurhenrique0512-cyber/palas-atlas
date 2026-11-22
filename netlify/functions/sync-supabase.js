const {
  getHeader,
  getAllowedCorsOrigin,
  verifyFirebaseIdToken
} = require('./_shared/wsi-security');

/**
 * ============================================================================
 * NETLIFY FUNCTION: /api/sync-supabase
 * Sincroniza lâmina e pinos do CMS com o Supabase PostgreSQL via PostgREST,
 * exigindo Firebase ID Token válido de editor autenticado.
 * ============================================================================
 */

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'palas-atlas';

function buildSupabaseHeaders(serviceKey, extra = {}) {
  return {
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

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
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  // 1. Autenticação obrigatória via Firebase ID Token
  const authHeader = getHeader(headers, 'authorization');
  try {
    await verifyFirebaseIdToken(authHeader, FIREBASE_PROJECT_ID);
  } catch (authErr) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: authErr.message || 'Não autorizado.' })
    };
  }

  const projectRef = process.env.SUPABASE_PROJECT_REF || 'omdgpncqtswnqpphfovo';
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || `https://${projectRef}.supabase.co`).replace(/\/+$/, '');
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'SUPABASE_SERVICE_ROLE_KEY não configurado.' })
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'JSON inválido' })
    };
  }

  const { laminaId, laminaData, pinos } = payload;
  if (!laminaId || typeof laminaId !== 'string' || !/^[a-zA-Z0-9._-]{1,128}$/.test(laminaId) || !laminaData || typeof laminaData !== 'object') {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Campos laminaId e laminaData válidos são obrigatórios' })
    };
  }

  try {
    const allowedMags = [4, 10, 40, 60, 100];
    const rawMag = Number(laminaData.maxMagnification) || 40;
    const maxMag = allowedMags.includes(rawMag) ? rawMag : 40;

    const laminaRow = {
      id: laminaId,
      disciplina_id: String(laminaData.disciplina || 'histologia').slice(0, 64),
      topico_id: laminaData.topico ? String(laminaData.topico).slice(0, 64) : null,
      nome: String(laminaData.nome || 'Lâmina Sem Título').slice(0, 240),
      slug: laminaId.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      coloracao: String(laminaData.coloracao || 'H&E').slice(0, 120),
      dzi_url: String(laminaData.imagemUrl || ''),
      descricao_html: String(laminaData.descricaoHTML || ''),
      status: laminaData.status === 'ativa' ? 'ativa' : 'inativa',
      max_magnification: maxMag,
      updated_at: new Date().toISOString()
    };

    // 2. Upsert na tabela public.laminas via PostgREST
    const upsertRes = await fetch(`${supabaseUrl}/rest/v1/laminas?on_conflict=id`, {
      method: 'POST',
      headers: buildSupabaseHeaders(serviceRoleKey, {
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      }),
      body: JSON.stringify(laminaRow)
    });

    if (!upsertRes.ok) {
      const errText = await upsertRes.text();
      throw new Error(`Supabase upsert laminas falhou (${upsertRes.status}): ${errText}`);
    }

    // 3. Remove pinos antigos da lâmina
    const delRes = await fetch(
      `${supabaseUrl}/rest/v1/pinos?lamina_id=eq.${encodeURIComponent(laminaId)}`,
      {
        method: 'DELETE',
        headers: buildSupabaseHeaders(serviceRoleKey)
      }
    );

    if (!delRes.ok) {
      const errText = await delRes.text();
      throw new Error(`Supabase delete pinos falhou (${delRes.status}): ${errText}`);
    }

    // 4. Insere pinos atualizados em lote
    const validTypes = ['pin', 'arrow', 'circle'];
    const pinRows = Array.isArray(pinos)
      ? pinos.map((p, i) => ({
          id: String(p.id || `pin_${laminaId}_${i + 1}`).slice(0, 128),
          lamina_id: laminaId,
          rotulo: String(p.rotulo || `P${i + 1}`).slice(0, 240),
          x: Number(p.x) || 0,
          y: Number(p.y) || 0,
          type: validTypes.includes(p.type) ? p.type : 'pin',
          radius: p.radius != null ? Number(p.radius) : null,
          angle: p.angle != null ? Number(p.angle) : null,
          end_x: (p.endX ?? p.end_x) != null ? Number(p.endX ?? p.end_x) : null,
          end_y: (p.endY ?? p.end_y) != null ? Number(p.endY ?? p.end_y) : null,
          stroke_color: String(p.stroke_color || '#d4af37').slice(0, 40),
          fill_color: p.fill_color ? String(p.fill_color).slice(0, 60) : null,
          ordem: i
        }))
      : [];

    if (pinRows.length > 0) {
      const insRes = await fetch(`${supabaseUrl}/rest/v1/pinos`, {
        method: 'POST',
        headers: buildSupabaseHeaders(serviceRoleKey, {
          'Prefer': 'return=minimal'
        }),
        body: JSON.stringify(pinRows)
      });

      if (!insRes.ok) {
        const errText = await insRes.text();
        throw new Error(`Supabase insert pinos falhou (${insRes.status}): ${errText}`);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      },
      body: JSON.stringify({
        success: true,
        laminaId,
        pinosSincronizados: pinRows.length
      })
    };
  } catch (err) {
    console.error('[Supabase Sync Error]', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ error: 'Erro interno ao sincronizar dados com o Supabase.' })
    };
  }
};

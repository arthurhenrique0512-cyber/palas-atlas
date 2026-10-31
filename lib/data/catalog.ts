import { Disciplina, Topico, Lamina } from '@/lib/supabase/types';
import { fallbackDisciplinas, fallbackTopicos, fallbackLaminas } from './fallback';

export { fallbackDisciplinas, fallbackTopicos, fallbackLaminas };

export async function getDisciplinas(): Promise<Disciplina[]> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase.from('disciplinas').select('*').order('ordem', { ascending: true });
      if (!error && data && data.length > 0) return data as Disciplina[];
    }
  } catch (e) {}
  return fallbackDisciplinas;
}

export async function getTopicos(disciplinaId: string): Promise<Topico[]> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase.from('topicos').select('*').eq('disciplina_id', disciplinaId).order('ordem', { ascending: true });
      if (!error && data && data.length > 0) return data as Topico[];
    }
  } catch (e) {}
  return fallbackTopicos.filter(t => t.disciplina_id === disciplinaId);
}

export async function getLaminas(topicoId?: string, disciplinaId?: string): Promise<Lamina[]> {
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    if (supabase) {
      let query = supabase.from('laminas').select('*, pinos(*)').eq('status', 'ativa');
      if (topicoId) query = query.eq('topico_id', topicoId);
      if (disciplinaId) query = query.eq('disciplina_id', disciplinaId);
      const { data, error } = await query;
      if (!error && data && data.length > 0) return data as Lamina[];
    }
  } catch (e) {}
  
  return Object.values(fallbackLaminas).filter(l => {
    if (topicoId && l.topico_id !== topicoId) return false;
    if (disciplinaId && l.disciplina_id !== disciplinaId) return false;
    return true;
  });
}

export async function getLaminaById(id: string): Promise<Lamina | null> {
  const normId = decodeURIComponent(id).trim();
  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();
    if (supabase) {
      const { data, error } = await supabase.from('laminas').select('*, pinos(*)').or(`id.eq.${normId},slug.eq.${normId}`).maybeSingle();
      if (!error && data) return data as Lamina;
    }
  } catch (e) {}

  return fallbackLaminas[normId] || 
         Object.values(fallbackLaminas).find(l => l.slug === normId || l.id.toLowerCase() === normId.toLowerCase()) || 
         null;
}

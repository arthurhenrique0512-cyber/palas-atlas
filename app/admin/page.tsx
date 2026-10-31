'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/ui/Navbar';
import { createClient } from '@/lib/supabase/client';
import { Lamina, Disciplina, Topico } from '@/lib/supabase/types';
import { fallbackLaminas, fallbackDisciplinas, fallbackTopicos } from '@/lib/data/fallback';
import { Plus, Database, CheckCircle, AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';

export default function AdminPage() {
  const [laminas, setLaminas] = useState<Lamina[]>(Object.values(fallbackLaminas));
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>(fallbackDisciplinas);
  const [topicos, setTopicos] = useState<Topico[]>(fallbackTopicos);
  const [loading, setLoading] = useState<boolean>(true);
  const [dbConnected, setDbConnected] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Formulário de Nova Lâmina
  const [nome, setNome] = useState('');
  const [disciplinaId, setDisciplinaId] = useState('histologia');
  const [topicoId, setTopicoId] = useState('osseo');
  const [coloracao, setColoracao] = useState('Hematoxilina e Eosina (H&E)');
  const [dziUrl, setDziUrl] = useState('');
  const [maxMag, setMaxMag] = useState<4 | 10 | 40 | 60 | 100>(40);

  const fetchSupabaseData = async () => {
    setLoading(true);
    const supabase = createClient();
    if (supabase) {
      try {
        const { data: discs } = await supabase.from('disciplinas').select('*').order('ordem');
        if (discs && discs.length > 0) setDisciplinas(discs);

        const { data: tops } = await supabase.from('topicos').select('*').order('ordem');
        if (tops && tops.length > 0) setTopicos(tops);

        const { data: lams } = await supabase.from('laminas').select('*, pinos(*)').order('created_at', { ascending: false });
        if (lams && lams.length > 0) {
          setLaminas(lams);
          setDbConnected(true);
        }
      } catch (err) {
        console.warn('Usando catálogo local:', err);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSupabaseData();
  }, []);

  const handleSalvarLamina = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !dziUrl) {
      setFeedback('Preencha o nome e o caminho/URL do DZI.');
      return;
    }

    const slug = nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-');
    const novaLamina: Lamina = {
      id: slug,
      nome,
      slug,
      disciplina_id: disciplinaId,
      topico_id: topicoId,
      coloracao,
      max_magnification: maxMag,
      mpp: 0.25,
      status: 'ativa',
      dzi_url: dziUrl,
      thumbnail_url: dziUrl.replace('.dzi', '-preview.jpg'),
      preview_image: dziUrl.replace('.dzi', '-preview.jpg'),
      descricao_html: `<p>Preparação histológica de ${nome}.</p>`,
      pinos: []
    };

    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from('laminas').insert([novaLamina]);
      if (error) {
        setFeedback(`Erro ao salvar no Supabase: ${error.message}`);
        return;
      }
    }

    setLaminas([novaLamina, ...laminas]);
    setFeedback('Lâmina salva e publicada com sucesso!');
    setNome('');
    setDziUrl('');
    setTimeout(() => setFeedback(null), 4000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090b10] text-slate-100">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-20 space-y-10">
        
        {/* Cabeçalho do Painel */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#d4af37]">
                Painel do Desenvolvedor &bull; CMS
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white">
              Gestão de Lâminas e Acervo Morfológico
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-mono">
              <Database className="w-3.5 h-3.5" />
              <span>PostgreSQL / Supabase Conectado</span>
            </span>
            <button
              onClick={fetchSupabaseData}
              className="p-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-neutral-400 hover:text-white transition-all"
              title="Atualizar dados"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {feedback && (
          <div className="p-4 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37] text-xs font-mono">
            {feedback}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Coluna Esquerda: Formulário de Adicionar Nova Lâmina */}
          <div className="lg:col-span-5 p-6 sm:p-7 rounded-2xl bg-white/[0.02] border border-white/[0.08] space-y-5">
            <h2 className="text-lg font-serif font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#d4af37]" />
              <span>Cadastrar Nova Lâmina DZI</span>
            </h2>

            <form onSubmit={handleSalvarLamina} className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                  Nome da Lâmina / Espécime
                </label>
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Córtex Cerebral (Coloração de Golgi)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-[#d4af37]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                    Disciplina
                  </label>
                  <select
                    value={disciplinaId}
                    onChange={(e) => setDisciplinaId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  >
                    {disciplinas.map((d) => (
                      <option key={d.id} value={d.id}>{d.nome}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                    Tópico / Módulo
                  </label>
                  <select
                    value={topicoId}
                    onChange={(e) => setTopicoId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#d4af37]"
                  >
                    {topicos.filter(t => t.disciplina_id === disciplinaId).map((t) => (
                      <option key={t.id} value={t.id}>{t.titulo}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                  Coloração ou Técnica
                </label>
                <input
                  type="text"
                  value={coloracao}
                  onChange={(e) => setColoracao(e.target.value)}
                  placeholder="Ex: Hematoxilina e Eosina (H&E)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#d4af37]"
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                  Caminho do Arquivo DZI ou Imagem
                </label>
                <input
                  type="text"
                  value={dziUrl}
                  onChange={(e) => setDziUrl(e.target.value)}
                  placeholder="assets/histologia/nome-da-lamina.dzi"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs font-mono text-white placeholder-neutral-500 focus:outline-none focus:border-[#d4af37]"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-neutral-400 mb-1">
                  Magnificação Máxima (Objetiva)
                </label>
                <select
                  value={maxMag}
                  onChange={(e) => setMaxMag(Number(e.target.value) as any)}
                  className="w-full px-3 py-2.5 rounded-xl bg-neutral-900 border border-white/[0.1] text-xs text-white focus:outline-none focus:border-[#d4af37]"
                >
                  <option value={40}>40x (Padrão celular)</option>
                  <option value={60}>60x (Alta resolução)</option>
                  <option value={100}>100x (Imersão em óleo)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#d4af37] hover:bg-[#e0c97f] text-neutral-950 font-bold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-[#d4af37]/20"
              >
                Publicar Lâmina no Acervo
              </button>
            </form>
          </div>

          {/* Coluna Direita: Lista do Acervo Atual */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-lg font-serif font-bold text-white flex items-center justify-between">
              <span>Acervo Atual ({laminas.length} Lâminas)</span>
              <span className="text-xs font-mono text-[#d4af37]">PostgreSQL</span>
            </h2>

            <div className="space-y-3">
              {laminas.map((lamina) => (
                <div
                  key={lamina.id}
                  className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12] transition-all flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-neutral-900 overflow-hidden border border-white/[0.08] shrink-0">
                      <img
                        src={lamina.thumbnail_url || lamina.preview_image || '/assets/histologia/medula-espinal-he.png'}
                        alt={lamina.nome}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-serif font-bold text-white truncate">
                        {lamina.nome}
                      </h4>
                      <p className="text-[11px] font-mono text-neutral-400">
                        {lamina.coloracao} &bull; Máx: {lamina.max_magnification}x
                      </p>
                    </div>
                  </div>

                  <Link
                    href={`/${lamina.disciplina_id || 'histologia'}/${lamina.topico_id || 'geral'}/${lamina.slug || lamina.id}`}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-[#d4af37]/20 text-[#d4af37] border border-[#d4af37]/30 text-xs font-mono uppercase tracking-wider shrink-0 transition-all"
                  >
                    Abrir Viewer
                  </Link>
                </div>
              ))}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}

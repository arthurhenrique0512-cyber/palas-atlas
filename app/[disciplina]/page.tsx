import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Navbar } from '@/components/ui/Navbar';
import { getDisciplinas, getTopicos, getLaminas } from '@/lib/data/catalog';
import { ArrowRight, BookOpen, Layers, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';

interface DisciplinaPageProps {
  params: Promise<{ disciplina: string }>;
}

export async function generateMetadata({ params }: DisciplinaPageProps): Promise<Metadata> {
  const { disciplina: slug } = await params;
  const disciplinas = await getDisciplinas();
  const disc = disciplinas.find(d => d.slug === slug || d.id === slug);

  if (!disc) return { title: 'Disciplina não encontrada — Palas Atlas' };

  return {
    title: `${disc.nome} — Palas Atlas`,
    description: disc.descricao || `Explore o acervo de lâminas e cortes de ${disc.nome} no Palas Atlas.`
  };
}

export default async function DisciplinaPage({ params }: DisciplinaPageProps) {
  const { disciplina: slug } = await params;
  const disciplinas = await getDisciplinas();
  const disc = disciplinas.find(d => d.slug === slug || d.id === slug);

  if (!disc) notFound();

  const topicos = await getTopicos(disc.id);
  const laminas = await getLaminas(undefined, disc.id);

  return (
    <div className="min-h-screen flex flex-col bg-[#090b10] text-slate-100">
      <Navbar />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-20">
        
        {/* Cabeçalho da Disciplina */}
        <div className="mb-12 border-b border-white/[0.08] pb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37]" />
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-[#d4af37]">
              Módulo Curricular
            </span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white tracking-tight mb-3">
            {disc.nome}
          </h1>
          <p className="text-sm sm:text-base text-neutral-400 font-sans max-w-2xl leading-relaxed">
            {disc.descricao}
          </p>
          {disc.bibliografia && (
            <p className="text-xs text-neutral-500 font-mono mt-3">
              Referência: {disc.bibliografia}
            </p>
          )}
        </div>

        {/* Módulos e Lâminas Agrupadas por Tópicos */}
        <div className="space-y-12">
          {topicos.map((topico) => {
            const laminasDoTopico = laminas.filter(l => l.topico_id === topico.id || l.topico_id === topico.slug);

            return (
              <section key={topico.id} className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.04] pb-3">
                  <div>
                    <h2 className="text-lg sm:text-xl font-serif font-bold text-white">
                      {topico.titulo}
                    </h2>
                    {topico.resumo && (
                      <p className="text-xs text-neutral-400 mt-1 max-w-3xl leading-relaxed">
                        {topico.resumo}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-mono text-[#d4af37] shrink-0">
                    {laminasDoTopico.length} {laminasDoTopico.length === 1 ? 'Lâmina' : 'Lâminas'}
                  </span>
                </div>

                {/* Grid de Lâminas */}
                {laminasDoTopico.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
                    {laminasDoTopico.map((lamina) => (
                      <Link
                        key={lamina.id}
                        href={`/${disc.slug}/${topico.slug}/${lamina.slug || lamina.id}`}
                        className="group rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-[#d4af37]/40 p-4 transition-all duration-300 flex flex-col justify-between"
                      >
                        <div className="aspect-[16/10] w-full rounded-xl overflow-hidden relative bg-neutral-950 mb-3 border border-white/[0.04]">
                          <img
                            src={lamina.thumbnail_url || lamina.preview_image || '/assets/histologia/medula-espinal-he.png'}
                            alt={lamina.nome}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-neutral-300">
                            {lamina.coloracao}
                          </div>
                        </div>

                        <div>
                          <h3 className="font-serif font-bold text-sm text-slate-100 group-hover:text-[#d4af37] transition-colors leading-snug">
                            {lamina.nome}
                          </h3>
                        </div>

                        <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between text-xs font-mono text-neutral-500 group-hover:text-[#d4af37] transition-colors">
                          <span>Examinar no Microscópio</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-xl bg-white/[0.01] border border-dashed border-white/[0.06] text-center">
                    <p className="text-xs text-neutral-500 font-mono">
                      Novas lâminas deste módulo em processo de varredura microscópica no laboratório.
                    </p>
                  </div>
                )}
              </section>
            );
          })}
        </div>

      </main>
    </div>
  );
}

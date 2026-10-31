import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Navbar } from '@/components/ui/Navbar';
import { getDisciplinas, getLaminas } from '@/lib/data/catalog';
import { Search, ArrowRight, Microscope, Sparkles, BookOpen, Layers } from 'lucide-react';

export const revalidate = 60; // ISR a cada 60s

export default async function HomePage() {
  const disciplinas = await getDisciplinas();
  const laminas = await getLaminas();

  // Lâmina em destaque para a vitrine
  const vitrineSlide = laminas.find(l => l.id === 'osso_maduro_desgaste_ct') || laminas[0];

  return (
    <div className="min-h-screen flex flex-col bg-[#090b10] text-slate-100 relative overflow-x-hidden">
      <Navbar />

      {/* Hero Background com Glow Sutil */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(212,175,55,0.08),rgba(255,255,255,0))] pointer-events-none" />

      {/* SEÇÃO 1: HERO SECTION */}
      <section className="w-full pt-28 sm:pt-36 pb-16 sm:pb-24 px-4 sm:px-6 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Coluna Esquerda: Apresentação & Ações */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" />
              <span className="text-[10px] sm:text-xs font-mono uppercase tracking-widest text-[#d4af37]">
                Nova Versão &bull; Next.js 15 + Supabase
              </span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight mb-5">
              Atlas Integrado de <br />
              <span className="bg-gradient-to-r from-white via-zinc-200 to-[#d4af37] bg-clip-text text-transparent">
                Ciências Morfológicas
              </span>
            </h1>

            <p className="text-neutral-300 text-sm sm:text-base lg:text-lg max-w-xl font-sans font-light leading-relaxed mb-8">
              O mais completo acervo digital focado no ciclo básico da Medicina. Explore preparações histológicas e peças anatômicas em altíssima definição com calibração física e navegação profunda.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap gap-4 items-center w-full">
              <Link
                href="/histologia"
                className="bg-gradient-to-r from-amber-500/20 to-amber-600/10 hover:from-amber-500/30 hover:to-amber-600/20 text-[#d4af37] border border-[#d4af37]/40 hover:border-[#d4af37]/70 rounded-full px-7 py-3.5 transition-all duration-300 flex items-center justify-center gap-2 group text-sm font-semibold shadow-[0_0_20px_rgba(212,175,55,0.12)] hover:shadow-[0_0_30px_rgba(212,175,55,0.25)]"
              >
                <span>Explorar Lâminas</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              
              <Link
                href="/sobre"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] text-slate-300 hover:text-white transition-all text-sm font-medium"
              >
                Sobre o Projeto
              </Link>
            </div>
          </div>

          {/* Coluna Direita: Vitrine Flutuante */}
          {vitrineSlide && (
            <div className="lg:col-span-5 w-full">
              <div className="relative group/showcase w-full flex flex-col space-y-4">
                <div className="relative group/preview w-full">
                  <div className="absolute -inset-1 bg-gradient-to-tr from-[#d4af37]/15 via-emerald-500/10 to-amber-500/10 rounded-3xl blur-2xl opacity-40 group-hover/preview:opacity-75 transition-opacity duration-700 pointer-events-none" />

                  <div className="aspect-[16/10] w-full rounded-2xl overflow-hidden relative shadow-2xl shadow-black/90 bg-neutral-950 border border-white/[0.08]">
                    <img
                      src={vitrineSlide.thumbnail_url || vitrineSlide.preview_image || '/assets/histologia/medula-espinal-he.png'}
                      alt={vitrineSlide.nome}
                      className="w-full h-full object-cover transition-all duration-700 ease-in-out group-hover/preview:scale-[1.03]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                    <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5">
                      <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider text-neutral-300 border border-white/[0.08]">
                        {vitrineSlide.coloracao}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3 z-10">
                      <span className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wider text-[#d4af37] border border-[#d4af37]/30 flex items-center gap-1.5 font-medium">
                        Deep Zoom DZI
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-1 text-left">
                  <span className="text-[10px] tracking-widest uppercase text-[#d4af37]/80 font-mono font-medium">
                    {vitrineSlide.disciplina_id?.toUpperCase()} &bull; {vitrineSlide.specimen || 'Corte Digital'}
                  </span>
                  <h3 className="font-serif font-bold text-xl text-slate-100">
                    {vitrineSlide.nome}
                  </h3>
                </div>

                <Link
                  href={`/${vitrineSlide.disciplina_id || 'histologia'}/${vitrineSlide.topico_id || 'geral'}/${vitrineSlide.slug || vitrineSlide.id}`}
                  className="w-full py-3 px-5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-[#d4af37]/40 text-neutral-200 hover:text-white transition-all text-xs font-mono uppercase tracking-wider flex items-center justify-between group"
                >
                  <span>Abrir no Microscópio Óptico</span>
                  <ArrowRight className="w-4 h-4 text-[#d4af37] group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* SEÇÃO 2: COMPÊNDIO DAS DISCIPLINAS */}
      <section className="w-full py-16 px-4 sm:px-6 border-t border-white/[0.06] bg-neutral-950/40">
        <div className="max-w-7xl mx-auto space-y-8">
          <div>
            <span className="text-xs font-mono uppercase tracking-[0.25em] text-[#d4af37]">
              Grade Acadêmica
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif font-bold text-white mt-1">
              Disciplinas do Ciclo Básico
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {disciplinas.map((disc) => (
              <Link
                key={disc.id}
                href={`/${disc.slug}`}
                className="p-6 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/[0.06] hover:border-[#d4af37]/40 transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-[#d4af37]/10 text-[#d4af37] border border-[#d4af37]/20 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h3 className="font-serif font-bold text-lg text-white group-hover:text-[#d4af37] transition-colors">
                    {disc.nome}
                  </h3>
                  <p className="text-xs text-neutral-400 font-sans leading-relaxed">
                    {disc.descricao}
                  </p>
                </div>

                <div className="pt-5 mt-4 border-t border-white/[0.04] flex items-center justify-between text-xs font-mono text-neutral-500 group-hover:text-[#d4af37] transition-colors">
                  <span>Acessar Módulos</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Rodapé Minimalista */}
      <footer className="w-full py-10 px-6 border-t border-white/[0.06] text-center text-xs text-neutral-500 font-sans mt-auto">
        <p>&copy; 2026 Palas Atlas &mdash; Projeto Acadêmico sem fins lucrativos. Desenvolvido para a formação médica de excelência.</p>
      </footer>
    </div>
  );
}

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/ui/Navbar';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sobre o Projeto — Palas Atlas',
  description: 'Concepção científica, filosofia acadêmica e equipe curadora do Palas Atlas.',
};

export default function SobrePage() {
  const equipe = [
    {
      nome: 'Arthur Ribeiro',
      papel: 'Idealização e Desenvolvimento',
      desc: 'Estudante de Medicina e idealizador do Palas Atlas, responsável pela concepção pedagógica, desenvolvimento da plataforma digital e curadoria do acervo morfológico.',
      foto: '/images/team/arthur.webp',
      fotoFallback: '/images/team/arthur.png',
      destaque: true
    },
    {
      nome: 'Prof. Dr. Fernando Fellicioni',
      papel: 'Orientação Científica',
      desc: 'Docente de Morfologia e Patologia, responsável pelo direcionamento pedagógico e validação microscópica das peças do acervo.',
      foto: '/images/team/fernando.webp',
      fotoFallback: '/images/team/fernando.png',
      destaque: false
    },
    {
      nome: 'Carolina',
      papel: 'Curadoria Histológica',
      desc: 'Colaboração na preparação tecidual, seleção das melhores lâminas de rotina e revisão dos pontos de interesse.',
      foto: '/images/team/carolina.webp',
      fotoFallback: '/images/team/carolina.png',
      destaque: false
    },
    {
      nome: 'Guilherme',
      papel: 'Captura e Digitalização',
      desc: 'Atuação na esteira de microscopia óptica, varredura de charriot em serpente e montagem de mosaicos de alta resolução.',
      foto: '/images/team/guilherme.webp',
      fotoFallback: '/images/team/guilherme.png',
      destaque: false
    },
    {
      nome: 'Iago',
      papel: 'Processamento de Imagens',
      desc: 'Costura no Fiji/ImageJ com linear blending, calibração micrométrica e exportação para pirâmides Deep Zoom (DZI).',
      foto: '/images/team/iago.webp',
      fotoFallback: '/images/team/iago.png',
      destaque: false
    }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#090b10] text-slate-100">
      <Navbar />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 pt-28 sm:pt-36 pb-20 space-y-16">
        
        {/* Cabeçalho */}
        <div className="space-y-4 border-b border-white/[0.08] pb-8">
          <span className="text-xs font-mono uppercase tracking-[0.25em] text-[#d4af37]">
            Institucional &bull; Filosofia Acadêmica
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-bold text-white tracking-tight leading-tight">
            Ciência Morfológica <br />
            <span className="bg-gradient-to-r from-white via-zinc-200 to-[#d4af37] bg-clip-text text-transparent">
              Fiel à Realidade Prática
            </span>
          </h1>
          <p className="text-base text-neutral-300 font-sans leading-relaxed">
            O Palas Atlas nasceu da constatação de que os acervos digitais tradicionais disponibilizam apenas lâminas altamente selecionadas e artificiais. Nossa proposta é construir um acervo autêntico, com lâminas reais que refletem a rotina do laboratório acadêmico.
          </p>
        </div>

        {/* Manifesto */}
        <blockquote className="border-l-2 border-[#d4af37] pl-6 py-3 italic text-neutral-300 font-serif text-lg bg-white/[0.02] rounded-r-2xl">
          &ldquo;Aproximar a tecnologia digital da realidade prática do laboratório é o caminho para transformar o ensino morfológico em uma experiência viva, autêntica e acessível a todos os estudantes.&rdquo;
        </blockquote>

        {/* Equipe Curadora */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-serif font-bold text-white">
              Equipe e Curadoria
            </h2>
            <p className="text-xs text-neutral-400 font-mono mt-1">
              Concepção científica e tecnológica do Palas Atlas.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {equipe.map((membro) => (
              <div
                key={membro.nome}
                className={`p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-[#d4af37]/40 transition-all flex flex-col justify-between ${
                  membro.destaque ? 'md:col-span-2' : ''
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-neutral-900 border border-white/[0.1] shrink-0">
                      <picture>
                        <source srcSet={membro.foto} type="image/webp" />
                        <img
                          src={membro.fotoFallback}
                          alt={membro.nome}
                          className="w-full h-full object-cover"
                        />
                      </picture>
                    </div>
                    <div>
                      <h3 className="font-serif font-bold text-base text-white">
                        {membro.nome}
                      </h3>
                      <p className="text-xs text-[#d4af37] font-mono">
                        {membro.papel}
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-400 leading-relaxed font-sans pt-1">
                    {membro.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}

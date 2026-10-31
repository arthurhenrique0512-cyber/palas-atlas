'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BrandLogo } from './BrandLogo';
import { Menu, X, ArrowLeft, BookOpen, Layers, Info, Settings, Search } from 'lucide-react';

interface NavbarProps {
  onOpenHelp?: () => void;
}

export function Navbar({ onOpenHelp }: NavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const isHome = pathname === '/';
  const isMicroscope = pathname.includes('/laminas/') || (pathname.split('/').filter(Boolean).length >= 3);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 pointer-events-none ${
          isMicroscope ? 'bg-neutral-950/90 border-b border-white/[0.08]' : ''
        }`}
      >
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          
          {/* Lado Esquerdo: Voltar (se em subpágina) + BrandLogo */}
          <div className="flex items-center gap-3 pointer-events-auto">
            {!isHome && (
              <button
                type="button"
                onClick={() => router.back()}
                className="p-2 text-slate-300 hover:text-white bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md border border-white/[0.08] rounded-full transition-all text-xs font-medium flex items-center gap-1.5 px-3 py-2 cursor-pointer shadow-sm"
                aria-label="Voltar"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Voltar</span>
              </button>
            )}

            <Link
              href="/"
              className={`group inline-flex items-center gap-3 rounded-full bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md border border-white/[0.08] hover:border-white/[0.16] transition-all duration-300 ease-in-out shadow-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.12)] cursor-pointer select-none no-underline ${
                isScrolled ? 'px-4 sm:px-5 py-2' : 'px-5 sm:px-6 py-2.5 sm:py-3'
              }`}
            >
              <BrandLogo
                isHome={isHome}
                theme="dark-bg"
                showSubtitle={!isScrolled}
                compact={isScrolled}
                size={isScrolled ? 'sm' : 'md'}
              />
            </Link>
          </div>

          <div className="flex-1" />

          {/* Lado Direito: Ações Rápidas & Botão Hambúrguer */}
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="rounded-full bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md border border-white/[0.08] hover:border-white/[0.16] p-1 sm:p-1.5 transition-all duration-300 shadow-sm">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(true)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none"
                aria-label="Abrir Menu Lateral"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop do Drawer */}
      {isDrawerOpen && (
        <div
          onClick={() => setIsDrawerOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-[99990] transition-opacity duration-300"
        />
      )}

      {/* Drawer Lateral Minimalista */}
      <aside
        className={`fixed top-0 right-0 h-full w-[88vw] max-w-[360px] sm:w-96 bg-neutral-950/95 backdrop-blur-2xl text-white border-l border-white/[0.06] z-[99999] p-6 sm:p-8 flex flex-col justify-between shadow-[0_0_60px_rgba(0,0,0,0.85)] overflow-y-auto transition-transform duration-300 ease-out ${
          isDrawerOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="space-y-7">
          {/* Topo do Drawer */}
          <div className="flex items-center justify-between pb-6 border-b border-white/[0.06]">
            <Link href="/" onClick={() => setIsDrawerOpen(false)}>
              <BrandLogo theme="dark-bg" showSubtitle={false} size="sm" />
            </Link>
            <button
              type="button"
              onClick={() => setIsDrawerOpen(false)}
              className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/[0.06] rounded-full transition-all duration-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navegação por Disciplinas */}
          <div>
            <span className="text-[10px] tracking-[0.25em] font-mono font-medium text-neutral-500 uppercase mb-3 block">
              Disciplinas do Ciclo Básico
            </span>
            <div className="space-y-1">
              {[
                { name: 'Histologia Geral e Tecidos', path: '/histologia' },
                { name: 'Anatomia Macroscópica', path: '/anatomia' },
                { name: 'Patologia Geral', path: '/patologia' },
                { name: 'Parasitologia Médica', path: '/parasitologia' },
                { name: 'Microbiologia e Micologia', path: '/microbiologia' },
              ].map((item) => (
                <Link
                  key={item.path}
                  href={item.path}
                  onClick={() => setIsDrawerOpen(false)}
                  className="flex items-center gap-3 text-neutral-300 hover:text-[#d4af37] hover:bg-white/[0.03] px-3.5 py-2.5 rounded-xl transition-all duration-200 text-sm font-medium"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-white/20 group-hover:bg-[#d4af37]" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Recursos e Institucional */}
          <div className="pt-5 border-t border-white/[0.06] space-y-1">
            <span className="text-[10px] tracking-[0.25em] font-mono font-medium text-neutral-500 uppercase mb-3 block">
              Plataforma & Curadoria
            </span>

            {onOpenHelp && (
              <button
                type="button"
                onClick={() => {
                  setIsDrawerOpen(false);
                  onOpenHelp();
                }}
                className="w-full flex items-center justify-between text-neutral-300 hover:text-[#d4af37] hover:bg-white/[0.03] px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium text-left cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="w-4 h-4 text-neutral-400" />
                  <span>Como Usar o Site</span>
                </div>
                <span className="text-[10px] font-mono text-[#d4af37] border border-[#d4af37]/30 bg-[#d4af37]/10 px-2 py-0.5 rounded-full uppercase">
                  Guia
                </span>
              </button>
            )}

            <Link
              href="/sobre"
              onClick={() => setIsDrawerOpen(false)}
              className="flex items-center gap-2.5 text-neutral-300 hover:text-[#d4af37] hover:bg-white/[0.03] px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium"
            >
              <Info className="w-4 h-4 text-neutral-400" />
              <span>Sobre o Palas Atlas</span>
            </Link>

            <Link
              href="/admin"
              onClick={() => setIsDrawerOpen(false)}
              className="flex items-center gap-2.5 text-neutral-300 hover:text-[#d4af37] hover:bg-white/[0.03] px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium"
            >
              <Settings className="w-4 h-4 text-neutral-400" />
              <span>Painel do Desenvolvedor</span>
            </Link>
          </div>
        </div>

        {/* Rodapé do Menu */}
        <div className="pt-5 border-t border-white/[0.06] text-center text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
          Palas Atlas &bull; Acervo Morfológico Digital
        </div>
      </aside>
    </>
  );
}

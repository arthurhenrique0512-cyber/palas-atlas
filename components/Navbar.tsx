'use client';

import React, { useState } from 'react';
import Link from 'next/link';

interface NavbarProps {
  onOpenSettings?: () => void;
  onOpenMenu?: () => void;
  className?: string;
}

export default function Navbar({
  onOpenSettings,
  onOpenMenu,
  className = '',
}: NavbarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleToggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
    if (onOpenMenu) onOpenMenu();
  };

  const handleToggleSettings = () => {
    setIsSettingsOpen((prev) => !prev);
    if (onOpenSettings) onOpenSettings();
  };

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 pointer-events-none ${className}`}
    >
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        {/* ── LADO ESQUERDO: Cápsula Flutuante do Logotipo (Top-Left) ── */}
        <Link
          href="/"
          className="pointer-events-auto group inline-flex items-center gap-3 rounded-full bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md border border-white/[0.08] hover:border-white/[0.16] px-4 sm:px-5 py-2.5 transition-all duration-300 shadow-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.12)] cursor-pointer select-none"
          aria-label="Palas Atlas - Início"
        >
          {/* Estrutura Centralizada da Marca: PALAS [ÍCONE] ATLAS */}
          <div className="flex flex-col items-start justify-center">
            <div className="flex items-center gap-2.5">
              {/* PALAS - Ouro-champanhe fosco (~20% maior) */}
              <span className="font-serif font-bold text-base sm:text-lg tracking-[0.2em] text-[#d4af37] leading-none transition-colors group-hover:text-amber-200">
                PALAS
              </span>

              {/* Ícone Central Morfológico / Atena (~20% maior) */}
              <span className="text-[#d4af37] group-hover:scale-105 transition-transform duration-300 flex items-center justify-center">
                <svg
                  className="w-5 h-5 sm:w-6 sm:h-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 18h8" />
                  <path d="M3 22h18" />
                  <path d="M14 22a7 7 0 1 0-7-7" />
                  <path d="M9 14h2" />
                  <path d="M9 12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2" />
                  <circle cx="11" cy="8" r="1" fill="currentColor" />
                </svg>
              </span>

              {/* ATLAS - Off-white / Azul-gelo suave (~20% maior) */}
              <span className="font-serif font-normal text-base sm:text-lg tracking-[0.2em] text-slate-100 group-hover:text-white leading-none transition-colors">
                ATLAS
              </span>
            </div>

            {/* Subtítulo: Proteção Mobile com hidden md:block */}
            <span className="hidden md:block text-[10px] tracking-[0.22em] uppercase text-neutral-400 font-sans font-medium mt-1 leading-tight transition-colors group-hover:text-neutral-300">
              Atlas Morfológico Digital
            </span>
          </div>
        </Link>

        {/* ── CENTRO DO TOPO: Totalmente Livre para Destaque ao Hero / Visualizador DZI ── */}
        <div className="flex-1" />

        {/* ── LADO DIREITO: Cápsula Flutuante Simétrica de Ações ── */}
        <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/[0.03] backdrop-blur-md border border-white/[0.08] p-1.5 sm:p-2 transition-all duration-300 shadow-sm">
          {/* Botão de Configurações */}
          <button
            type="button"
            onClick={handleToggleSettings}
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d4af37]/50"
            aria-label="Abrir Configurações"
            title="Configurações"
            aria-expanded={isSettingsOpen}
          >
            <svg
              className="w-5 h-5 transition-transform duration-300 hover:rotate-45"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>

          {/* Divisor sutil entre os botões */}
          <div className="w-[1px] h-4 bg-white/[0.08]" />

          {/* Botão Menu Hambúrguer */}
          <button
            type="button"
            onClick={handleToggleMenu}
            className="w-10 h-10 rounded-full flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/[0.06] active:scale-95 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d4af37]/50"
            aria-label="Abrir Menu Principal"
            title="Menu"
            aria-expanded={isMenuOpen}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

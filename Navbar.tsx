'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === '/';

  useEffect(() => {
    if (!isHome) {
      setIsScrolled(false);
      return;
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isHome]);

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
      <div className={`w-full max-w-7xl mx-auto px-4 sm:px-6 transition-all duration-300 flex items-center justify-between ${
        isHome && !isScrolled ? 'py-4 sm:py-5' : 'py-3'
      }`}>
        {/* ── LADO ESQUERDO: Cápsula Flutuante do Logotipo (Top-Left) ── */}
        <Link
          href="/"
          className={`pointer-events-auto group inline-flex items-center gap-3 rounded-full bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md border border-white/[0.08] hover:border-white/[0.16] transition-all duration-300 ease-in-out shadow-sm hover:shadow-[0_0_20px_rgba(212,175,55,0.12)] cursor-pointer select-none ${
            isHome && !isScrolled
              ? 'px-5 sm:px-6 py-3'
              : 'px-4 sm:px-5 py-2'
          }`}
          aria-label="Palas Atlas - Início"
        >
          {/* Estrutura Centralizada da Marca: PALAS [ÍCONE DA CORUJA CONDICIONAL/DINÂMICO] ATLAS */}
          <div className="flex flex-col items-start justify-center">
            <div className="flex items-center gap-2.5">
              {/* PALAS - Ouro-champanhe fosco (~20% maior) */}
              <span className="font-serif font-bold text-base sm:text-lg tracking-[0.2em] text-[#d4af37] leading-none transition-colors group-hover:text-amber-200">
                PALAS
              </span>

              {/* Ícone da Coruja Vetorial Puro: Exclusivo da Home, com desaparecimento fluido no scroll */}
              {isHome && (
                <span
                  className={`flex items-center justify-center transition-all duration-300 ease-in-out overflow-hidden text-[#d4af37] ${
                    isScrolled
                      ? 'opacity-0 scale-75 max-w-0 -mr-2.5 pointer-events-none'
                      : 'opacity-100 scale-100 max-w-[48px] pointer-events-auto'
                  }`}
                  aria-hidden={isScrolled}
                >
                  <svg
                    className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 transition-transform duration-300 group-hover:scale-105"
                    viewBox="0 0 400 400"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M 164.5 78.0 L 181.0 77.5 L 186.0 79.5 L 192.5 85.0 L 196.5 95.0 L 196.0 120.5 L 194.0 120.5 L 184.5 115.0 L 184.5 98.0 L 183.5 94.0 L 179.0 89.5 L 168.0 89.5 L 161.0 92.5 L 155.5 98.0 L 153.5 103.0 L 154.5 113.0 L 161.5 122.0 L 161.5 127.0 L 159.0 129.5 L 154.0 130.5 L 147.5 125.0 L 142.5 116.0 L 141.5 107.0 L 137.0 106.5 L 128.0 111.5 L 122.5 117.0 L 118.5 125.0 L 119.0 126.5 L 127.0 128.5 L 136.5 134.0 L 138.5 137.0 L 138.5 141.0 L 135.0 144.5 L 132.0 145.5 L 122.0 139.5 L 112.0 139.5 L 107.0 142.5 L 104.0 142.5 L 94.5 138.0 L 99.0 132.5 L 105.5 129.0 L 105.5 125.0 L 110.5 113.0 L 121.0 101.5 L 132.0 95.5 L 139.0 93.5 L 144.0 93.5 L 150.0 85.5 L 157.0 80.5 L 164.0 78.5 Z M 217.5 78.0 L 234.0 77.5 L 240.0 79.5 L 249.0 85.5 L 255.0 93.5 L 264.0 94.5 L 277.0 100.5 L 283.5 106.0 L 288.5 113.0 L 293.5 125.0 L 293.5 129.0 L 300.0 132.5 L 305.5 138.0 L 304.0 139.5 L 295.0 142.5 L 292.0 142.5 L 284.0 138.5 L 273.0 139.5 L 269.0 141.5 L 263.5 147.0 L 260.0 154.5 L 253.0 157.5 L 251.0 159.5 L 249.0 159.5 L 248.5 153.0 L 253.5 140.0 L 262.0 131.5 L 270.0 127.5 L 280.0 126.5 L 280.5 124.0 L 276.5 117.0 L 271.0 111.5 L 262.0 106.5 L 258.0 106.5 L 256.5 116.0 L 251.5 125.0 L 245.0 130.5 L 240.0 129.5 L 237.5 127.0 L 237.5 122.0 L 241.5 118.0 L 245.5 110.0 L 244.5 100.0 L 238.0 92.5 L 232.0 89.5 L 220.0 89.5 L 215.5 94.0 L 214.5 98.0 L 214.5 125.0 L 215.5 129.0 L 220.0 134.5 L 226.0 137.5 L 233.0 138.5 L 236.5 142.0 L 236.5 147.0 L 233.0 150.5 L 228.0 150.5 L 218.0 147.5 L 216.0 145.5 L 214.5 147.0 L 214.5 161.0 L 204.0 160.5 L 202.5 159.0 L 202.5 146.0 L 205.5 139.0 L 205.5 136.0 L 202.5 129.0 L 202.5 95.0 L 206.5 85.0 L 211.0 80.5 L 217.0 78.5 Z M 169.5 109.0 L 174.0 108.5 L 176.0 109.5 L 178.5 113.0 L 180.5 120.0 L 185.0 120.5 L 189.0 122.5 L 193.5 127.0 L 195.5 131.0 L 196.5 135.0 L 196.5 159.0 L 195.0 160.5 L 184.5 161.0 L 184.5 137.0 L 182.0 132.5 L 180.0 132.5 L 177.5 137.0 L 171.0 143.5 L 158.0 149.5 L 152.5 155.0 L 150.0 160.5 L 140.5 154.0 L 140.5 151.0 L 146.0 143.5 L 153.0 138.5 L 164.0 133.5 L 167.5 130.0 L 168.5 128.0 L 168.5 121.0 L 165.5 116.0 L 165.5 113.0 L 169.0 109.5 Z M 47.5 124.0 L 49.0 123.5 L 69.0 134.5 L 71.0 134.5 L 86.0 141.5 L 133.0 156.5 L 144.0 162.5 L 152.5 171.0 L 157.5 181.0 L 160.0 181.5 L 165.5 187.0 L 165.5 189.0 L 160.5 196.0 L 158.5 203.0 L 158.5 211.0 L 162.5 223.0 L 167.5 230.0 L 178.0 238.5 L 187.0 242.5 L 196.0 243.5 L 197.0 244.5 L 203.0 244.5 L 215.0 241.5 L 227.0 234.5 L 234.5 226.0 L 239.5 216.0 L 240.5 204.0 L 238.5 196.0 L 233.5 189.0 L 233.5 187.0 L 239.0 181.5 L 241.0 181.5 L 242.5 180.0 L 242.5 178.0 L 246.5 171.0 L 255.0 162.5 L 266.0 156.5 L 278.0 153.5 L 323.0 137.5 L 342.0 128.5 L 350.0 123.5 L 352.5 124.0 L 352.5 132.0 L 347.5 146.0 L 339.0 156.5 L 332.0 161.5 L 320.0 167.5 L 304.5 173.0 L 308.0 173.5 L 309.0 172.5 L 318.0 171.5 L 332.0 167.5 L 342.0 162.5 L 345.5 163.0 L 345.5 166.0 L 341.5 176.0 L 332.0 186.5 L 317.0 193.5 L 294.5 197.0 L 305.0 197.5 L 306.0 198.5 L 325.0 197.5 L 326.5 199.0 L 320.0 207.5 L 311.0 213.5 L 300.0 216.5 L 286.0 216.5 L 285.0 215.5 L 277.0 214.5 L 278.0 216.5 L 284.0 219.5 L 295.5 223.0 L 295.5 225.0 L 294.0 226.5 L 287.0 230.5 L 281.0 232.5 L 270.0 232.5 L 258.0 227.5 L 250.0 227.5 L 245.0 230.5 L 235.0 242.5 L 220.0 251.5 L 210.0 254.5 L 190.0 254.5 L 177.0 250.5 L 168.0 245.5 L 160.5 239.0 L 153.0 229.5 L 149.0 227.5 L 141.0 227.5 L 130.0 232.5 L 118.0 232.5 L 108.0 228.5 L 103.5 225.0 L 104.0 222.5 L 115.0 219.5 L 121.0 216.5 L 122.0 214.5 L 114.0 216.5 L 99.0 216.5 L 88.0 213.5 L 80.0 208.5 L 74.5 202.0 L 73.5 200.0 L 74.0 197.5 L 94.0 198.5 L 95.0 197.5 L 104.5 197.0 L 98.0 195.5 L 91.0 195.5 L 76.0 191.5 L 66.0 185.5 L 59.5 179.0 L 54.5 169.0 L 54.0 162.5 L 73.0 169.5 L 85.0 172.5 L 90.0 172.5 L 91.0 173.5 L 94.5 173.0 L 79.0 167.5 L 67.0 161.5 L 56.5 153.0 L 49.5 142.0 L 46.5 130.0 L 47.0 124.5 Z M 156.5 162.0 L 158.0 161.5 L 164.0 167.5 L 171.0 171.5 L 174.0 171.5 L 179.0 168.5 L 182.0 168.5 L 190.0 165.5 L 209.0 165.5 L 220.0 168.5 L 225.0 171.5 L 229.0 171.5 L 242.0 161.5 L 242.5 170.0 L 240.5 175.0 L 233.0 183.5 L 225.5 189.0 L 226.0 190.5 L 229.0 191.5 L 232.5 195.0 L 234.5 199.0 L 234.5 208.0 L 233.5 210.0 L 228.0 215.5 L 224.0 217.5 L 217.0 217.5 L 209.5 213.0 L 206.0 205.5 L 200.0 210.5 L 193.0 205.5 L 190.5 212.0 L 185.0 216.5 L 175.0 217.5 L 171.0 215.5 L 165.5 210.0 L 164.5 199.0 L 166.5 195.0 L 170.0 191.5 L 173.0 190.5 L 173.5 189.0 L 167.0 184.5 L 157.5 173.0 L 156.5 163.0 Z M 175.0 196.5 L 171.5 200.0 L 171.5 206.0 L 176.0 210.5 L 181.0 210.5 L 186.5 205.0 L 178.0 205.5 L 175.5 203.0 L 175.5 197.0 Z M 224.0 196.5 L 224.5 201.0 L 221.0 205.5 L 212.5 205.0 L 216.0 209.5 L 223.0 210.5 L 226.5 208.0 L 228.5 203.0 L 227.5 200.0 L 224.5 197.0 Z M 197.5 213.0 L 201.0 212.5 L 208.5 220.0 L 200.0 235.5 L 197.5 234.0 L 191.5 221.0 L 191.5 218.0 L 197.0 213.5 Z M 77.5 214.0 L 79.0 213.5 L 88.5 219.0 L 89.5 221.0 L 89.5 229.0 L 92.5 236.0 L 98.0 242.5 L 105.0 246.5 L 113.0 248.5 L 121.0 248.5 L 121.5 241.0 L 120.5 240.0 L 122.0 238.5 L 124.0 237.5 L 132.0 237.5 L 133.5 239.0 L 134.5 247.0 L 142.5 255.0 L 135.0 263.5 L 133.0 263.5 L 128.0 259.5 L 124.0 259.5 L 123.0 260.5 L 104.5 260.0 L 109.5 273.0 L 116.0 280.5 L 125.0 286.5 L 130.0 288.5 L 133.5 288.0 L 133.5 281.0 L 135.5 274.0 L 139.5 266.0 L 148.0 257.5 L 159.0 252.5 L 167.0 252.5 L 169.5 255.0 L 170.5 258.0 L 169.5 261.0 L 167.0 263.5 L 159.0 265.5 L 153.0 269.5 L 148.5 275.0 L 145.5 283.0 L 145.5 291.0 L 149.5 300.0 L 158.0 307.5 L 164.0 309.5 L 177.0 309.5 L 182.5 305.0 L 184.5 299.0 L 184.5 259.0 L 195.0 259.5 L 196.5 261.0 L 196.5 304.0 L 192.5 313.0 L 185.0 319.5 L 179.0 321.5 L 168.0 322.5 L 167.0 321.5 L 157.0 320.5 L 149.0 316.5 L 139.5 307.0 L 137.0 302.5 L 119.0 297.5 L 110.0 291.5 L 101.5 283.0 L 97.5 277.0 L 92.5 263.0 L 92.5 254.0 L 83.5 245.0 L 78.5 236.0 L 77.5 228.0 L 76.5 227.0 L 76.5 217.0 L 77.5 215.0 Z M 319.5 214.0 L 321.0 213.5 L 322.5 217.0 L 322.5 228.0 L 320.5 236.0 L 315.5 245.0 L 306.5 255.0 L 306.5 263.0 L 300.5 279.0 L 288.0 292.5 L 275.0 299.5 L 268.0 301.5 L 263.0 301.5 L 257.5 310.0 L 253.0 314.5 L 242.0 320.5 L 232.0 321.5 L 231.0 322.5 L 220.0 321.5 L 214.0 319.5 L 206.5 313.0 L 202.5 303.0 L 202.5 261.0 L 204.0 259.5 L 214.5 259.0 L 214.5 299.0 L 215.5 300.0 L 215.5 304.0 L 217.5 307.0 L 222.0 309.5 L 235.0 309.5 L 239.0 308.5 L 244.0 305.5 L 249.5 300.0 L 253.5 291.0 L 253.5 283.0 L 250.5 275.0 L 246.5 270.0 L 247.5 263.0 L 250.0 261.5 L 254.0 261.5 L 259.5 266.0 L 262.5 271.0 L 265.5 280.0 L 266.0 288.5 L 272.0 287.5 L 282.0 281.5 L 289.5 273.0 L 293.5 265.0 L 293.5 261.0 L 294.5 260.0 L 278.0 260.5 L 277.0 259.5 L 269.0 258.5 L 263.5 253.0 L 264.5 249.0 L 268.0 246.5 L 273.0 246.5 L 279.0 248.5 L 286.0 248.5 L 298.0 244.5 L 305.5 238.0 L 309.5 230.0 L 310.5 219.0 L 319.0 214.5 Z M 250.5 233.0 L 256.0 232.5 L 259.0 233.5 L 260.5 235.0 L 259.5 242.0 L 254.5 250.0 L 239.5 262.0 L 237.5 266.0 L 237.5 274.0 L 242.5 282.0 L 242.5 285.0 L 240.0 288.5 L 235.0 289.5 L 230.5 286.0 L 225.5 277.0 L 225.5 272.0 L 224.5 271.0 L 225.5 263.0 L 229.5 255.0 L 246.5 240.0 L 248.5 234.0 L 250.0 233.5 Z"
                    />
                  </svg>
                </span>
              )}

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

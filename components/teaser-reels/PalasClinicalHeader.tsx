'use client';

import React from 'react';
import { PalasOwlIcon } from '@/components/teaser/PalasBrandMark';

interface PalasClinicalLogoProps {
  theme?: 'light-bg' | 'dark-bg';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  wingAngleDeg?: number;
  className?: string;
}

/**
 * Official Palas Atlas brand mark matching js/brand-logo.js & css/splash.css
 */
export function PalasClinicalLogo({
  theme = 'light-bg',
  size = 'md',
  showSubtitle = false,
  wingAngleDeg = 0,
  className = '',
}: PalasClinicalLogoProps) {
  const isDark = theme === 'dark-bg';

  const scale = {
    xs: { text: 'text-[22px] tracking-[0.18em]', owl: 'w-7 h-7', sub: 'text-[11px] tracking-[0.26em] mt-1.5', gap: 'gap-2.5' },
    sm: { text: 'text-[28px] tracking-[0.18em]', owl: 'w-8 h-8', sub: 'text-[12px] tracking-[0.26em] mt-1.5', gap: 'gap-3' },
    md: { text: 'text-[36px] tracking-[0.2em]', owl: 'w-11 h-11', sub: 'text-[14px] tracking-[0.28em] mt-2', gap: 'gap-3.5' },
    lg: { text: 'text-[48px] tracking-[0.22em]', owl: 'w-14 h-14', sub: 'text-[16px] tracking-[0.3em] mt-2.5', gap: 'gap-4' },
    xl: { text: 'text-[60px] tracking-[0.22em]', owl: 'w-16 h-16', sub: 'text-[18px] tracking-[0.32em] mt-3', gap: 'gap-5' },
  }[size];

  const palasColor = isDark ? 'text-[#f4f2ed]' : 'text-[#0f172a]';
  const atlasColor = isDark ? 'text-[#d4af37]' : 'text-[#0369a1]';
  const subColor = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`inline-flex flex-col items-center select-none ${className}`}>
      <div className={`flex items-center ${scale.gap}`}>
        <span className={`font-display font-bold leading-none ${scale.text} ${palasColor}`}>
          PALAS
        </span>
        <span
          className={`flex items-center justify-center ${atlasColor}`}
          style={{
            transform: wingAngleDeg ? `scale(${1 - Math.abs(wingAngleDeg) * 0.008})` : undefined,
            filter: isDark
              ? 'drop-shadow(0 0 14px rgba(212,175,55,0.4))'
              : 'drop-shadow(0 2px 10px rgba(3,105,161,0.22))',
          }}
        >
          <PalasOwlIcon className={scale.owl} />
        </span>
        <span className={`font-display font-bold leading-none ${scale.text} ${atlasColor}`}>
          ATLAS
        </span>
      </div>
      {showSubtitle && (
        <span className={`font-sans uppercase font-semibold leading-none ${scale.sub} ${subColor}`}>
          Atlas Morfológico Digital
        </span>
      )}
    </div>
  );
}

interface PalasClinicalHeaderProps {
  showMicroscopeControls?: boolean;
  markersVisible?: boolean;
  markersCount?: number;
  breadcrumb?: string;
}

/**
 * Replicates the authentic top header bar from index.html & microscopio.html
 */
export function PalasClinicalHeader({
  showMicroscopeControls = false,
  markersVisible = true,
  markersCount = 4,
  breadcrumb,
}: PalasClinicalHeaderProps) {
  return (
    <div className="w-full bg-white/[0.96] border-b border-slate-200 shadow-[0_6px_28px_-6px_rgba(15,23,42,0.08)] shrink-0">
      <div className="h-[3px] w-full bg-gradient-to-r from-slate-900 via-[#0369a1] to-slate-900" />
      <div className="px-7 h-[86px] flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {showMicroscopeControls && (
            <>
              <div className="h-12 px-4 rounded-2xl bg-slate-100 border border-slate-200/90 flex items-center gap-2 text-[17px] font-semibold text-slate-700 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Voltar</span>
              </div>
              <span className="h-7 w-px bg-slate-200 shrink-0" />
            </>
          )}

          <PalasClinicalLogo theme="light-bg" size="xs" showSubtitle={false} />

          {breadcrumb && (
            <span className="ml-2 text-[16px] text-slate-500 font-medium truncate">
              {breadcrumb}
            </span>
          )}
        </div>

        {showMicroscopeControls ? (
          <div className="flex items-center gap-3 shrink-0">
            <div
              className={`h-12 px-4 flex items-center gap-2.5 rounded-2xl border transition-colors ${
                markersVisible
                  ? 'bg-[#f0fdfa] text-[#0f766e] border-[#5eead4]'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" />
                <circle cx="12" cy="12" r="8" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
              </svg>
              <span className="text-[16px] font-semibold">Marcações</span>
              <span className="px-2 py-0.5 rounded-full text-[14px] font-mono font-bold bg-teal-600 text-white leading-none">
                {markersCount}
              </span>
            </div>

            <div className="h-12 px-4 flex items-center gap-2 rounded-2xl bg-slate-100 border border-slate-200/90 text-slate-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
                <path d="M15 4.5v15" />
                <rect x="15" y="4.5" width="6" height="15" rx="2" fill="currentColor" opacity="0.32" stroke="none" />
              </svg>
              <span className="text-[16px] font-semibold">Painel</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[15px] font-semibold tracking-wide">
              Acesso Aberto
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

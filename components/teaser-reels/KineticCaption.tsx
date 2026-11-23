'use client';

import React from 'react';
import { EASE_OUT_EXPO, EASE_SMOOTH, clamp01, remap } from './timeline';

interface KineticCaptionProps {
  t: number;
  start: number;
  end: number;
  eyebrow?: string;
  headline: React.ReactNode;
  subline?: string;
  position?: 'top' | 'bottom';
  variant?: 'light' | 'dark';
}

/**
 * Editorial Instagram Reels on-screen caption positioned strictly inside Reels Safe Zones
 * with gentle, unhurried fade-in (0.60s) and fade-out (0.48s) transitions.
 */
export function KineticCaption({
  t,
  start,
  end,
  eyebrow,
  headline,
  subline,
  position = 'top',
  variant = 'light',
}: KineticCaptionProps) {
  if (t < start || t > end) return null;

  const enterP = remap(t, start, start + 0.6, 0, 1, EASE_OUT_EXPO);
  const exitP = remap(t, end - 0.48, end, 1, 0, EASE_SMOOTH);
  const opacity = clamp01(Math.min(enterP, exitP));
  const translateY = (1 - enterP) * (position === 'top' ? -14 : 14);

  const isDark = variant === 'dark';

  return (
    <div
      className="absolute inset-x-0 z-40 px-12 flex justify-center pointer-events-none"
      style={{
        top: position === 'top' ? 156 : undefined,
        bottom: position === 'bottom' ? 328 : undefined,
        opacity,
        transform: `translate3d(0, ${translateY.toFixed(2)}px, 0)`,
      }}
    >
      <div
        className={`max-w-[900px] text-center px-8 py-5 rounded-3xl border shadow-[0_20px_50px_rgba(15,23,42,0.18)] ${
          isDark
            ? 'bg-slate-950/[0.88] border-white/15 text-white'
            : 'bg-white/[0.95] border-slate-200/90 text-slate-950'
        }`}
      >
        {eyebrow && (
          <div
            className={`font-mono text-[16px] uppercase tracking-[0.26em] font-semibold mb-1.5 ${
              isDark ? 'text-teal-300' : 'text-[#0369a1]'
            }`}
          >
            {eyebrow}
          </div>
        )}
        <div className="font-serif font-extrabold text-[42px] leading-[1.12] tracking-tight">
          {headline}
        </div>
        {subline && (
          <p
            className={`font-sans text-[22px] font-medium mt-2 leading-snug ${
              isDark ? 'text-slate-300' : 'text-slate-600'
            }`}
          >
            {subline}
          </p>
        )}
      </div>
    </div>
  );
}

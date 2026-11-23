'use client';

import React from 'react';
import { ArrowUpRight, Globe } from 'lucide-react';
import { PalasOwlIcon } from '@/components/teaser/PalasBrandMark';
import { EASE_OUT_EXPO, EASE_OVERSHOOT, clamp01, remap } from '../timeline';
import { PalasClinicalLogo } from '../PalasClinicalHeader';

interface Scene5OutroCTAProps {
  t: number;
}

export function Scene5OutroCTA({ t }: Scene5OutroCTAProps) {
  if (t < 22.15) return null;

  const enterP = remap(t, 22.15, 22.95, 0, 1, EASE_OUT_EXPO);
  const logoP = remap(t, 22.35, 23.25, 0, 1, EASE_OUT_EXPO);
  const headlineP = remap(t, 22.75, 23.65, 0, 1, EASE_OUT_EXPO);
  const ctaP = remap(t, 23.2, 24.05, 0, 1, EASE_OVERSHOOT);

  const wingDeg = Math.sin((t - 22.4) * 1.4) * 1.4;

  const shimmerCycle = ((t - 23.1) * 0.55) % 1.4;
  const shimmerX = shimmerCycle <= 1.0 ? -120 + shimmerCycle * 340 : 220;

  return (
    <div
      className="absolute inset-0 bg-gradient-to-b from-[#edf4f3] via-[#f8fafc] to-white text-slate-950 flex flex-col items-center justify-center overflow-hidden px-12"
      style={{ opacity: enterP }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(15, 23, 42, 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.035) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1080px] h-[1080px] text-teal-950 pointer-events-none select-none flex items-center justify-center"
        style={{ opacity: 0.042 }}
      >
        <PalasOwlIcon className="w-full h-full" />
      </div>

      <div
        className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[780px] h-[780px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(3,105,161,0.12) 0%, rgba(13,148,136,0.08) 45%, transparent 72%)',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-[880px] -mt-10">
        <div
          style={{
            opacity: logoP,
            transform: `translate3d(0, ${((1 - logoP) * 22).toFixed(1)}px, 0) scale(${(
              0.94 +
              logoP * 0.06
            ).toFixed(3)})`,
          }}
        >
          <PalasClinicalLogo
            theme="light-bg"
            size="xl"
            showSubtitle
            wingAngleDeg={wingDeg}
          />
        </div>

        <div
          className="my-10 h-[3px] rounded-full bg-gradient-to-r from-slate-900 via-[#0369a1] to-teal-600"
          style={{
            width: `${Math.round(logoP * 180)}px`,
            opacity: logoP,
          }}
        />

        <div
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mb-8"
          style={{
            opacity: headlineP,
            transform: `translate3d(0, ${((1 - headlineP) * 16).toFixed(1)}px, 0)`,
          }}
        >
          {[
            { name: 'Histologia', dot: 'bg-sky-600' },
            { name: 'Anatomia', dot: 'bg-[#0369a1]' },
            { name: 'Patologia', dot: 'bg-rose-600' },
            { name: 'Parasitologia', dot: 'bg-emerald-600' },
            { name: 'Microbiologia', dot: 'bg-violet-600' },
          ].map((d) => (
            <span
              key={d.name}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200/90 shadow-sm text-[18px] font-semibold text-slate-700"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${d.dot}`} />
              {d.name}
            </span>
          ))}
        </div>

        <h2
          className="font-serif font-extrabold text-[60px] leading-[1.1] tracking-tight text-slate-950 mb-10"
          style={{
            opacity: headlineP,
            transform: `translate3d(0, ${((1 - headlineP) * 18).toFixed(1)}px, 0)`,
          }}
        >
          Chegue pronto na{' '}
          <span className="text-[#0369a1]">prova prática.</span>
        </h2>

        <div
          className="flex flex-col items-center gap-5"
          style={{
            opacity: clamp01(ctaP),
            transform: `scale(${(0.92 + ctaP * 0.08).toFixed(3)})`,
          }}
        >
          <div className="relative overflow-hidden inline-flex items-center gap-3.5 px-10 py-6 rounded-2xl bg-slate-900 text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] border border-slate-800">
            <span className="font-sans font-bold text-[26px] tracking-tight">
              Acesse gratuitamente no link da bio
            </span>
            <ArrowUpRight className="w-7 h-7 text-[#d4af37]" />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 pointer-events-none"
              style={{ transform: `translateX(${shimmerX.toFixed(1)}%) skewX(-18deg)` }}
            />
          </div>

          <div className="inline-flex items-center gap-3 px-7 py-3.5 rounded-full bg-white border-2 border-[#0369a1]/30 shadow-md">
            <Globe className="w-5 h-5 text-[#0369a1]" />
            <span className="font-mono font-bold text-[24px] tracking-wide text-[#0369a1]">
              palasatlas.netlify.app
            </span>
          </div>

          <p className="font-sans text-[19px] font-medium text-slate-500 mt-1">
            100% gratuito &bull; Sem cadastro &bull; Feito para estudantes de medicina
          </p>
        </div>
      </div>
    </div>
  );
}

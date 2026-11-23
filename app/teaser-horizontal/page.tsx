'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Film, Monitor } from 'lucide-react';
import { PalasHorizontalTeaser } from '@/components/teaser-horizontal/PalasHorizontalTeaser';
import { PalasClinicalLogo } from '@/components/teaser-reels/PalasClinicalHeader';

function TeaserHorizontalContent() {
  const searchParams = useSearchParams();
  const isRecordOnly = searchParams.get('record') === '1';
  const isDeterministic = searchParams.get('deterministic') === '1';
  const tParam = Number(searchParams.get('t') || '0');
  const initialTimeSec = Number.isFinite(tParam) ? tParam : 0;

  if (isRecordOnly) {
    return (
      <main className="w-[1920px] h-[1080px] m-0 p-0 bg-black overflow-hidden">
        <PalasHorizontalTeaser
          recordMode
          deterministicMode={isDeterministic}
          initialTimeSec={initialTimeSec}
        />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#060911] text-slate-100 flex flex-col">
      <header className="w-full border-b border-white/10 bg-[#090d16]/90 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-xl transition-colors no-underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao Atlas</span>
            </Link>
            <span className="h-4 w-px bg-white/10 hidden sm:inline-block" />
            <div className="scale-[0.55] origin-left -my-2 hidden sm:block">
              <PalasClinicalLogo theme="dark-bg" size="xs" showSubtitle={false} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 font-mono text-[10px] text-slate-300">
              <Monitor className="w-3 h-3 text-teal-400" />
              <span>Widescreen 16:9 • 1920×1080 • 60fps</span>
            </span>
            <Link
              href="/teaser-horizontal?record=1"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-600/20 hover:bg-teal-600/30 border border-teal-400/40 text-xs font-semibold text-teal-200 transition-colors no-underline"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Abrir Modo Gravação</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6">
        <PalasHorizontalTeaser
          recordMode={false}
          deterministicMode={isDeterministic}
          initialTimeSec={initialTimeSec}
        />
      </main>
    </div>
  );
}

export default function TeaserHorizontalPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#060911] flex items-center justify-center text-slate-400 font-mono text-xs">
          Carregando composição Palas Atlas Horizontal (1920×1080)...
        </div>
      }
    >
      <TeaserHorizontalContent />
    </Suspense>
  );
}

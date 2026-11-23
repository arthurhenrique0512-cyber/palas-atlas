'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Film, MonitorSmartphone } from 'lucide-react';
import { AnatomicalTeaserReel } from '@/components/teaser';
import { PalasBrandMark } from '@/components/teaser/PalasBrandMark';

function TeaserPageContent() {
  const searchParams = useSearchParams();
  const isRecordOnly = searchParams.get('record') === '1';
  const rawT = parseFloat(searchParams.get('t') || '0');
  const initialTimeSec = Number.isFinite(rawT) ? rawT : 0;
  const paused = searchParams.get('paused') === '1';

  if (isRecordOnly) {
    return (
      <main className="min-h-screen w-full bg-black flex items-center justify-center p-0 m-0 overflow-hidden">
        <AnatomicalTeaserReel
          autoPlay={!paused}
          loop
          recordMode
          initialTimeSec={initialTimeSec}
          showStudioControls={false}
        />
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070c] text-slate-100 flex flex-col selection:bg-[#d4af37]/30 selection:text-white">
      {/* Studio Top Bar */}
      <header className="w-full border-b border-white/10 bg-[#070a12]/80 backdrop-blur-md sticky top-0 z-50">
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
            <PalasBrandMark size="xs" showSubtitle={false} className="hidden sm:inline-flex" />
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 font-mono text-[10px] text-slate-300">
              <MonitorSmartphone className="w-3 h-3 text-teal-400" />
              <span>9:16 Reels / Stories</span>
            </span>
            <Link
              href="/teaser?record=1"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/40 text-xs font-semibold text-[#f3dca2] transition-colors no-underline"
            >
              <Film className="w-3.5 h-3.5" />
              <span>Abrir Modo Gravação</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Studio Preview Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-8">
        <AnatomicalTeaserReel
          autoPlay={!paused}
          loop
          showStudioControls
          initialTimeSec={initialTimeSec}
          ctaHref="https://palasatlas.com"
          siteUrlLabel="palasatlas.com"
        />
      </main>
    </div>
  );
}

export default function TeaserPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#05070c] flex items-center justify-center text-slate-400 font-mono text-xs">
          Carregando estúdio 3D...
        </div>
      }
    >
      <TeaserPageContent />
    </Suspense>
  );
}

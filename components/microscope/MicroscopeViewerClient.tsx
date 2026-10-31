'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Lamina } from '@/lib/supabase/types';

const MicroscopeViewer = dynamic(
  () => import('./MicroscopeViewer').then((mod) => mod.MicroscopeViewer),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-screen bg-neutral-950 flex flex-col items-center justify-center text-neutral-400 font-mono text-xs select-none">
        <div className="w-10 h-10 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin mb-4" />
        <span className="uppercase tracking-widest text-[#d4af37]">Iniciando Estúdio Óptico...</span>
      </div>
    ),
  }
);

interface MicroscopeViewerClientProps {
  slide: Lamina;
}

export function MicroscopeViewerClient({ slide }: MicroscopeViewerClientProps) {
  return <MicroscopeViewer slide={slide} />;
}

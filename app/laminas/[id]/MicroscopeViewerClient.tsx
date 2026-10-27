'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';

export interface PinItem {
  id: string;
  rotulo?: string;
  x?: number;
  y?: number;
}

export interface SlideData {
  id: string;
  title: string;
  category?: string;
  stain?: string;
  specimen?: string;
  desc?: string;
  imageUrl?: string;
  dziUrl?: string;
  previewImage?: string;
  thumbnailUrl?: string;
  pinos?: PinItem[];
  maxMagnification?: number;
  mpp?: number;
}

interface MicroscopeViewerClientProps {
  initialSlide: SlideData | null;
  slideId: string;
}

export default function MicroscopeViewerClient({ initialSlide, slideId }: MicroscopeViewerClientProps) {
  const [slide, setSlide] = useState<SlideData | null>(initialSlide);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentZoom, setCurrentZoom] = useState<string>('4.0x');
  const [activeObjective, setActiveObjective] = useState<number>(4);

  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const osdViewerRef = useRef<any>(null);
  const homeZoomRef = useRef<number | null>(null);

  const initOpenSeadragon = useCallback(async (targetSlide: SlideData) => {
    if (!viewerContainerRef.current) return;
    if (typeof window === 'undefined') return;

    let OpenSeadragon = (window as any).OpenSeadragon;
    if (!OpenSeadragon) {
      try {
        const osdModule = await import('openseadragon');
        OpenSeadragon = osdModule.default || osdModule;
      } catch (e) {
        await new Promise<void>((resolve, reject) => {
          if ((window as any).OpenSeadragon) return resolve();
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/openseadragon.min.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Falha ao carregar OpenSeadragon via CDN.'));
          document.head.appendChild(script);
        });
        OpenSeadragon = (window as any).OpenSeadragon;
      }
    }

    if (!OpenSeadragon) {
      setErrorMessage('Não foi possível carregar a biblioteca de Deep Zoom.');
      setIsLoading(false);
      return;
    }

    if (osdViewerRef.current) {
      try {
        osdViewerRef.current.destroy();
      } catch (e) {}
      osdViewerRef.current = null;
    }

    const resolvedUrl = targetSlide.dziUrl || targetSlide.imageUrl || targetSlide.previewImage || '';
    if (!resolvedUrl) {
      setErrorMessage('Nenhum arquivo de imagem ou DZI cadastrado para esta lâmina.');
      setIsLoading(false);
      return;
    }

    const isDzi = resolvedUrl.endsWith('.dzi') || resolvedUrl.includes('.dzi?');
    const tileSources = isDzi ? resolvedUrl : { type: 'image', url: resolvedUrl };
    const maxMag = Number(targetSlide.maxMagnification) || 40;
    const maxZoomMap: Record<number, number> = { 40: 1.2, 60: 1.8, 100: 2.5 };
    const maxZoomPixelRatio = maxZoomMap[maxMag] || 1.2;

    let fallbackTried = false;

    try {
      const viewer = OpenSeadragon({
        element: viewerContainerRef.current,
        prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/',
        tileSources: tileSources,
        showNavigationControl: false,
        showSequenceControl: false,
        showHomeControl: false,
        showFullPageControl: false,
        showZoomControl: false,
        showNavigator: true,
        navigatorPosition: 'BOTTOM_RIGHT',
        navigatorWidth: '120px',
        navigatorHeight: '90px',
        navigatorBackground: 'rgba(10,10,10,0.9)',
        navigatorBorderColor: 'rgba(59,130,246,0.35)',
        navigatorAutoFade: false,
        animationTime: 0.45,
        blendTime: 0.1,
        maxZoomPixelRatio: maxZoomPixelRatio,
        panHorizontal: true,
        panVertical: true,
        constrainDuringPan: true,
        visibilityRatio: 0.8,
        minZoomImageRatio: 0.9,
        gestureSettingsMouse: {
          scrollToZoom: true,
          clickToZoom: false,
          dblClickToZoom: false,
          dragToPan: true
        },
        gestureSettingsTouch: {
          pinchToZoom: true,
          flickEnabled: false,
          dragToPan: true,
          dblClickToZoom: false,
          pinchRotate: false
        }
      });

      osdViewerRef.current = viewer;

      // Event: Open Success (Desativa loading imediatamente)
      viewer.addHandler('open', () => {
        setIsLoading(false);
        setErrorMessage(null);

        if (viewer.viewport) {
          const home = viewer.viewport.getHomeZoom();
          homeZoomRef.current = home;
          viewer.viewport.minZoomLevel = home * 0.9;
          viewer.viewport.maxZoomLevel = home * (maxMag / 4);
          viewer.viewport.zoomTo(home, null, true);
        }
      });

      // Event: Open Failed (Fallback e desativação de loading com erro claro)
      viewer.addHandler('open-failed', (event: any) => {
        console.warn('[Palas Atlas App] OpenSeadragon falhou ao carregar recurso:', event);
        const fallback = targetSlide.previewImage || targetSlide.thumbnailUrl || '';
        if (!fallbackTried && isDzi && fallback && fallback !== resolvedUrl) {
          fallbackTried = true;
          try {
            viewer.open({ type: 'image', url: fallback });
            return;
          } catch (e) {}
        }
        setIsLoading(false);
        setErrorMessage(`Não foi possível carregar o arquivo da lâmina (${resolvedUrl}).`);
      });

      const updateZoom = () => {
        if (!viewer || !viewer.viewport) return;
        const currentOSDZoom = viewer.viewport.getZoom(true);
        const homeZoom = homeZoomRef.current || viewer.viewport.getHomeZoom();
        if (homeZoom > 0) {
          const mag = Math.min((currentOSDZoom / homeZoom) * 4, maxMag);
          setCurrentZoom(`${mag.toFixed(1)}x`);
        }
      };

      viewer.addHandler('zoom', updateZoom);
      viewer.addHandler('animation', updateZoom);

      // Timeout preventivo para desativar loading caso trave
      setTimeout(() => {
        setIsLoading(false);
      }, 4000);
    } catch (err: any) {
      console.error('[Palas Atlas App] Erro ao instanciar OpenSeadragon:', err);
      setIsLoading(false);
      setErrorMessage('Falha na inicialização do visualizador de microscopia.');
    }
  }, []);

  useEffect(() => {
    if (!initialSlide) {
      setIsLoading(false);
      setErrorMessage(`Lâmina não encontrada no acervo (${slideId}).`);
      return;
    }

    setSlide(initialSlide);
    initOpenSeadragon(initialSlide);

    return () => {
      if (osdViewerRef.current) {
        try {
          osdViewerRef.current.destroy();
        } catch (e) {}
        osdViewerRef.current = null;
      }
    };
  }, [initialSlide, slideId, initOpenSeadragon]);

  const switchObjective = (targetMag: number) => {
    if (!osdViewerRef.current || !osdViewerRef.current.viewport) return;
    const base = homeZoomRef.current || osdViewerRef.current.viewport.getHomeZoom();
    const targetZoom = base * (targetMag / 4);
    osdViewerRef.current.viewport.zoomTo(targetZoom, null, false);
    setActiveObjective(targetMag);
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-64px)] overflow-hidden bg-neutral-950 font-sans text-slate-200">
      <div className="flex flex-1 overflow-hidden">
        {/* Workspace do Microscópio */}
        <main className="relative flex-1 h-full bg-neutral-900 border-r border-neutral-800 overflow-hidden flex items-center justify-center">
          
          {/* Skeleton / Preloader */}
          {isLoading && (
            <div className="fixed inset-0 flex flex-col items-center justify-center z-[99999] bg-neutral-950/95 backdrop-blur-md select-none">
              <div className="flex flex-col items-center text-center">
                <div className="flex items-center gap-3">
                  <span className="font-serif font-bold text-2xl tracking-[0.24em] text-white">PALAS</span>
                  <div className="text-[#d4af37]">
                    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8z" />
                    </svg>
                  </div>
                  <span className="font-serif font-normal text-2xl tracking-[0.24em] text-[#d4af37]">ATLAS</span>
                </div>
                <p className="text-[11px] text-neutral-400 tracking-[0.25em] font-mono uppercase mt-4">
                  Mapeando estruturas morfológicas...
                </p>
              </div>
            </div>
          )}

          {/* Container explícito garantido */}
          <div
            ref={viewerContainerRef}
            id="osd-viewer"
            className={`w-full h-full min-h-[400px] bg-neutral-950 relative overflow-hidden transition-opacity duration-500 ${
              isLoading ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* Card de erro */}
          {errorMessage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/90 backdrop-blur-md p-6 text-center z-30">
              <div className="w-14 h-14 rounded-2xl bg-rose-950/40 border border-rose-900/60 flex items-center justify-center shadow-lg shadow-rose-950/20 mb-4">
                <svg className="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <h3 className="text-base font-semibold text-white tracking-wide">Falha no Carregamento</h3>
              <p className="text-rose-400 text-xs font-mono max-w-sm leading-relaxed mt-1 mb-6">
                {errorMessage}
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => slide && initOpenSeadragon(slide)}
                  className="px-4 py-2 text-xs font-mono font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-all cursor-pointer"
                >
                  Recarregar
                </button>
                <Link
                  href="/"
                  className="px-4 py-2 text-xs font-mono font-medium text-zinc-300 hover:text-white bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 rounded-xl transition-all"
                >
                  Voltar ao Início
                </Link>
              </div>
            </div>
          )}

          {/* Revólver de Objetivas */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 p-1.5 rounded-xl bg-zinc-900/95 border border-zinc-700/80 backdrop-blur-md shadow-2xl text-xs font-mono select-none">
            {[4, 10, 40, 60, 100].map(mag => {
              const maxMag = Number(slide?.maxMagnification) || 40;
              const isDisabled = mag > maxMag;
              const isSelected = activeObjective === mag;

              return (
                <button
                  key={mag}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => switchObjective(mag)}
                  className={`font-semibold px-3 py-1 rounded-lg transition-all ${
                    isDisabled
                      ? 'bg-zinc-800/40 text-zinc-600 cursor-not-allowed opacity-30'
                      : isSelected
                      ? 'bg-amber-600 text-white shadow-md'
                      : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 cursor-pointer'
                  }`}
                  title={isDisabled ? `Objetiva não disponível (Máx: ${maxMag}x)` : `${mag}x`}
                >
                  {mag}x
                </button>
              );
            })}

            <div className="w-[1px] h-4 bg-zinc-700/80 my-auto"></div>

            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-zinc-950/60 border border-zinc-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-amber-500 font-bold">{currentZoom}</span>
            </div>
          </div>
        </main>

        {/* Barra Lateral Histológica */}
        <aside className="w-[380px] h-full bg-neutral-950 text-slate-300 border-l border-neutral-800/80 text-sm leading-relaxed overflow-hidden flex flex-col z-40 shrink-0">
          <div className="p-6 border-b border-neutral-800 bg-neutral-900/40 shrink-0">
            <h2 className="text-xl font-serif font-bold text-white leading-tight tracking-tight">
              {slide?.title || 'Visualizador Histológico'}
            </h2>
            <p className="mt-2 text-xs font-mono text-neutral-400">
              {slide?.stain || 'Hematoxilina e Eosina (H&E)'}
            </p>
          </div>

          <div className="p-6 flex-1 overflow-y-auto bg-neutral-950 space-y-4">
            <p className="text-neutral-300 text-sm font-sans leading-loose">
              {slide?.desc || 'Estruturas histológicas digitalizadas em alta resolução.'}
            </p>

            {slide?.pinos && slide.pinos.length > 0 && (
              <div className="mt-8 border-t border-neutral-800 pt-6">
                <h4 className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4 font-mono">
                  Pontos de Interesse
                </h4>
                <div className="flex flex-col gap-2">
                  {slide.pinos.map(pin => (
                    <div
                      key={pin.id}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 border border-neutral-800 text-left"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
                        <span className="text-sm font-medium text-slate-200 truncate">
                          {pin.rotulo || 'Marcador'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

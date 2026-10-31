'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Lamina, Pino } from '@/lib/supabase/types';
import DOMPurify from 'dompurify';
import { ChevronRight, ChevronLeft, Plus, Minus, Maximize2, RotateCcw, AlertTriangle, Eye, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface MicroscopeViewerProps {
  slide: Lamina;
}

export function MicroscopeViewer({ slide }: MicroscopeViewerProps) {
  const viewerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const homeZoomRef = useRef<number | null>(null);

  const [currentMag, setCurrentMag] = useState<string>('4.0x');
  const [activeLens, setActiveLens] = useState<number>(4);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const maxMag = slide.max_magnification || 40;

  // 1. Funções de Calibração Óptica
  const getZoom4xRef = useCallback(() => {
    if (!viewerRef.current?.viewport) return 1.0;
    const baseHome = homeZoomRef.current || viewerRef.current.viewport.getHomeZoom() || 1.0;
    return baseHome * 0.28;
  }, []);

  const calcularZoomParaMagnificacao = useCallback((mag: number) => {
    const z4 = getZoom4xRef();
    const m = Number(mag) || 4;
    return z4 * (m / 4);
  }, [getZoom4xRef]);

  const calcularMagnificacaoOtica = useCallback(() => {
    if (!viewerRef.current?.viewport || !homeZoomRef.current) return 4;
    const z4 = getZoom4xRef();
    if (!z4 || z4 <= 0) return 4;

    const currentZoom = viewerRef.current.viewport.getZoom(true);
    const rawMag = 4 * (currentZoom / z4);

    if (Math.abs(rawMag - 4) < 0.2) return 4;
    if (Math.abs(rawMag - 10) < 0.3) return 10;
    if (Math.abs(rawMag - 40) < 0.8) return 40;
    if (Math.abs(rawMag - 60) < 1.0) return 60;
    if (Math.abs(rawMag - 100) < 1.5) return 100;

    return Math.max(4, Math.min(maxMag, Math.round(rawMag * 10) / 10));
  }, [getZoom4xRef, maxMag]);

  // 2. Focar Pino Interativo
  const focarPino = useCallback((pinoId: string) => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.viewport || !window.OpenSeadragon) return;

    const pino = slide.pinos?.find(p => String(p.id) === String(pinoId));
    if (!pino) return;

    const pontoViewport = viewer.viewport.imageToViewportCoordinates(
      new window.OpenSeadragon.Point(Number(pino.x) || 0, Number(pino.y) || 0)
    );

    const oldOverlay = document.getElementById('active-microscope-pin');
    if (oldOverlay) {
      try { viewer.removeOverlay(oldOverlay); } catch (e) {}
    }

    const pinElem = document.createElement('div');
    pinElem.id = 'active-microscope-pin';
    pinElem.style.cssText = 'pointer-events:none; position:relative; display:flex; align-items:center; justify-content:center; width:36px; height:36px; z-index:40;';
    pinElem.innerHTML = `
      <div class="animate-ping" style="position:absolute;width:100%;height:100%;background:rgba(212,175,55,0.45);border-radius:50%;"></div>
      <div style="position:relative;width:14px;height:14px;background:#d4af37;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 0 3px rgba(212,175,55,0.45),0 4px 16px rgba(0,0,0,0.8);"></div>
    `;

    viewer.addOverlay({
      element: pinElem,
      location: pontoViewport,
      placement: window.OpenSeadragon.Placement.CENTER
    });

    const homeZoom = homeZoomRef.current || viewer.viewport.getHomeZoom();
    let targetZoom = pino.zoom ? Number(pino.zoom) : homeZoom * 3.5;
    if (viewer.viewport.maxZoomLevel) {
      targetZoom = Math.min(targetZoom, viewer.viewport.maxZoomLevel * 0.95);
    }

    viewer.viewport.zoomTo(targetZoom, pontoViewport, false);
    viewer.viewport.panTo(pontoViewport, false);

    setTimeout(() => {
      try { viewer.removeOverlay(pinElem); } catch (e) {}
    }, 10000);
  }, [slide.pinos]);

  // 3. Trocar Lente
  const trocarLente = useCallback((desejada: number) => {
    const viewer = viewerRef.current;
    if (!viewer || !viewer.viewport) return;

    const clamped = Math.max(4, Math.min(maxMag, desejada));
    const targetZoom = calcularZoomParaMagnificacao(clamped);

    if (clamped <= 4) {
      const imgBounds = viewer.world.getItemAt(0)?.getBounds();
      const centerPoint = imgBounds ? imgBounds.getCenter() : viewer.viewport.getCenter();
      viewer.viewport.zoomTo(targetZoom, null, false);
      viewer.viewport.panTo(centerPoint, false);
    } else {
      viewer.viewport.zoomTo(targetZoom, null, false);
    }

    setActiveLens(clamped);
  }, [calcularZoomParaMagnificacao, maxMag]);

  // 4. Inicialização do OpenSeadragon
  useEffect(() => {
    let isCancelled = false;

    const initOSD = async () => {
      if (typeof window === 'undefined' || !containerRef.current) return;

      // Import dinâmico do OpenSeadragon
      const OpenSeadragonModule = (await import('openseadragon')).default;
      window.OpenSeadragon = OpenSeadragonModule;

      if (isCancelled) return;

      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch (e) {}
        viewerRef.current = null;
      }

      const imageUrl = slide.dzi_url || slide.preview_image || '';
      const isDzi = imageUrl.endsWith('.dzi') || imageUrl.includes('.dzi?');
      const tileSources = isDzi ? imageUrl : { type: 'image', url: imageUrl };

      try {
        const viewer = OpenSeadragonModule({
          element: containerRef.current,
          prefixUrl: 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.0/images/',
          tileSources: tileSources,
          showNavigationControl: false,
          showSequenceControl: false,
          showNavigator: true,
          navigatorPosition: 'BOTTOM_RIGHT',
          navigatorWidth: '120px',
          navigatorHeight: '90px',
          navigatorBackground: 'rgba(10,10,10,0.85)',
          navigatorBorderColor: 'rgba(212,175,55,0.35)',
          navigatorAutoFade: true,
          animationTime: 0.45,
          blendTime: 0.1,
          visibilityRatio: 0.2,
          minZoomImageRatio: 0.1,
          panHorizontal: true,
          panVertical: true,
          constrainDuringPan: true,
          gestureSettingsMouse: { scrollToZoom: true, clickToZoom: false, dblClickToZoom: true, dragToPan: true },
          gestureSettingsTouch: { pinchToZoom: true, flickEnabled: true, dragToPan: true, dblClickToZoom: true }
        });

        viewerRef.current = viewer;

        viewer.addHandler('open', () => {
          if (isCancelled) return;
          setIsLoading(false);
          setLoadError(null);

          homeZoomRef.current = viewer.viewport.getHomeZoom();
          const z4 = getZoom4xRef();
          const maxOSDZoom = calcularZoomParaMagnificacao(maxMag) * 1.05;

          (viewer.viewport as any).minZoomLevel = z4;
          (viewer.viewport as any).maxZoomLevel = maxOSDZoom;

          // Abre na ampliação padrão da lâmina (40x nativo se disponível)
          const targetInitialMag = maxMag >= 40 ? 40 : maxMag;
          const initialZoom = calcularZoomParaMagnificacao(targetInitialMag);

          let initialPoint = viewer.viewport.getCenter();
          if (slide.default_center) {
            initialPoint = new OpenSeadragonModule.Point(slide.default_center.x, slide.default_center.y);
          }

          viewer.viewport.zoomTo(initialZoom, initialPoint, true);
          viewer.viewport.panTo(initialPoint, true);
          setActiveLens(targetInitialMag);
        });

        const updateZoomInfo = () => {
          if (!viewerRef.current?.viewport || !homeZoomRef.current) return;
          const mag = calcularMagnificacaoOtica();
          const rounded = Math.round(mag * 10) / 10;
          setCurrentMag(`${rounded}x`);

          if (mag >= 30) setActiveLens(40);
          else if (mag >= 7) setActiveLens(10);
          else setActiveLens(4);
        };

        viewer.addHandler('animation', updateZoomInfo);
        viewer.addHandler('zoom', () => {
          const z4 = getZoom4xRef();
          const maxOSDZoom = calcularZoomParaMagnificacao(maxMag) * 1.05;
          const current = viewer.viewport.getZoom();

          if (current < z4) viewer.viewport.zoomTo(z4, null, true);
          else if (current > maxOSDZoom) viewer.viewport.zoomTo(maxOSDZoom, null, true);

          updateZoomInfo();
        });

        viewer.addHandler('open-failed', () => {
          if (slide.preview_image && slide.preview_image !== slide.dzi_url) {
            (viewer as any).open({ type: 'image', url: slide.preview_image });
          } else {
            setIsLoading(false);
            setLoadError('Não foi possível carregar a pirâmide de imagens DZI desta lâmina.');
          }
        });

      } catch (err: any) {
        setIsLoading(false);
        setLoadError(err?.message || 'Falha na inicialização do visualizador óptico.');
      }
    };

    initOSD();

    return () => {
      isCancelled = true;
      if (viewerRef.current) {
        try { viewerRef.current.destroy(); } catch (e) {}
        viewerRef.current = null;
      }
    };
  }, [slide, maxMag, calcularMagnificacaoOtica, calcularZoomParaMagnificacao, getZoom4xRef]);

  // 5. Interceptador de cliques em `.pin-link` na descrição HTML
  const handleDescriptionClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = (e.target as HTMLElement).closest('.pin-link, [data-pin-id]');
    if (target) {
      e.preventDefault();
      const pinId = target.getAttribute('data-pin-id') || target.getAttribute('href')?.replace('#', '');
      if (pinId) focarPino(pinId);
    }
  };

  const sanitizedDescription = typeof window !== 'undefined' && slide.descricao_html
    ? DOMPurify.sanitize(slide.descricao_html, { ADD_ATTR: ['data-pin-id'] })
    : (slide.descricao_html || '');

  return (
    <div className="w-full h-screen overflow-hidden flex flex-col bg-neutral-950 font-sans text-slate-200 select-none">
      
      {/* Barra Superior do Leitor */}
      <header className="shrink-0 w-full bg-neutral-950/90 backdrop-blur-md px-5 py-3 flex items-center justify-between border-b border-white/[0.08] z-50">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/${slide.disciplina_id || 'histologia'}`}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-white transition-all cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar ao Catálogo</span>
          </Link>
          <span className="text-neutral-700 hidden sm:block">|</span>
          <span className="text-xs text-neutral-400 truncate max-w-xs hidden sm:block font-serif">
            {slide.nome}
          </span>
        </div>

        {/* Central: Badge da Peça */}
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-white/[0.04] border border-white/[0.08] text-[#d4af37]">
            {slide.coloracao || 'H&E'}
          </span>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-white/[0.04] border border-white/[0.08] text-neutral-400">
            Máx: {maxMag}x
          </span>
        </div>

        {/* Direita: Toggle da Barra Lateral */}
        <button
          type="button"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="text-neutral-400 hover:text-[#d4af37] transition-colors p-1.5 rounded-lg hover:bg-white/[0.04]"
          title={isSidebarOpen ? 'Recolher painel lateral' : 'Expandir painel lateral'}
        >
          {isSidebarOpen ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </header>

      {/* Palco do Microscópio + Barra Lateral */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* Visualizador OSD */}
        <main className="relative flex-1 min-w-0 h-full bg-neutral-950 flex items-center justify-center">
          
          {/* Skeleton de carregamento */}
          {isLoading && (
            <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center z-30">
              <div className="w-10 h-10 border-2 border-[#d4af37]/30 border-t-[#d4af37] rounded-full animate-spin mb-4" />
              <p className="font-mono text-xs text-neutral-400 uppercase tracking-widest">
                Calibrando óptica morfológica...
              </p>
            </div>
          )}

          {/* Erro de carregamento */}
          {loadError && (
            <div className="absolute inset-0 bg-neutral-950 flex flex-col items-center justify-center z-30 p-6 text-center">
              <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
              <h3 className="text-white text-base font-semibold mb-1">Falha na Lâmina</h3>
              <p className="text-neutral-400 text-xs font-mono max-w-sm mb-4 leading-relaxed">{loadError}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/30 text-xs font-mono uppercase"
              >
                Recarregar Lâmina
              </button>
            </div>
          )}

          {/* Canvas do OpenSeadragon */}
          <div ref={containerRef} className="w-full h-full bg-neutral-950 relative overflow-hidden" />

          {/* Revólver de Objetivas Flutuante */}
          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 p-1.5 rounded-2xl bg-neutral-900/85 backdrop-blur-md border border-white/[0.08] shadow-2xl text-xs font-mono">
            {[4, 10, 40, 60, 100].map((magVal) => {
              const isDisabled = magVal > maxMag;
              const isActive = activeLens === magVal;

              return (
                <button
                  key={magVal}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => trocarLente(magVal)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                    isActive
                      ? 'bg-[#d4af37] text-neutral-950 font-bold shadow-md shadow-[#d4af37]/25 cursor-pointer'
                      : isDisabled
                      ? 'text-neutral-600 opacity-30 cursor-not-allowed'
                      : 'text-neutral-400 hover:text-white hover:bg-white/[0.06] cursor-pointer'
                  }`}
                  title={isDisabled ? `Indisponível (Máx: ${maxMag}x)` : `Objetiva ${magVal}x`}
                >
                  {magVal}x
                </button>
              );
            })}

            <div className="w-px h-4 bg-white/[0.08]" />

            <button
              type="button"
              onClick={() => viewerRef.current?.viewport?.zoomBy(1.35)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
              title="Aproximar (+)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => viewerRef.current?.viewport?.zoomBy(0.75)}
              className="w-6 h-6 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
              title="Afastar (-)"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => trocarLente(4)}
              className="px-2 py-0.5 text-[10px] tracking-wider uppercase rounded-lg text-neutral-400 hover:text-[#d4af37] hover:bg-white/[0.06] cursor-pointer"
              title="Visão Geral (1:1)"
            >
              1:1
            </button>

            <div className="w-px h-4 bg-white/[0.08]" />

            {/* Display de Magnificação Dinâmica */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-950/70 border border-white/[0.06]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" />
              <span className="text-[#d4af37] font-bold text-xs">{currentMag}</span>
            </div>
          </div>
        </main>

        {/* Barra Lateral de Diagnóstico e Pinos */}
        <aside
          className={`h-full bg-neutral-950 border-l border-white/[0.08] text-neutral-300 text-sm leading-relaxed overflow-y-auto shrink-0 z-40 transition-all duration-300 ease-in-out ${
            isSidebarOpen ? 'w-full sm:w-[380px] p-6 sm:p-7 opacity-100' : 'w-0 p-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="space-y-6">
            <div>
              <span className="text-[10px] font-mono tracking-widest text-[#d4af37] uppercase">
                {slide.coloracao} &bull; {slide.specimen || 'Preparação Digital'}
              </span>
              <h2 className="text-xl font-serif font-bold text-neutral-100 mt-1 leading-snug">
                {slide.nome}
              </h2>
            </div>

            {/* Texto Descritivo com Interceptador de Pinos */}
            {sanitizedDescription ? (
              <div
                onClick={handleDescriptionClick}
                dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
                className="prose-atlas text-neutral-300 text-xs sm:text-sm font-sans leading-relaxed space-y-3 cursor-text"
              />
            ) : (
              <p className="text-xs text-neutral-500 italic">
                Nenhum texto descritivo cadastrado para esta lâmina.
              </p>
            )}

            {/* Lista de Pontos de Interesse */}
            {slide.pinos && slide.pinos.length > 0 && (
              <div className="pt-5 border-t border-white/[0.06]">
                <h4 className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-3 font-semibold">
                  Pontos de Interesse
                </h4>
                <div className="space-y-2">
                  {slide.pinos.map((pino) => (
                    <button
                      key={pino.id}
                      type="button"
                      onClick={() => focarPino(pino.id)}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-900/50 hover:bg-neutral-900 border border-white/[0.04] hover:border-[#d4af37]/40 text-left transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 truncate pr-2">
                        <span className="w-2 h-2 rounded-full bg-[#d4af37] shrink-0" />
                        <span className="text-xs font-medium text-neutral-200 truncate">
                          {pino.rotulo}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-neutral-500 group-hover:text-[#d4af37] shrink-0">
                        Focar &rarr;
                      </span>
                    </button>
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

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
  minMagnification?: number;
  minZoomLevel?: number;
  maxZoomLevel?: number;
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
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Motor de Ampliação e Navegação Ativo
  const isStaticSlide = false;

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
        showNavigator: !isStaticSlide,
        navigatorPosition: 'BOTTOM_RIGHT',
        navigatorWidth: '120px',
        navigatorHeight: '90px',
        navigatorBackground: 'rgba(10,10,10,0.9)',
        navigatorBorderColor: 'rgba(200,173,95,0.35)',
        navigatorAutoFade: false,
        animationTime: 0.45,
        blendTime: 0.1,
        maxZoomPixelRatio: maxZoomPixelRatio,
        mouseNavEnabled: !isStaticSlide,
        panHorizontal: !isStaticSlide,
        panVertical: !isStaticSlide,
        constrainDuringPan: true,
        visibilityRatio: isStaticSlide ? 1 : 0.8,
        minZoomImageRatio: isStaticSlide ? 1 : 0.9,
        gestureSettingsMouse: {
          scrollToZoom: !isStaticSlide,
          clickToZoom: false,
          dblClickToZoom: true,
          dragToPan: !isStaticSlide
        },
        gestureSettingsTouch: {
          pinchToZoom: !isStaticSlide,
          flickEnabled: true,
          dragToPan: !isStaticSlide,
          dblClickToZoom: true,
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

          const minMag = Number(targetSlide.minMagnification || (targetSlide as any).minZoomLevel) || 4;
          const maxMag = Number(targetSlide.maxMagnification || (targetSlide as any).maxZoomLevel) || 40;

          const minOSDZoom = home * (minMag / 4);
          const maxOSDZoom = home * (maxMag / 4);

          viewer.viewport.minZoomLevel = minOSDZoom;
          viewer.viewport.maxZoomLevel = maxOSDZoom;
          viewer.viewport.zoomTo(minOSDZoom, null, true);
          viewer.viewport.goHome(true);
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
          const minMag = Number(targetSlide.minMagnification || (targetSlide as any).minZoomLevel) || 4;
          const maxMag = Number(targetSlide.maxMagnification || (targetSlide as any).maxZoomLevel) || 40;
          const magRaw = (currentOSDZoom / homeZoom) * 4;
          const mag = Math.max(minMag, Math.min(maxMag, magRaw));
          const rounded = Math.round(mag * 10) / 10;
          const label = Math.abs(rounded - Math.round(rounded)) < 0.05
            ? `${Math.round(rounded)}x`
            : `${rounded.toFixed(1)}x`;
          setCurrentZoom(label);

          if (mag >= 75) setActiveObjective(100);
          else if (mag >= 48) setActiveObjective(60);
          else if (mag >= 18) setActiveObjective(40);
          else if (mag >= 6.5) setActiveObjective(10);
          else setActiveObjective(4);
        }
      };

      viewer.addHandler('open', updateZoom);
      viewer.addHandler('animation', updateZoom);
      viewer.addHandler('zoom', () => {
        if (!viewer || !viewer.viewport || !homeZoomRef.current) return;
        const minMag = Number(targetSlide.minMagnification || (targetSlide as any).minZoomLevel) || 4;
        const maxMag = Number(targetSlide.maxMagnification || (targetSlide as any).maxZoomLevel) || 40;
        const minOSDZoom = homeZoomRef.current * (minMag / 4);
        const maxOSDZoom = homeZoomRef.current * (maxMag / 4);

        const current = viewer.viewport.getZoom();
        if (current < minOSDZoom) {
          viewer.viewport.zoomTo(minOSDZoom, null, true);
        } else if (current > maxOSDZoom) {
          viewer.viewport.zoomTo(maxOSDZoom, null, true);
        }
        updateZoom();
      });

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
    const minMag = Number(slide?.minMagnification || (slide as any)?.minZoomLevel) || 4;
    const maxMag = Number(slide?.maxMagnification || (slide as any)?.maxZoomLevel) || 40;
    const clampedMag = Math.max(minMag, Math.min(maxMag, targetMag));
    const targetZoom = base * (clampedMag / 4);
    osdViewerRef.current.viewport.zoomTo(targetZoom, null, false);
    setActiveObjective(clampedMag);
  };

  const changeZoom = (factor: number) => {
    if (!osdViewerRef.current || !osdViewerRef.current.viewport) return;
    const current = osdViewerRef.current.viewport.getZoom();
    let targetZoom = current * factor;
    if (osdViewerRef.current.viewport.minZoomLevel) {
      targetZoom = Math.max(osdViewerRef.current.viewport.minZoomLevel, targetZoom);
    }
    if (osdViewerRef.current.viewport.maxZoomLevel) {
      targetZoom = Math.min(osdViewerRef.current.viewport.maxZoomLevel, targetZoom);
    }
    osdViewerRef.current.viewport.zoomTo(targetZoom, null, false);
  };

  const resetView = () => {
    if (!osdViewerRef.current || !osdViewerRef.current.viewport) return;
    osdViewerRef.current.viewport.goHome();
  };

  const focusPin = (pin: any) => {
    if (!osdViewerRef.current || !osdViewerRef.current.viewport) return;
    const OSD = (window as any).OpenSeadragon;
    if (!OSD) return;
    const pt = osdViewerRef.current.viewport.imageToViewportCoordinates(
      new OSD.Point(Number(pin.x) || 0, Number(pin.y) || 0)
    );
    const homeZoom = homeZoomRef.current || osdViewerRef.current.viewport.getHomeZoom();
    const targetZoom = Math.max(osdViewerRef.current.viewport.getZoom(), homeZoom * 3.5);
    osdViewerRef.current.viewport.zoomTo(targetZoom, pt, false);
    osdViewerRef.current.viewport.panTo(pt, false);
  };

  return (
    <div className="flex flex-col w-full h-[calc(100vh-64px)] overflow-hidden bg-neutral-950 font-sans text-neutral-200">
      {/* Barra Superior do Viewer */}
      <header className="shrink-0 w-full bg-neutral-950 px-5 py-3 flex items-center justify-between z-50 relative">
        {/* Esquerda: Voltar */}
        <div className="flex items-center gap-3 min-w-0 z-10">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-all duration-200 cursor-pointer shrink-0"
            aria-label="Voltar para Tecido"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"/>
            </svg>
            Voltar para Tecido
          </Link>
          <span className="text-neutral-700 select-none hidden sm:block">|</span>
          <span className="text-xs text-neutral-500 font-sans tracking-wide truncate max-w-[160px] md:max-w-xs">
            {slide?.title}
          </span>
        </div>

        {/* Centro: Logo limpa PALAS ATLAS (sem coruja) */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 select-none pointer-events-none">
          <span className="font-serif font-bold text-sm tracking-[0.2em] text-neutral-100">PALAS</span>
          <span className="font-serif font-normal text-sm tracking-[0.2em] text-[#c8ad5f]">ATLAS</span>
        </div>

        {/* Direita: Botão de Recolher/Expandir Barra Lateral */}
        <div className="flex items-center gap-4 shrink-0 z-10">
          <button
            type="button"
            onClick={() => {
              setIsSidebarOpen(!isSidebarOpen);
              setTimeout(() => {
                if (osdViewerRef.current && osdViewerRef.current.viewport) {
                  osdViewerRef.current.forceResize();
                  if (isStaticSlide) osdViewerRef.current.viewport.goHome(true);
                  osdViewerRef.current.forceRedraw();
                }
              }, 50);
            }}
            className="text-neutral-400 hover:text-[#c8ad5f] transition-colors duration-200 cursor-pointer"
            aria-label={isSidebarOpen ? "Recolher painel de informações" : "Expandir painel de informações"}
            title={isSidebarOpen ? "Recolher painel" : "Expandir painel"}
          >
            <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4.5" width="18" height="15" rx="2.5"></rect>
              <path d="M15 4.5v15"></path>
              <rect x="15" y="4.5" width="6" height="15" rx="2" fill="currentColor" stroke="none" className={`transition-opacity duration-300 ${isSidebarOpen ? 'opacity-35' : 'opacity-0'}`}></rect>
            </svg>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Workspace do Microscópio (expansão fluida ao fechar a barra lateral) */}
        <main className="relative flex-1 min-w-0 h-full bg-neutral-950 overflow-hidden flex items-center justify-center">
          
          {/* Skeleton / Preloader com Batimento Orgânico de Asas */}
          {isLoading && (
            <div className="fixed inset-0 flex flex-col items-center justify-center z-[99999] select-none splash-container">
              <div className="flex flex-col items-center text-center splash-logo-reveal">
                <div className="flex items-center gap-3 sm:gap-4">
                  <span className="font-serif font-bold text-2xl tracking-[0.24em] splash-shimmer-palas">PALAS</span>
                  <div className="splash-owl-anim flex items-center justify-center text-[#d4af37] shrink-0">
                    <svg className="w-9 h-9 sm:w-11 sm:h-11" viewBox="0 0 400 400" fill="currentColor">
                      <path className="owl-body" fillRule="evenodd" d="M 164.5 78.0 L 181.0 77.5 L 186.0 79.5 L 192.5 85.0 L 196.5 95.0 L 196.0 120.5 L 194.0 120.5 L 184.5 115.0 L 184.5 98.0 L 183.5 94.0 L 179.0 89.5 L 168.0 89.5 L 161.0 92.5 L 155.5 98.0 L 153.5 103.0 L 154.5 113.0 L 161.5 122.0 L 161.5 127.0 L 159.0 129.5 L 154.0 130.5 L 147.5 125.0 L 142.5 116.0 L 141.5 107.0 L 137.0 106.5 L 128.0 111.5 L 122.5 117.0 L 118.5 125.0 L 119.0 126.5 L 127.0 128.5 L 136.5 134.0 L 138.5 137.0 L 138.5 141.0 L 135.0 144.5 L 132.0 145.5 L 122.0 139.5 L 112.0 139.5 L 107.0 142.5 L 104.0 142.5 L 94.5 138.0 L 99.0 132.5 L 105.5 129.0 L 105.5 125.0 L 110.5 113.0 L 121.0 101.5 L 132.0 95.5 L 139.0 93.5 L 144.0 93.5 L 150.0 85.5 L 157.0 80.5 L 164.0 78.5 Z M 217.5 78.0 L 234.0 77.5 L 240.0 79.5 L 249.0 85.5 L 255.0 93.5 L 264.0 94.5 L 277.0 100.5 L 283.5 106.0 L 288.5 113.0 L 293.5 125.0 L 293.5 129.0 L 300.0 132.5 L 305.5 138.0 L 304.0 139.5 L 295.0 142.5 L 292.0 142.5 L 284.0 138.5 L 273.0 139.5 L 269.0 141.5 L 263.5 147.0 L 260.0 154.5 L 253.0 157.5 L 251.0 159.5 L 249.0 159.5 L 248.5 153.0 L 253.5 140.0 L 262.0 131.5 L 270.0 127.5 L 280.0 126.5 L 280.5 124.0 L 276.5 117.0 L 271.0 111.5 L 262.0 106.5 L 258.0 106.5 L 256.5 116.0 L 251.5 125.0 L 245.0 130.5 L 240.0 129.5 L 237.5 127.0 L 237.5 122.0 L 241.5 118.0 L 245.5 110.0 L 244.5 100.0 L 238.0 92.5 L 232.0 89.5 L 220.0 89.5 L 215.5 94.0 L 214.5 98.0 L 214.5 125.0 L 215.5 129.0 L 220.0 134.5 L 226.0 137.5 L 233.0 138.5 L 236.5 142.0 L 236.5 147.0 L 233.0 150.5 L 228.0 150.5 L 218.0 147.5 L 216.0 145.5 L 214.5 147.0 L 214.5 161.0 L 204.0 160.5 L 202.5 159.0 L 202.5 146.0 L 205.5 139.0 L 205.5 136.0 L 202.5 129.0 L 202.5 95.0 L 206.5 85.0 L 211.0 80.5 L 217.0 78.5 Z M 169.5 109.0 L 174.0 108.5 L 176.0 109.5 L 178.5 113.0 L 180.5 120.0 L 185.0 120.5 L 189.0 122.5 L 193.5 127.0 L 195.5 131.0 L 196.5 135.0 L 196.5 159.0 L 195.0 160.5 L 184.5 161.0 L 184.5 137.0 L 182.0 132.5 L 180.0 132.5 L 177.5 137.0 L 171.0 143.5 L 158.0 149.5 L 152.5 155.0 L 150.0 160.5 L 140.5 154.0 L 140.5 151.0 L 146.0 143.5 L 153.0 138.5 L 164.0 133.5 L 167.5 130.0 L 168.5 128.0 L 168.5 121.0 L 165.5 116.0 L 165.5 113.0 L 169.0 109.5 Z M 156.5 162.0 L 158.0 161.5 L 164.0 167.5 L 171.0 171.5 L 174.0 171.5 L 179.0 168.5 L 182.0 168.5 L 190.0 165.5 L 209.0 165.5 L 220.0 168.5 L 225.0 171.5 L 229.0 171.5 L 242.0 161.5 L 242.5 170.0 L 240.5 175.0 L 233.0 183.5 L 225.5 189.0 L 226.0 190.5 L 229.0 191.5 L 232.5 195.0 L 234.5 199.0 L 234.5 208.0 L 233.5 210.0 L 228.0 215.5 L 224.0 217.5 L 217.0 217.5 L 209.5 213.0 L 206.0 205.5 L 200.0 210.5 L 193.0 205.5 L 190.5 212.0 L 185.0 216.5 L 175.0 217.5 L 171.0 215.5 L 165.5 210.0 L 164.5 199.0 L 166.5 195.0 L 170.0 191.5 L 173.0 190.5 L 173.5 189.0 L 167.0 184.5 L 157.5 173.0 L 156.5 163.0 Z M 175.0 196.5 L 171.5 200.0 L 171.5 206.0 L 176.0 210.5 L 181.0 210.5 L 186.5 205.0 L 178.0 205.5 L 175.5 203.0 L 175.5 197.0 Z M 224.0 196.5 L 224.5 201.0 L 221.0 205.5 L 212.5 205.0 L 216.0 209.5 L 223.0 210.5 L 226.5 208.0 L 228.5 203.0 L 227.5 200.0 L 224.5 197.0 Z M 197.5 213.0 L 201.0 212.5 L 208.5 220.0 L 200.0 235.5 L 197.5 234.0 L 191.5 221.0 L 191.5 218.0 L 197.0 213.5 Z M 77.5 214.0 L 79.0 213.5 L 88.5 219.0 L 89.5 221.0 L 89.5 229.0 L 92.5 236.0 L 98.0 242.5 L 105.0 246.5 L 113.0 248.5 L 121.0 248.5 L 121.5 241.0 L 120.5 240.0 L 122.0 238.5 L 124.0 237.5 L 132.0 237.5 L 133.5 239.0 L 134.5 247.0 L 142.5 255.0 L 135.0 263.5 L 133.0 263.5 L 128.0 259.5 L 124.0 259.5 L 123.0 260.5 L 104.5 260.0 L 109.5 273.0 L 116.0 280.5 L 125.0 286.5 L 130.0 288.5 L 133.5 288.0 L 133.5 281.0 L 135.5 274.0 L 139.5 266.0 L 148.0 257.5 L 159.0 252.5 L 167.0 252.5 L 169.5 255.0 L 170.5 258.0 L 169.5 261.0 L 167.0 263.5 L 159.0 265.5 L 153.0 269.5 L 148.5 275.0 L 145.5 283.0 L 145.5 291.0 L 149.5 300.0 L 158.0 307.5 L 164.0 309.5 L 177.0 309.5 L 182.5 305.0 L 184.5 299.0 L 184.5 259.0 L 195.0 259.5 L 196.5 261.0 L 196.5 304.0 L 192.5 313.0 L 185.0 319.5 L 179.0 321.5 L 168.0 322.5 L 167.0 321.5 L 157.0 320.5 L 149.0 316.5 L 139.5 307.0 L 137.0 302.5 L 119.0 297.5 L 110.0 291.5 L 101.5 283.0 L 97.5 277.0 L 92.5 263.0 L 92.5 254.0 L 83.5 245.0 L 78.5 236.0 L 77.5 228.0 L 76.5 227.0 L 76.5 217.0 L 77.5 215.0 Z M 319.5 214.0 L 321.0 213.5 L 322.5 217.0 L 322.5 228.0 L 320.5 236.0 L 315.5 245.0 L 306.5 255.0 L 306.5 263.0 L 300.5 279.0 L 288.0 292.5 L 275.0 299.5 L 268.0 301.5 L 263.0 301.5 L 257.5 310.0 L 253.0 314.5 L 242.0 320.5 L 232.0 321.5 L 231.0 322.5 L 220.0 321.5 L 214.0 319.5 L 206.5 313.0 L 202.5 303.0 L 202.5 261.0 L 204.0 259.5 L 214.5 259.0 L 214.5 299.0 L 215.5 300.0 L 215.5 304.0 L 217.5 307.0 L 222.0 309.5 L 235.0 309.5 L 239.0 308.5 L 244.0 305.5 L 249.5 300.0 L 253.5 291.0 L 253.5 283.0 L 250.5 275.0 L 246.5 270.0 L 247.5 263.0 L 250.0 261.5 L 254.0 261.5 L 259.5 266.0 L 262.5 271.0 L 265.5 280.0 L 266.0 288.5 L 272.0 287.5 L 282.0 281.5 L 289.5 273.0 L 293.5 265.0 L 293.5 261.0 L 294.5 260.0 L 278.0 260.5 L 277.0 259.5 L 269.0 258.5 L 263.5 253.0 L 264.5 249.0 L 268.0 246.5 L 273.0 246.5 L 279.0 248.5 L 286.0 248.5 L 298.0 244.5 L 305.5 238.0 L 309.5 230.0 L 310.5 219.0 L 319.0 214.5 Z M 250.5 233.0 L 256.0 232.5 L 259.0 233.5 L 260.5 235.0 L 259.5 242.0 L 254.5 250.0 L 239.5 262.0 L 237.5 266.0 L 237.5 274.0 L 242.5 282.0 L 242.5 285.0 L 240.0 288.5 L 235.0 289.5 L 230.5 286.0 L 225.5 277.0 L 225.5 272.0 L 224.5 271.0 L 225.5 263.0 L 229.5 255.0 L 246.5 240.0 L 248.5 234.0 L 250.0 233.5 Z" />
                      <g className="owl-wing-left" style={{ transformBox: 'fill-box', transformOrigin: '77.2% 54.6%' }}>
                        <path fillRule="evenodd" d="M 190.0 254.5 L 177.0 250.5 L 168.0 245.5 L 160.5 239.0 L 153.0 229.5 L 149.0 227.5 L 141.0 227.5 L 130.0 232.5 L 118.0 232.5 L 108.0 228.5 L 103.5 225.0 L 104.0 222.5 L 115.0 219.5 L 121.0 216.5 L 122.0 214.5 L 114.0 216.5 L 99.0 216.5 L 88.0 213.5 L 80.0 208.5 L 74.5 202.0 L 73.5 200.0 L 74.0 197.5 L 94.0 198.5 L 95.0 197.5 L 104.5 197.0 L 98.0 195.5 L 91.0 195.5 L 76.0 191.5 L 66.0 185.5 L 59.5 179.0 L 54.5 169.0 L 54.0 162.5 L 73.0 169.5 L 85.0 172.5 L 90.0 172.5 L 91.0 173.5 L 94.5 173.0 L 79.0 167.5 L 67.0 161.5 L 56.5 153.0 L 49.5 142.0 L 46.5 130.0 L 47.0 124.5 L 47.5 124.0 L 49.0 123.5 L 69.0 134.5 L 71.0 134.5 L 86.0 141.5 L 133.0 156.5 L 144.0 162.5 L 152.5 171.0 L 157.5 181.0 L 160.0 181.5 L 165.5 187.0 L 165.5 189.0 L 160.5 196.0 L 158.5 203.0 L 158.5 211.0 L 162.5 223.0 L 167.5 230.0 L 178.0 238.5 L 187.0 242.5 L 196.0 243.5 L 197.0 244.5 L 200.0 244.5 L 200.0 254.5 Z" />
                      </g>
                      <g className="owl-wing-right" style={{ transformBox: 'fill-box', transformOrigin: '22.8% 54.6%' }}>
                        <path fillRule="evenodd" d="M 200.0 244.5 L 203.0 244.5 L 215.0 241.5 L 227.0 234.5 L 234.5 226.0 L 239.5 216.0 L 240.5 204.0 L 238.5 196.0 L 233.5 189.0 L 233.5 187.0 L 239.0 181.5 L 241.0 181.5 L 242.5 180.0 L 242.5 178.0 L 246.5 171.0 L 255.0 162.5 L 266.0 156.5 L 278.0 153.5 L 323.0 137.5 L 342.0 128.5 L 350.0 123.5 L 352.5 124.0 L 352.5 132.0 L 347.5 146.0 L 339.0 156.5 L 332.0 161.5 L 320.0 167.5 L 304.5 173.0 L 308.0 173.5 L 309.0 172.5 L 318.0 171.5 L 332.0 167.5 L 342.0 162.5 L 345.5 163.0 L 345.5 166.0 L 341.5 176.0 L 332.0 186.5 L 317.0 193.5 L 294.5 197.0 L 305.0 197.5 L 306.0 198.5 L 325.0 197.5 L 326.5 199.0 L 320.0 207.5 L 311.0 213.5 L 300.0 216.5 L 286.0 216.5 L 285.0 215.5 L 277.0 214.5 L 278.0 216.5 L 284.0 219.5 L 295.5 223.0 L 295.5 225.0 L 294.0 226.5 L 287.0 230.5 L 281.0 232.5 L 270.0 232.5 L 258.0 227.5 L 250.0 227.5 L 245.0 230.5 L 235.0 242.5 L 220.0 251.5 L 210.0 254.5 L 200.0 254.5 Z" />
                      </g>
                    </svg>
                  </div>
                  <span className="font-serif font-normal text-2xl tracking-[0.24em] splash-shimmer-atlas">ATLAS</span>
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
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

          {/* Revólver de Objetivas + Controles Dinâmicos de Zoom */}
          {!isStaticSlide && (
            <div className="absolute bottom-5 left-5 z-20 flex items-center gap-2 p-1.5 rounded-2xl bg-neutral-900/60 backdrop-blur-md border border-white/[0.08] shadow-2xl text-xs font-mono select-none">
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                      isDisabled
                        ? 'text-neutral-600 font-medium cursor-not-allowed opacity-25'
                        : isSelected
                        ? 'bg-[#c8ad5f] text-neutral-950 font-bold shadow-md shadow-[#c8ad5f]/25 cursor-pointer'
                        : 'text-neutral-400 hover:text-white hover:bg-white/[0.06] font-medium cursor-pointer'
                    }`}
                    title={isDisabled ? `Objetiva não disponível (Máx: ${maxMag}x)` : `${mag}x`}
                  >
                    {mag}x
                  </button>
                );
              })}

              <div className="w-px h-4 bg-white/[0.08]" />

              {/* Controles manuais de Zoom (+ / - / Home) */}
              <button
                type="button"
                onClick={() => changeZoom(1.35)}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-all text-xs font-bold cursor-pointer"
                title="Aproximar (+)"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => changeZoom(0.75)}
                className="w-6 h-6 flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-all text-xs font-bold cursor-pointer"
                title="Afastar (-)"
              >
                &minus;
              </button>
              <button
                type="button"
                onClick={resetView}
                className="px-2 py-0.5 flex items-center justify-center rounded-lg text-neutral-400 hover:text-[#c8ad5f] hover:bg-white/[0.06] transition-all text-[10px] tracking-wider uppercase font-medium cursor-pointer"
                title="Enquadramento geral"
              >
                1:1
              </button>

              <div className="w-px h-4 bg-white/[0.08]" />

              {/* Display do Zoom Dinâmico em Tempo Real */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-950/70 border border-white/[0.06]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#c8ad5f] animate-pulse"></span>
                <span className="text-[#c8ad5f] font-bold text-xs">{currentZoom}</span>
              </div>
            </div>
          )}

          {/* Dica operacional discreta */}
          <div className="absolute bottom-5 right-36 pointer-events-none text-[10px] text-neutral-400 font-mono tracking-wider uppercase whitespace-nowrap z-10 hidden lg:block bg-neutral-900/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/[0.06] shadow-lg">
            Scroll &rarr; Zoom &bull; Arrastar &rarr; Pan &bull; Clique duplo &rarr; Ampliar
          </div>
        </main>

        {/* Barra Lateral Histológica Retrátil */}
        <aside
          className={`h-full bg-neutral-950 text-neutral-300 text-sm leading-relaxed overflow-hidden shrink-0 z-40 transition-[width,opacity] duration-500 ease-in-out ${
            isSidebarOpen ? 'w-[380px] opacity-100' : 'w-0 opacity-0'
          }`}
          aria-hidden={!isSidebarOpen}
        >
          <div className="w-[380px] h-full flex flex-col">
            <div className="px-7 pt-7 pb-5 shrink-0">
              <h2 className="text-xl font-serif font-bold text-neutral-100 leading-tight tracking-tight">
                {slide?.title || 'Visualizador Histológico'}
              </h2>
              <p className="mt-2 text-[11px] font-mono tracking-wide text-[#c8ad5f]/80">
                {slide?.stain || 'Hematoxilina e Eosina (H&E)'}
              </p>
            </div>

            <div className="px-7 pb-7 flex-1 overflow-y-auto bg-neutral-950 space-y-4">
              <p className="text-neutral-300 text-sm font-sans leading-loose">
                {slide?.desc || 'Estruturas histológicas digitalizadas em alta resolução.'}
              </p>

              {slide?.pinos && slide.pinos.length > 0 && (
                <div className="mt-8 border-t border-white/[0.06] pt-6">
                  <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-4 font-mono">
                    Pontos de Interesse
                  </h4>
                  <div className="flex flex-col gap-2">
                    {slide.pinos.map(pin => (
                      <button
                        key={pin.id}
                        type="button"
                        onClick={() => focusPin(pin)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-neutral-900/40 hover:bg-neutral-900/70 border border-white/[0.04] hover:border-[#c8ad5f]/40 text-left transition-all group cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 truncate pr-2">
                          <span className="w-2 h-2 rounded-full bg-[#c8ad5f] shrink-0 animate-pulse"></span>
                          <span className="text-sm font-medium text-neutral-200 truncate">
                            {pin.rotulo || 'Marcador'}
                          </span>
                        </div>
                        <span className="text-xs text-neutral-500 group-hover:text-[#c8ad5f] shrink-0 transition-colors">
                          Focar &rarr;
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

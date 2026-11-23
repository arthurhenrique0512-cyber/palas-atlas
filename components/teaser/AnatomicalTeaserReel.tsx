'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Maximize2,
  Minimize2,
  ArrowUpRight,
  Layers,
  Sparkles,
  BookOpen,
  ScanLine,
  Crosshair,
} from 'lucide-react';
import {
  TEASER_DURATION_SEC,
  ACT_TIMINGS,
  SCAPULA_HOTSPOTS,
  CLASSIC_PLATES,
  RAPID_SWITCH_SEQUENCE,
  TeaserAct,
} from './types';
import type { ProjectedPinState } from './Scapula3DStage';
import { PalasBrandMark } from './PalasBrandMark';
import { ClassicPlateArtwork } from './ClassicPlatesArt';
import { AppDeviceMockups } from './AppDeviceMockups';

const Scapula3DStage = dynamic(
  () => import('./Scapula3DStage').then((m) => m.Scapula3DStage),
  { ssr: false }
);

export interface AnatomicalTeaserReelProps {
  /** Inicia a animação automaticamente ao montar (padrão: true) */
  autoPlay?: boolean;
  /** Reinicia o ciclo continuamente após 25s (padrão: true) */
  loop?: boolean;
  /** Oculta controles externos para gravação de tela direta em 9:16 */
  recordMode?: boolean;
  /** Exibe barra de direção fora do quadro 9:16 (padrão: true) */
  showStudioControls?: boolean;
  /** Destino do botão de CTA */
  ctaHref?: string;
  /** Endereço exibido no encerramento */
  siteUrlLabel?: string;
  /** Tempo inicial opcional em segundos (útil para captura de frames/capa) */
  initialTimeSec?: number;
  /** Classes adicionais no wrapper externo */
  className?: string;
}

function getActFromTime(t: number): TeaserAct {
  if (t < 4) return 1;
  if (t < 12) return 2;
  if (t < 20) return 3;
  return 4;
}

/** Safe non-overlapping editorial slots inside 9:16 portrait bounds for each pin */
const PIN_CALLOUT_SLOTS: Record<
  string,
  { top: string; left?: string; right?: string; anchorX: number; anchorY: number }
> = {
  'fossa-supraespinal': {
    top: '16%',
    left: '5%',
    anchorX: 28,
    anchorY: 22,
  },
  'fossa-infraespinal': {
    top: '72%',
    left: '5%',
    anchorX: 30,
    anchorY: 74,
  },
  'tuberculo-infraglenoidal': {
    top: '66%',
    right: '5%',
    anchorX: 72,
    anchorY: 68,
  },
  'processo-coracoide': {
    top: '11%',
    right: '5%',
    anchorX: 72,
    anchorY: 18,
  },
};

export function AnatomicalTeaserReel({
  autoPlay = true,
  loop = true,
  recordMode: initialRecordMode = false,
  showStudioControls = true,
  ctaHref = 'https://palasatlas.com',
  siteUrlLabel = 'palasatlas.com',
  initialTimeSec = 0,
  className = '',
}: AnatomicalTeaserReelProps) {
  const clampedInit = Math.max(0, Math.min(TEASER_DURATION_SEC, initialTimeSec));
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isRecordingView, setIsRecordingView] = useState(initialRecordMode);
  const [displayTime, setDisplayTime] = useState(clampedInit);
  const [activeAct, setActiveAct] = useState<TeaserAct>(() => getActFromTime(clampedInit));

  // Master continuous 60fps clock read directly by Three.js useFrame & DOM refs
  const currentTimeRef = useRef(clampedInit);
  const lastFrameMsRef = useRef<number | null>(null);
  const lastUiSyncRef = useRef(0);

  // Direct DOM refs for 60fps SVG leader lines & pin callout tracking (zero React re-renders!)
  const pinLineRefs = useRef<Record<string, SVGPathElement | null>>({});
  const pinDotRefs = useRef<Record<string, SVGCircleElement | null>>({});
  const pinRingRefs = useRef<Record<string, SVGCircleElement | null>>({});
  const pinCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Sync Escape key to exit pure recording mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRecordingView && !initialRecordMode) {
        setIsRecordingView(false);
      }
      if (e.code === 'Space' && !initialRecordMode) {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRecordingView, initialRecordMode]);

  // Master rAF timeline loop
  useEffect(() => {
    let rafId = 0;

    const tick = (now: number) => {
      if (lastFrameMsRef.current === null) {
        lastFrameMsRef.current = now;
      }
      const dt = Math.min((now - lastFrameMsRef.current) / 1000, 0.1);
      lastFrameMsRef.current = now;

      if (isPlaying) {
        let next = currentTimeRef.current + dt;
        if (next >= TEASER_DURATION_SEC) {
          if (loop) {
            next = next % TEASER_DURATION_SEC;
          } else {
            next = TEASER_DURATION_SEC;
            setIsPlaying(false);
          }
        }
        currentTimeRef.current = next;
      }

      // Throttle React HUD state updates cleanly (~20Hz) while 3D + SVG stay locked at 60fps
      if (now - lastUiSyncRef.current > 45) {
        lastUiSyncRef.current = now;
        const t = currentTimeRef.current;
        setDisplayTime(t);
        const act = getActFromTime(t);
        setActiveAct((prev) => (prev === act ? prev : act));
      }

      rafId = requestAnimationFrame(tick);
    };

    lastFrameMsRef.current = null;
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, loop]);

  const seekTo = useCallback((sec: number) => {
    const clamped = Math.max(0, Math.min(TEASER_DURATION_SEC, sec));
    currentTimeRef.current = clamped;
    setDisplayTime(clamped);
    setActiveAct(getActFromTime(clamped));
  }, []);

  const handleRestart = useCallback(() => {
    seekTo(0);
    setIsPlaying(true);
  }, [seekTo]);

  const handleEnterRecordMode = useCallback(() => {
    setIsRecordingView(true);
    seekTo(0);
    setIsPlaying(true);
  }, [seekTo]);

  // 60fps callback invoked from Three.js useFrame to position SVG leader lines & callouts
  const handlePinsUpdate = useCallback((pins: ProjectedPinState[]) => {
    for (const p of pins) {
      const slot = PIN_CALLOUT_SLOTS[p.id];
      const lineEl = pinLineRefs.current[p.id];
      const dotEl = pinDotRefs.current[p.id];
      const ringEl = pinRingRefs.current[p.id];
      const cardEl = pinCardRefs.current[p.id];

      const show = p.visible && p.intensity > 0.08;
      const opacity = show ? p.intensity.toFixed(3) : '0';

      if (cardEl) {
        cardEl.style.opacity = opacity;
        cardEl.style.transform = `translate3d(0, ${(1 - p.intensity) * 10}px, 0) scale(${0.94 + p.intensity * 0.06})`;
      }

      if (dotEl && ringEl) {
        dotEl.setAttribute('cx', p.xPercent.toFixed(2));
        dotEl.setAttribute('cy', p.yPercent.toFixed(2));
        dotEl.style.opacity = opacity;

        ringEl.setAttribute('cx', p.xPercent.toFixed(2));
        ringEl.setAttribute('cy', p.yPercent.toFixed(2));
        ringEl.style.opacity = show ? (p.intensity * 0.55).toFixed(3) : '0';
      }

      if (lineEl && slot) {
        // Draw crisp 100x100 viewBox orthogonal-diagonal clinical leader line
        const elbowX = (slot.anchorX + p.xPercent) * 0.5;
        const d = `M ${slot.anchorX.toFixed(2)} ${slot.anchorY.toFixed(2)} L ${elbowX.toFixed(
          2
        )} ${slot.anchorY.toFixed(2)} L ${p.xPercent.toFixed(2)} ${p.yPercent.toFixed(2)}`;
        lineEl.setAttribute('d', d);
        lineEl.style.opacity = opacity;
      }
    }
  }, []);

  // Derived states for Act 2 & Act 3 choreography
  const t = displayTime;
  const isAct2OrEarly3 = t >= 3.8 && t < 14.3;
  const isAct3PanelVisible = t >= 12.0 && t < 14.35;
  const rapidBeat =
    t >= 14.2 && t < 20.0
      ? RAPID_SWITCH_SEQUENCE.find((f) => t >= f.startSec && t < f.endSec) || null
      : null;

  // Dynamic zoom readout indicator during Act 2
  const zoomReadout =
    t < 4
      ? '1.0×'
      : t < 8
      ? `${(1.0 + Math.min(1, (t - 4) / 3.6) * 1.4).toFixed(1)}×`
      : t < 12
      ? '2.2×'
      : '1.2×';

  // Active plate highlight index in sliding drawer (12s - 14.2s)
  const highlightedAtlasIdx =
    t < 12.55 ? 0 : t < 13.1 ? 1 : t < 13.65 ? 2 : 3;

  return (
    <div
      className={`flex flex-col items-center justify-center w-full ${
        isRecordingView
          ? 'fixed inset-0 z-[99999] bg-black p-0'
          : ''
      } ${className}`}
    >
      {/* =====================================================================
          9:16 VERTICAL MOBILE STAGE (Reels / Stories Native Aspect Ratio)
      ===================================================================== */}
      <div
        className={`relative aspect-[9/16] overflow-hidden bg-[#05070c] text-slate-100 select-none ${
          isRecordingView
            ? 'h-screen max-h-screen w-auto max-w-full rounded-none shadow-none'
            : 'w-full max-w-[405px] max-h-[86vh] rounded-[28px] border border-white/15 shadow-[0_32px_90px_rgba(0,0,0,0.85),0_0_0_1px_rgba(212,175,55,0.12)]'
        }`}
      >
        {/* Studio Radial Depth Backdrop */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background:
              'radial-gradient(ellipse 85% 55% at 50% 38%, rgba(15, 34, 48, 0.72) 0%, rgba(7, 10, 18, 0.94) 55%, #040509 100%)',
          }}
        />

        {/* Subtle Architectural Grid Mesh */}
        <div
          className="absolute inset-0 pointer-events-none z-0 opacity-[0.16]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148,163,184,0.16) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.16) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
            maskImage:
              'radial-gradient(ellipse 80% 70% at 50% 45%, #000 35%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 80% 70% at 50% 45%, #000 35%, transparent 100%)',
          }}
        />

        {/* Subtle Studio Rim Glow */}
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 w-[340px] h-[340px] rounded-full pointer-events-none blur-3xl z-0 transition-opacity duration-700"
          style={{
            background:
              activeAct === 1
                ? 'radial-gradient(circle, rgba(212,175,55,0.22) 0%, rgba(13,148,136,0.14) 45%, transparent 75%)'
                : activeAct === 4
                ? 'radial-gradient(circle, rgba(20,184,166,0.20) 0%, rgba(212,175,55,0.16) 45%, transparent 75%)'
                : 'radial-gradient(circle, rgba(56,189,248,0.18) 0%, rgba(212,175,55,0.12) 45%, transparent 75%)',
          }}
        />

        {/* -----------------------------------------------------------------
            LAYER 1: REAL-TIME 3D WEBGL SCENE (Three.js / @react-three/fiber)
        ----------------------------------------------------------------- */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          <Scapula3DStage
            currentTimeRef={currentTimeRef}
            onPinsUpdate={handlePinsUpdate}
          />
        </div>

        {/* -----------------------------------------------------------------
            LAYER 2: ACT 3 RAPID-SWITCH CLASSIC PLATE OVERLAY (14.2s - 20.0s)
        ----------------------------------------------------------------- */}
        <AnimatePresence mode="sync">
          {rapidBeat && rapidBeat.mode === 'plate' && rapidBeat.plateId && (
            <motion.div
              key={`${rapidBeat.plateId}-${rapidBeat.startSec}`}
              initial={{ opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="absolute inset-x-4 top-[15%] bottom-[17%] z-20 rounded-2xl overflow-hidden border border-[#d4af37]/50 shadow-[0_24px_60px_rgba(0,0,0,0.85)]"
            >
              <ClassicPlateArtwork
                atlasId={rapidBeat.plateId}
                className="w-full h-full"
              />
              {/* Optical Laser Sync Scan-Line */}
              <motion.div
                initial={{ top: '0%' }}
                animate={{ top: '100%' }}
                transition={{ duration: 0.72, ease: 'linear' }}
                className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_14px_rgba(45,212,191,0.95)] pointer-events-none"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Optical Sync Corner Brackets during Act 3 Rapid Switch */}
        <AnimatePresence>
          {rapidBeat && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-x-3 top-[13.5%] bottom-[15.5%] z-20 pointer-events-none"
            >
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-[#d4af37]/70 rounded-tl" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-[#d4af37]/70 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-teal-400/70 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-teal-400/70 rounded-br" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* -----------------------------------------------------------------
            LAYER 3: 60FPS SVG LEADER LINES & PIN CALLOUT CARDS (Acts 2 & 3)
        ----------------------------------------------------------------- */}
        <div
          className={`absolute inset-0 z-[25] pointer-events-none transition-opacity duration-300 ${
            t >= 4.8 && t < 12.2 ? 'opacity-100' : t >= 17.6 && t < 18.55 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {/* SVG Leader Lines (100x100 percentage coordinate space) */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full"
          >
            {SCAPULA_HOTSPOTS.map((hs) => (
              <g key={hs.id}>
                <path
                  ref={(el) => {
                    pinLineRefs.current[hs.id] = el;
                  }}
                  d="M 50 50 L 50 50"
                  fill="none"
                  stroke={hs.accentColor}
                  strokeWidth="0.32"
                  strokeDasharray="1.1 0.8"
                  style={{ opacity: 0 }}
                />
                <circle
                  ref={(el) => {
                    pinRingRefs.current[hs.id] = el;
                  }}
                  cx="50"
                  cy="50"
                  r="1.9"
                  fill="none"
                  stroke={hs.accentColor}
                  strokeWidth="0.35"
                  style={{ opacity: 0 }}
                />
                <circle
                  ref={(el) => {
                    pinDotRefs.current[hs.id] = el;
                  }}
                  cx="50"
                  cy="50"
                  r="0.85"
                  fill={hs.accentColor}
                  style={{ opacity: 0 }}
                />
              </g>
            ))}
          </svg>

          {/* Clinical Floating Callout Cards */}
          {SCAPULA_HOTSPOTS.map((hs) => {
            const slot = PIN_CALLOUT_SLOTS[hs.id];
            return (
              <div
                key={hs.id}
                ref={(el) => {
                  pinCardRefs.current[hs.id] = el;
                }}
                style={{
                  top: slot.top,
                  left: slot.left,
                  right: slot.right,
                  opacity: 0,
                }}
                className="absolute max-w-[54%] rounded-xl bg-[#070b14]/85 backdrop-blur-md border border-white/15 px-2.5 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.65)] transition-[opacity] duration-150"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: hs.accentColor,
                      boxShadow: `0 0 8px ${hs.accentColor}`,
                    }}
                  />
                  <span
                    className="font-mono text-[8px] uppercase tracking-[0.16em] font-semibold"
                    style={{ color: hs.accentColor }}
                  >
                    {hs.code} • {hs.attachmentType}
                  </span>
                </div>
                <div className="font-serif font-bold text-[11px] text-white leading-tight">
                  {hs.structure}
                </div>
                <div className="text-[9.5px] font-medium text-slate-200/95 leading-snug mt-0.5">
                  {hs.muscle}
                </div>
                <div className="font-mono text-[7.5px] text-slate-400 italic mt-0.5 truncate">
                  {hs.latinName}
                </div>
              </div>
            );
          })}
        </div>

        {/* -----------------------------------------------------------------
            LAYER 4: TOP STUDIO TELEMETRY HUD (Acts 2 & 3)
        ----------------------------------------------------------------- */}
        <AnimatePresence>
          {activeAct >= 2 && activeAct <= 3 && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-4 inset-x-4 z-30 flex items-center justify-between gap-2 pointer-events-none"
            >
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-white/[0.12]">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                <span className="font-mono text-[8.5px] tracking-[0.16em] uppercase text-slate-200 font-semibold">
                  {rapidBeat ? rapidBeat.badge : 'Escápula Direita 3D'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-black/55 backdrop-blur-md border border-[#d4af37]/30">
                {rapidBeat ? (
                  <ScanLine className="w-3 h-3 text-[#d4af37]" />
                ) : (
                  <Crosshair className="w-3 h-3 text-[#d4af37]" />
                )}
                <span className="font-mono text-[8.5px] tracking-wider text-[#f3dca2] tabular-nums">
                  {rapidBeat ? 'SYNC 1:1' : `ZOOM ${zoomReadout}`}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Caption Pill during Act 2 & Rapid Switch */}
        <AnimatePresence mode="wait">
          {isAct2OrEarly3 && !isAct3PanelVisible && (
            <motion.div
              key={t < 8 ? 'fossae' : 'insertions'}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.38 }}
              className="absolute bottom-5 inset-x-5 z-30 pointer-events-none"
            >
              <div className="rounded-2xl bg-black/60 backdrop-blur-md border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#d4af37]">
                    {t < 8
                      ? 'Textura Cortical PBR • Osso Seco'
                      : 'Origens & Inserções Musculares'}
                  </div>
                  <div className="text-[11.5px] font-medium text-slate-100 leading-snug mt-0.5">
                    {t < 8
                      ? 'Fossas supra e infraespinal em micro-relevo real'
                      : 'Tríceps (cabeça longa) e processo coracóide mapeados'}
                  </div>
                </div>
                <Layers className="w-4 h-4 text-teal-400 shrink-0" />
              </div>
            </motion.div>
          )}

          {rapidBeat && (
            <motion.div
              key={rapidBeat.badge}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              className="absolute bottom-5 inset-x-4 z-30 pointer-events-none"
            >
              <div className="rounded-2xl bg-[#070b13]/85 backdrop-blur-md border border-[#d4af37]/35 px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-[0_12px_32px_rgba(0,0,0,0.75)]">
                <div>
                  <div className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#d4af37] font-semibold">
                    Acervo Clássico Integrado
                  </div>
                  <div className="text-[12px] font-semibold text-white leading-tight mt-0.5">
                    {rapidBeat.subtitle}
                  </div>
                </div>
                <span className="px-2 py-1 rounded-lg bg-white/10 font-mono text-[8px] uppercase tracking-wider text-teal-300 shrink-0">
                  {rapidBeat.mode === 'plate' ? 'Prancha' : 'Modelo 3D'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -----------------------------------------------------------------
            ACT 1 (0s - 4s): ABERTURA CINEMATOGRÁFICA
        ----------------------------------------------------------------- */}
        <AnimatePresence>
          {activeAct === 1 && (
            <motion.div
              key="act-1-opening"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 z-30 flex flex-col items-center justify-between px-7 py-14 text-center pointer-events-none"
            >
              {/* Top Minimal Launch Tag */}
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-[#d4af37]/35 backdrop-blur-md"
              >
                <Sparkles className="w-3 h-3 text-[#d4af37]" />
                <span className="font-mono text-[9px] uppercase tracking-[0.26em] text-[#f4e4bc]">
                  Lançamento • Anatomia 3D
                </span>
              </motion.div>

              {/* Center Brand & Headline */}
              <div className="my-auto flex flex-col items-center">
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.85, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <PalasBrandMark
                    size="lg"
                    subtitleText="Atlas Anatômico Interativo"
                  />
                </motion.div>

                {/* Subtle Gold Studio Rule */}
                <motion.div
                  initial={{ scaleX: 0, opacity: 0 }}
                  animate={{ scaleX: 1, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.85, ease: [0.16, 1, 0.3, 1] }}
                  className="w-24 h-px bg-gradient-to-r from-transparent via-[#d4af37]/80 to-transparent my-6"
                />

                {/* Requested Headline (Fade-in + Slide-up via Framer Motion) */}
                <motion.h1
                  initial={{ opacity: 0, y: 26 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, delay: 0.95, ease: [0.16, 1, 0.3, 1] }}
                  className="font-serif font-bold text-[24px] leading-[1.22] tracking-tight text-[#f8f6f0] max-w-[290px]"
                >
                  O novo padrão de{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f3dca2] via-[#d4af37] to-[#2dd4bf]">
                    estudo anatômico
                  </span>{' '}
                  chegou.
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 1.45, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-4 text-[12px] text-slate-300/85 max-w-[260px] leading-relaxed"
                >
                  Osteologia em alta fidelidade PBR conectada às pranchas clássicas da medicina.
                </motion.p>
              </div>

              {/* Bottom Optical Cue */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 0.85, y: 0 }}
                transition={{ duration: 0.7, delay: 1.9 }}
                className="font-mono text-[8.5px] uppercase tracking-[0.26em] text-slate-400"
              >
                Precisão Clínica • 60 FPS
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* -----------------------------------------------------------------
            ACT 3A (12s - 14.3s): SLIDING LATERAL CLASSIC REFERENCE PANEL
        ----------------------------------------------------------------- */}
        <AnimatePresence>
          {isAct3PanelVisible && (
            <motion.aside
              key="act-3-side-drawer"
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: '0%', opacity: 1 }}
              exit={{ x: '105%', opacity: 0 }}
              transition={{ duration: 0.62, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-[11%] bottom-[8%] right-3 w-[61%] z-30 rounded-2xl bg-[#090e1a]/90 backdrop-blur-xl border border-white/15 shadow-[-18px_0_48px_rgba(0,0,0,0.75)] p-3.5 flex flex-col justify-between overflow-hidden"
            >
              <div>
                <div className="flex items-center gap-1.5 pb-2.5 mb-2.5 border-b border-white/10">
                  <BookOpen className="w-3.5 h-3.5 text-[#d4af37]" />
                  <div>
                    <div className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-[#d4af37]">
                      Acervo Clássico
                    </div>
                    <h2 className="font-serif font-bold text-[12px] text-white leading-tight">
                      Referências Cruzadas
                    </h2>
                  </div>
                </div>

                {/* 4 Original Plates Stack */}
                <div className="space-y-2">
                  {CLASSIC_PLATES.map((plate, idx) => {
                    const isFocused = idx === highlightedAtlasIdx;
                    return (
                      <motion.div
                        key={plate.id}
                        initial={{ opacity: 0, x: 18 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.35, delay: 0.12 + idx * 0.09 }}
                        className={`rounded-xl border p-2 transition-all duration-200 flex items-center gap-2.5 ${
                          isFocused
                            ? 'bg-white/[0.11] border-[#d4af37]/60 shadow-[0_0_20px_rgba(212,175,55,0.16)]'
                            : 'bg-white/[0.04] border-white/10 opacity-75'
                        }`}
                      >
                        <div className="w-11 h-12 rounded-lg overflow-hidden shrink-0 border border-white/15">
                          <ClassicPlateArtwork atlasId={plate.id} compact className="w-full h-full" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-serif font-bold text-[11px] text-white truncate">
                              {plate.author}
                            </span>
                            <span className="font-mono text-[7.5px] text-[#d4af37] shrink-0">
                              {plate.plateCode}
                            </span>
                          </div>
                          <div className="text-[9px] text-slate-300 leading-tight truncate mt-0.5">
                            {plate.fullTitle}
                          </div>
                          <div className="font-mono text-[7px] text-teal-300/90 mt-1 truncate">
                            {plate.regionLabel}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between font-mono text-[7.5px] text-slate-400">
                <span>4 Pranchas Sincronizadas</span>
                <span className="text-teal-400">3D ↔ 2D</span>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* -----------------------------------------------------------------
            ACT 4 (20s - 25s): ENCERRAMENTO / DEVICE MOCKUPS & CTA
        ----------------------------------------------------------------- */}
        <AnimatePresence>
          {activeAct === 4 && (
            <motion.div
              key="act-4-cta"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 z-40 bg-gradient-to-b from-[#050811]/[0.88] via-[#070b15]/[0.94] to-[#04060b]/[0.98] backdrop-blur-sm px-5 py-7 flex flex-col items-center justify-between text-center"
            >
              {/* Top Brand */}
              <motion.div
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.08 }}
                className="pt-1"
              >
                <PalasBrandMark size="md" subtitleText="Anatomia 3D & Acervo Clássico" />
              </motion.div>

              {/* Stylized Desktop + Mobile Mockup Showcase */}
              <div className="w-full my-auto py-2">
                <AppDeviceMockups />
              </div>

              {/* Final CTA Headline, Button & Website URL */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className="w-full space-y-3.5 pb-1"
              >
                <h2 className="font-serif font-bold text-[19px] leading-[1.24] text-white px-2">
                  Explore a anatomia com{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#f3dca2] via-[#d4af37] to-teal-300">
                    precisão clínica.
                  </span>{' '}
                  Acesse agora!
                </h2>

                <div className="flex flex-col items-center gap-2.5">
                  <motion.a
                    href={ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="relative overflow-hidden inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-[#d4af37] via-[#e7cb73] to-[#d4af37] text-[#090b10] font-sans font-bold text-[12px] tracking-wide shadow-[0_10px_32px_rgba(212,175,55,0.42)] no-underline group"
                  >
                    <span>Explorar Atlas Interativo</span>
                    <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    {/* Animated shimmer highlight */}
                    <motion.span
                      aria-hidden="true"
                      initial={{ x: '-120%' }}
                      animate={{ x: '220%' }}
                      transition={{
                        repeat: Infinity,
                        repeatDelay: 1.8,
                        duration: 1.1,
                        ease: 'easeInOut',
                      }}
                      className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent skew-x-[-20deg]"
                    />
                  </motion.a>

                  <a
                    href={ctaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/[0.06] border border-white/15 font-mono text-[10px] tracking-[0.18em] text-teal-300 hover:text-white transition-colors no-underline"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                    <span>{siteUrlLabel}</span>
                  </a>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimal Exit Button ONLY visible on hover in Recording Mode */}
        {isRecordingView && !initialRecordMode && (
          <button
            type="button"
            onClick={() => setIsRecordingView(false)}
            className="fixed top-4 right-4 z-[100000] opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity px-3 py-1.5 rounded-full bg-black/80 border border-white/20 text-white text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            title="Sair do modo gravação (ESC)"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Sair (ESC)</span>
          </button>
        )}
      </div>

      {/* =====================================================================
          DIRECTOR / PREVIEW CONTROLS (Outside 9:16 Frame for Clean Capture)
      ===================================================================== */}
      {showStudioControls && !isRecordingView && (
        <div className="mt-4 w-full max-w-[405px] rounded-2xl bg-[#0b101b]/90 border border-white/10 backdrop-blur-md p-3.5 shadow-xl space-y-3">
          {/* Timeline Scrubber */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 tabular-nums">
              <span>
                ATO {activeAct} • {ACT_TIMINGS[activeAct].label.toUpperCase()}
              </span>
              <span>
                {displayTime.toFixed(1)}s / {TEASER_DURATION_SEC.toFixed(0)}s
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={TEASER_DURATION_SEC}
              step={0.05}
              value={displayTime}
              onChange={(e) => seekTo(parseFloat(e.target.value))}
              aria-label="Linha do tempo do teaser"
              className="w-full h-1.5 rounded-lg appearance-none bg-slate-800 accent-[#d4af37] cursor-pointer"
            />
          </div>

          {/* Act Quick-Jump Buttons + Playback Controls */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPlaying((p) => !p)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium text-white transition-colors cursor-pointer"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-[#d4af37]" />
                    <span>Pausar</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-teal-400" />
                    <span>Reproduzir</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleRestart}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Reiniciar do 0s"
                aria-label="Reiniciar teaser"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              {([1, 2, 3, 4] as TeaserAct[]).map((act) => (
                <button
                  key={act}
                  type="button"
                  onClick={() => seekTo(ACT_TIMINGS[act].start)}
                  className={`px-2 py-1 rounded-lg font-mono text-[10px] transition-all cursor-pointer border ${
                    activeAct === act
                      ? 'bg-[#d4af37]/20 text-[#f3dca2] border-[#d4af37]/50'
                      : 'bg-white/[0.03] text-slate-400 border-white/10 hover:text-white'
                  }`}
                  title={`Ir para Ato ${act}: ${ACT_TIMINGS[act].label}`}
                >
                  A{act}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleEnterRecordMode}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-400/30 text-[11px] font-medium text-teal-200 transition-colors cursor-pointer"
              title="Tela limpa 9:16 pronta para gravação"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Gravar 9:16</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnatomicalTeaserReel;

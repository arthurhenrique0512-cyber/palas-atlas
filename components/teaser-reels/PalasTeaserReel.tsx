'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  Film,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  REEL_ACTS,
  REEL_DURATION_SEC,
  REEL_FPS,
  REEL_HEIGHT,
  REEL_SAFE_ZONE,
  REEL_TOTAL_FRAMES,
  REEL_WIDTH,
  getActAtTime,
} from './timeline';
import { Scene1HookPain } from './scenes/Scene1HookPain';
import { Scene2DisciplineMorph } from './scenes/Scene2DisciplineMorph';
import { Scene3MicroscopeZoom } from './scenes/Scene3MicroscopeZoom';
import { Scene4MultiDevice } from './scenes/Scene4MultiDevice';
import { Scene5OutroCTA } from './scenes/Scene5OutroCTA';

declare global {
  interface Window {
    __PALAS_REEL__?: {
      setTime: (sec: number) => void;
      getTime: () => number;
      getDuration: () => number;
      getFps: () => number;
    };
  }
}

export interface PalasTeaserReelProps {
  recordMode?: boolean;
  deterministicMode?: boolean;
  initialTimeSec?: number;
}

export function PalasTeaserReel({
  recordMode = false,
  deterministicMode = false,
  initialTimeSec = 0,
}: PalasTeaserReelProps) {
  const [t, setT] = useState(() =>
    Math.max(0, Math.min(REEL_DURATION_SEC, initialTimeSec))
  );
  const [isPlaying, setIsPlaying] = useState(() => !deterministicMode);
  const [isMuted, setIsMuted] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.42);

  const timeRef = useRef(t);
  const lastMsRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync window.__PALAS_REEL__ controller for deterministic Playwright frame-by-frame capture
  useEffect(() => {
    window.__PALAS_REEL__ = {
      setTime: (sec: number) => {
        const clamped = Math.max(0, Math.min(REEL_DURATION_SEC, sec));
        timeRef.current = clamped;
        setIsPlaying(false);
        setT(clamped);
      },
      getTime: () => timeRef.current,
      getDuration: () => REEL_DURATION_SEC,
      getFps: () => REEL_FPS,
    };
    return () => {
      delete window.__PALAS_REEL__;
    };
  }, []);

  // Compute responsive viewport scale in Studio Preview mode while keeping native 1080x1920 in recordMode
  useEffect(() => {
    if (recordMode) {
      setPreviewScale(1);
      return;
    }

    const computeScale = () => {
      const availH = Math.max(360, window.innerHeight - 190);
      const availW = Math.max(240, window.innerWidth - 48);
      const scaleH = availH / REEL_HEIGHT;
      const scaleW = availW / REEL_WIDTH;
      setPreviewScale(Math.min(0.48, scaleH, scaleW));
    };

    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, [recordMode]);

  // Continuous 60fps rAF playback when not in deterministic frame-stepping mode
  useEffect(() => {
    if (deterministicMode || !isPlaying) {
      lastMsRef.current = null;
      return;
    }

    let rafId = 0;
    const tick = (now: number) => {
      if (lastMsRef.current === null) {
        lastMsRef.current = now;
      }
      const dt = Math.min((now - lastMsRef.current) / 1000, 0.08);
      lastMsRef.current = now;

      let next = timeRef.current + dt;
      if (next >= REEL_DURATION_SEC) {
        next = next % REEL_DURATION_SEC;
      }
      timeRef.current = next;
      setT(next);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, deterministicMode]);

  // Spacebar toggles playback in preview mode
  useEffect(() => {
    if (recordMode || deterministicMode) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [recordMode, deterministicMode]);

  const seekTo = useCallback((sec: number) => {
    const clamped = Math.max(0, Math.min(REEL_DURATION_SEC, sec));
    timeRef.current = clamped;
    setT(clamped);
    if (audioRef.current) {
      audioRef.current.currentTime = clamped;
    }
  }, []);

  const handleRestart = useCallback(() => {
    seekTo(0);
    setIsPlaying(true);
    if (audioRef.current && !isMuted) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [seekTo, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || recordMode || deterministicMode) return;
    audio.muted = isMuted;
    if (isPlaying && !isMuted) {
      if (Math.abs(audio.currentTime - timeRef.current) > 0.25) {
        audio.currentTime = timeRef.current;
      }
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, isMuted, recordMode, deterministicMode]);

  const activeAct = getActAtTime(t);
  const currentFrame = Math.min(REEL_TOTAL_FRAMES - 1, Math.floor(t * REEL_FPS));

  const stageNode = (
    <div
      id="palas-reel-stage"
      className="relative overflow-hidden bg-[#f8fafc] select-none font-sans antialiased"
      style={{
        width: REEL_WIDTH,
        height: REEL_HEIGHT,
        transform: recordMode ? undefined : `scale(${previewScale})`,
        transformOrigin: 'top left',
      }}
    >
      <Scene1HookPain t={t} />
      <Scene2DisciplineMorph t={t} />
      <Scene3MicroscopeZoom t={t} />
      <Scene4MultiDevice t={t} />
      <Scene5OutroCTA t={t} />

      {/* Optional Instagram Reels Safe Zone Guide (Studio Preview Only) */}
      {!recordMode && showSafeZones && (
        <div className="absolute inset-0 z-50 pointer-events-none">
          <div
            className="absolute inset-x-0 top-0 bg-rose-500/20 border-b-2 border-dashed border-rose-400 flex items-end justify-center pb-2"
            style={{ height: REEL_SAFE_ZONE.top }}
          >
            <span className="px-3 py-1 rounded bg-rose-950/90 text-rose-200 font-mono text-[14px]">
              IG Top Status / Reels HUD ({REEL_SAFE_ZONE.top}px)
            </span>
          </div>
          <div
            className="absolute inset-x-0 bottom-0 bg-rose-500/20 border-t-2 border-dashed border-rose-400 flex items-start justify-center pt-3"
            style={{ height: REEL_SAFE_ZONE.bottom }}
          >
            <span className="px-3 py-1 rounded bg-rose-950/90 text-rose-200 font-mono text-[14px]">
              IG Bottom Caption &amp; Audio Bar ({REEL_SAFE_ZONE.bottom}px)
            </span>
          </div>
          <div
            className="absolute right-0 bg-amber-500/15 border-l-2 border-dashed border-amber-400 flex items-center justify-center"
            style={{
              top: REEL_SAFE_ZONE.top,
              bottom: REEL_SAFE_ZONE.bottom,
              width: REEL_SAFE_ZONE.right,
            }}
          >
            <span className="rotate-90 whitespace-nowrap px-2 py-0.5 rounded bg-amber-950/90 text-amber-200 font-mono text-[12px]">
              IG Action Icons
            </span>
          </div>
        </div>
      )}
    </div>
  );

  // Pure full-bleed 1080x1920 output when recording via Playwright
  if (recordMode) {
    return (
      <div
        className="w-[1080px] h-[1920px] overflow-hidden bg-black m-0 p-0"
        data-frame={currentFrame}
      >
        {stageNode}
      </div>
    );
  }

  // Interactive Studio Preview Mode
  const scaledW = Math.round(REEL_WIDTH * previewScale);
  const scaledH = Math.round(REEL_HEIGHT * previewScale);

  return (
    <div
      ref={containerRef}
      className="w-full flex flex-col items-center justify-center gap-4"
    >
      {/* Scaled 9:16 Stage Frame */}
      <audio
        ref={audioRef}
        src="/teaser-assets/palas-reels-soundtrack.mp3"
        preload="auto"
        loop
      />
      <div
        className="relative rounded-[26px] overflow-hidden border border-white/15 shadow-[0_32px_90px_rgba(0,0,0,0.8),0_0_0_1px_rgba(13,148,136,0.22)] bg-black shrink-0"
        style={{ width: scaledW, height: scaledH }}
      >
        {stageNode}
      </div>

      {/* Studio Direction Console */}
      <div className="w-full max-w-[780px] rounded-2xl bg-[#0a0f1a]/95 border border-white/10 backdrop-blur-xl p-4 shadow-2xl space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying((p) => !p)}
              className="h-9 px-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-sans text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pausar' : 'Reproduzir'}</span>
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-sans text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reiniciar</span>
            </button>
            <button
              type="button"
              onClick={() => setIsMuted((m) => !m)}
              className={`h-9 px-3 rounded-xl border font-sans text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                !isMuted
                  ? 'bg-teal-500/15 border-teal-400/40 text-teal-200'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400'
              }`}
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              <span>{isMuted ? 'Sem Som' : 'Trilha Ativa'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowSafeZones((s) => !s)}
              className={`h-9 px-3 rounded-xl border font-sans text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                showSafeZones
                  ? 'bg-rose-500/20 border-rose-400/50 text-rose-200'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-300'
              }`}
            >
              {showSafeZones ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>Safe Zones IG</span>
            </button>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-300 tabular-nums">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-teal-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              1080×1920 • {REEL_FPS}fps
            </span>
            <span>
              {t.toFixed(2)}s / {REEL_DURATION_SEC.toFixed(2)}s
            </span>
            <span className="text-slate-500">
              F{String(currentFrame).padStart(4, '0')}/{REEL_TOTAL_FRAMES}
            </span>
          </div>
        </div>

        {/* Continuous Frame Scrubber */}
        <input
          type="range"
          min={0}
          max={REEL_DURATION_SEC}
          step={1 / REEL_FPS}
          value={t}
          onChange={(e) => {
            setIsPlaying(false);
            seekTo(Number(e.target.value));
          }}
          className="w-full accent-teal-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          aria-label="Linha do tempo do vídeo"
        />

        {/* Scene Jump Chips */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {REEL_ACTS.map((act) => {
              const isCurrent = act.id === activeAct;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => seekTo(act.startSec + 0.05)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                    isCurrent
                      ? 'bg-teal-600/25 border-teal-400/50 text-teal-200'
                      : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-400'
                  }`}
                >
                  <span className="font-mono text-[10px] mr-1 opacity-75">{act.shortTag}</span>
                  <span>{act.label}</span>
                </button>
              );
            })}
          </div>

          <a
            href="/teaser-reels?record=1"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/40 text-[11px] font-semibold text-[#f3dca2] no-underline transition-colors"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Modo 1080×1920 Puro</span>
          </a>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';
import { FileWarning, Clock, WifiOff, AlertTriangle } from 'lucide-react';
import {
  EASE_OUT_EXPO,
  EASE_SHARP_IN_OUT,
  EASE_SMOOTH,
  clamp01,
  remap,
} from '../timeline';
import { PalasClinicalLogo } from '../PalasClinicalHeader';
import { KineticCaption } from '../KineticCaption';

interface Scene1HookPainProps {
  t: number;
}

export function Scene1HookPain({ t }: Scene1HookPainProps) {
  if (t >= 4.65) return null;

  // Phase 1A (0.0s - 2.65s): Slow handheld ocular drift + readable pain cards
  // Phase 1B (2.45s - 4.20s): Smooth 0.90s optical iris reveal into Clinical Light Palas Atlas
  const isSnapPhase = t >= 2.45;
  const shutterP = remap(t, 2.45, 3.35, 0, 1, EASE_SHARP_IN_OUT);
  const exitFade = t > 4.05 ? remap(t, 4.05, 4.6, 1, 0, EASE_SMOOTH) : 1;

  // Slower, gentler handheld ocular drift (less frantic)
  const shakeEnv = remap(t, 2.25, 2.75, 1, 0, EASE_OUT_EXPO);
  const shakeX = (Math.sin(t * 8.5) * 12 + Math.cos(t * 14.0) * 6) * shakeEnv;
  const shakeY = (Math.cos(t * 7.2) * 11 + Math.sin(t * 12.0) * 5) * shakeEnv;
  const shakeRot = Math.sin(t * 5.8) * 1.4 * shakeEnv;

  const ocularBlur = (3.4 + Math.sin(t * 4.8) * 1.8) * shakeEnv;
  const ocularScale = 1.15 + Math.sin(t * 3.2) * 0.04 * shakeEnv;

  // Gentle entrance for pain toast cards
  const pdfEntrance = remap(t, 0.35, 1.05, 0, 1, EASE_OUT_EXPO);
  const labEntrance = remap(t, 0.95, 1.65, 0, 1, EASE_OUT_EXPO);

  // Unhurried Palas lock-on logo reveal
  const brandP = remap(t, 2.7, 3.55, 0, 1, EASE_OUT_EXPO);

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#05070c]"
      style={{ opacity: exitFade }}
    >
      {/* =================================================================
          PHASE 1A: SMARTPHONE OCULAR + CHAOS OVERLOAD
      ================================================================= */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: 1 - shutterP,
          transform: `scale(${1 + shutterP * 0.08})`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 48%, rgba(28, 34, 48, 0.55) 0%, #05070a 68%)',
          }}
        />

        {/* Circular Microscope Ocular Field */}
        <div
          className="relative w-[780px] h-[780px] rounded-full overflow-hidden border-[8px] border-zinc-800/90 shadow-[0_0_120px_rgba(0,0,0,0.95)]"
          style={{
            transform: `translate3d(${shakeX.toFixed(1)}px, ${(shakeY + 30).toFixed(
              1
            )}px, 0) rotate(${shakeRot.toFixed(2)}deg)`,
          }}
        >
          <img
            src="/teaser-assets/pele-espessa-hd.jpg"
            alt="Foto ocular instável"
            className="w-full h-full object-cover"
            style={{
              transform: `scale(${ocularScale.toFixed(3)}) translate3d(-8%, 4%, 0)`,
              filter: `blur(${ocularBlur.toFixed(2)}px) saturate(0.75) contrast(1.12) brightness(0.78)`,
            }}
          />

          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(circle at 48% 50%, transparent 32%, rgba(0,0,0,0.45) 58%, rgba(0,0,0,0.96) 76%)',
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none opacity-45"
            style={{
              boxShadow:
                'inset 10px 0 36px rgba(239,68,68,0.45), inset -10px 0 36px rgba(56,189,248,0.45)',
            }}
          />

          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[210px] h-[210px] border-2 border-dashed border-amber-400/80 rounded-2xl flex items-end justify-center pb-3"
            style={{
              transform: `translate(calc(-50% + ${(shakeX * 0.35).toFixed(1)}px), calc(-50% - ${(
                shakeY * 0.35
              ).toFixed(1)}px))`,
            }}
          >
            <span className="px-3 py-1 rounded-md bg-rose-600/90 font-mono text-[15px] font-bold tracking-wider text-white uppercase">
              Foco Instável
            </span>
          </div>
        </div>

        {/* Camera Top HUD Timestamp */}
        <div className="absolute top-[102px] inset-x-10 flex items-center justify-between px-4">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-rose-500/15 border border-rose-400/35">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="font-mono text-[17px] font-bold tracking-widest text-rose-200 uppercase">
              23:47 • Véspera da Prova
            </span>
          </div>
          <span className="font-mono text-[16px] text-zinc-400 tracking-wider">
            ISO 3200 • 1/15s
          </span>
        </div>

        {/* Pain Cards */}
        <div
          className="absolute left-[72px] top-[380px] w-[540px] rounded-2xl bg-zinc-950/[0.94] border border-rose-500/50 px-5 py-4 shadow-[0_24px_60px_rgba(0,0,0,0.85)] flex items-center gap-4"
          style={{
            opacity: pdfEntrance,
            transform: `translate3d(${((1 - pdfEntrance) * -28).toFixed(1)}px, 0, 0) rotate(-1.4deg)`,
          }}
        >
          <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
            <FileWarning className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[14px] text-rose-300 font-semibold uppercase tracking-wider">
              PDF Corrompido • 248 MB
            </div>
            <div className="font-sans text-[20px] font-semibold text-white truncate">
              Laminas_Histologia_Print_WhatsApp.pdf
            </div>
          </div>
        </div>

        <div
          className="absolute right-[78px] bottom-[500px] w-[480px] rounded-2xl bg-zinc-950/[0.94] border border-amber-500/50 px-5 py-4 shadow-[0_24px_60px_rgba(0,0,0,0.85)] flex items-center gap-4"
          style={{
            opacity: labEntrance,
            transform: `translate3d(${((1 - labEntrance) * 28).toFixed(1)}px, 0, 0) rotate(1.2deg)`,
          }}
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="font-mono text-[14px] text-amber-300 font-semibold uppercase tracking-wider">
              Laboratório Fechado
            </div>
            <div className="font-sans text-[19px] font-semibold text-white">
              Sem acesso às lâminas em casa
            </div>
          </div>
        </div>

        <div
          className="absolute left-[84px] bottom-[380px] inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-black/75 border border-white/15 font-mono text-[15px] text-zinc-300"
          style={{ opacity: clamp01(labEntrance * 0.95) }}
        >
          <WifiOff className="w-4 h-4 text-rose-400" />
          <span>Sem zoom real • Imagem pixelada</span>
          <AlertTriangle className="w-4 h-4 text-amber-400 ml-1" />
        </div>
      </div>

      {/* =================================================================
          PHASE 1B: SMOOTH IRIS REVEAL -> PALAS ATLAS CLINICAL LIGHT
      ================================================================= */}
      {isSnapPhase && (
        <div
          className="absolute inset-0 bg-[#f8fafc] flex flex-col items-center justify-center overflow-hidden"
          style={{
            clipPath: `circle(${(shutterP * 140).toFixed(2)}% at 50% 50%)`,
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(15, 23, 42, 0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.04) 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[760px] h-[760px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(13,148,136,0.12) 0%, rgba(3,105,161,0.06) 45%, transparent 72%)',
            }}
          />

          <div
            className="relative z-10 flex flex-col items-center text-center px-10"
            style={{
              opacity: brandP,
              transform: `translate3d(0, ${((1 - brandP) * 24).toFixed(1)}px, 0) scale(${(
                0.94 +
                brandP * 0.06
              ).toFixed(3)})`,
            }}
          >
            <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-white border border-teal-900/15 shadow-sm mb-8">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
              <span className="font-mono text-[16px] font-semibold tracking-[0.22em] uppercase text-teal-950">
                Precisão Morfológica Digital
              </span>
            </div>

            <PalasClinicalLogo theme="light-bg" size="lg" showSubtitle />

            <div className="mt-10 h-[3px] w-36 rounded-full bg-gradient-to-r from-slate-900 via-[#0369a1] to-teal-600" />

            <p className="mt-8 font-serif font-bold text-[46px] text-slate-950 leading-[1.15] max-w-[780px]">
              Chega de estudar{' '}
              <span className="text-[#0369a1]">no escuro.</span>
            </p>
          </div>
        </div>
      )}

      {/* Unhurried Hook Captions */}
      <KineticCaption
        t={t}
        start={0.05}
        end={2.55}
        variant="dark"
        position="top"
        eyebrow="Ciclo Básico • Medicina"
        headline="23h47. Prova prática amanhã."
      />
      <KineticCaption
        t={t}
        start={0.95}
        end={2.55}
        variant="dark"
        position="bottom"
        headline={
          <>
            Foto tremida da{' '}
            <span className="text-amber-300">ocular de novo?</span>
          </>
        }
      />
    </div>
  );
}

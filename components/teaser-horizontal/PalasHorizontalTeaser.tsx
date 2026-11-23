'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  ShieldCheck,
  Film,
  Volume2,
  VolumeX,
  FileWarning,
  Clock,
  WifiOff,
  AlertTriangle,
  Search,
  Layers,
  FlaskConical,
  Compass,
  GraduationCap,
  ArrowRight,
  Microscope,
  Tablet,
  Smartphone,
  Laptop,
  Zap,
  Crosshair,
  Sparkles,
  ArrowUpRight,
  Globe,
} from 'lucide-react';
import { PalasOwlIcon } from '@/components/teaser/PalasBrandMark';
import {
  REEL_ACTS,
  REEL_DURATION_SEC,
  REEL_FPS,
  REEL_TOTAL_FRAMES,
  EASE_CINEMATIC,
  EASE_OUT_EXPO,
  EASE_OVERSHOOT,
  EASE_SHARP_IN_OUT,
  EASE_SMOOTH,
  clamp01,
   getActAtTime,
  lerp,
  remap,
} from '../teaser-reels/timeline';
import {
  REAL_DISCIPLINES,
  DisciplineKey,
  PELE_ESPESSA_PINS,
  OSSO_MADURO_PINS,
  REAL_BENCH_QUESTION,
  SpecimenPin,
} from '../teaser-reels/palasCatalogBridge';
import { PalasClinicalLogo } from '../teaser-reels/PalasClinicalHeader';
import { Osteology3DPreview } from '../teaser-reels/Osteology3DPreview';

export const HORIZ_WIDTH = 1920;
export const HORIZ_HEIGHT = 1080;

// ============================================================================
// WIDESCREEN HEADER (1920px Desktop Navbar from index.html & microscopio.html)
// ============================================================================
function HorizontalClinicalHeader({
  mode = 'home',
  markersCount = 4,
  breadcrumb = '',
}: {
  mode?: 'home' | 'microscope';
  markersCount?: number;
  breadcrumb?: string;
}) {
  return (
    <div className="w-full bg-white/[0.96] border-b border-slate-200 shadow-[0_6px_24px_-6px_rgba(15,23,42,0.06)] shrink-0">
      <div className="h-[3px] w-full bg-gradient-to-r from-slate-900 via-[#0369a1] to-slate-900" />
      <div className="px-10 h-[76px] flex items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {mode === 'microscope' && (
            <>
              <div className="h-10 px-4 rounded-xl bg-slate-100 border border-slate-200/90 flex items-center gap-2 text-[15px] font-semibold text-slate-700">
                <span>&larr;</span>
                <span>Voltar</span>
              </div>
              <span className="h-6 w-px bg-slate-200" />
            </>
          )}
          <PalasClinicalLogo theme="light-bg" size="xs" showSubtitle={false} />
          {breadcrumb && (
            <>
              <span className="text-slate-300 text-lg">&rsaquo;</span>
              <span className="text-[15px] text-slate-600 font-medium">
                {breadcrumb}
              </span>
            </>
          )}
        </div>

        {mode === 'home' ? (
          <div className="flex items-center gap-8 text-[15px] font-medium text-slate-600">
            <span className="text-slate-950 font-semibold border-b-2 border-[#0369a1] py-1">
              Disciplinas
            </span>
            <span>Lâminas</span>
            <span>Como Usar</span>
            <span>Dúvidas</span>
            <span>Sobre Nós</span>
            <span className="px-4 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[14px] font-semibold">
              Acesso 100% Aberto
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-10 px-4 flex items-center gap-2 rounded-xl bg-[#f0fdfa] text-[#0f766e] border border-[#5eead4]">
              <Crosshair className="w-4 h-4" />
              <span className="text-[14px] font-semibold">Marcações</span>
              <span className="px-2 py-0.5 rounded-full text-[12px] font-mono font-bold bg-teal-600 text-white leading-none">
                {markersCount}
              </span>
            </div>
            <div className="h-10 px-4 flex items-center gap-2 rounded-xl bg-slate-900 text-white text-[14px] font-semibold">
              <span>Painel Lateral Ativo</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// ACT 1 (0.0s - 4.2s): WIDESCREEN HOOK + PAIN -> IRIS REVEAL
// ============================================================================
function HorizScene1Hook({ t }: { t: number }) {
  if (t >= 4.65) return null;

  const isSnapPhase = t >= 2.45;
  const shutterP = remap(t, 2.45, 3.35, 0, 1, EASE_SHARP_IN_OUT);
  const exitFade = t > 4.05 ? remap(t, 4.05, 4.6, 1, 0, EASE_SMOOTH) : 1;

  const shakeEnv = remap(t, 2.25, 2.75, 1, 0, EASE_OUT_EXPO);
  const shakeX = (Math.sin(t * 8.5) * 11 + Math.cos(t * 14.0) * 5) * shakeEnv;
  const shakeY = (Math.cos(t * 7.2) * 10 + Math.sin(t * 12.0) * 4) * shakeEnv;
  const shakeRot = Math.sin(t * 5.8) * 1.3 * shakeEnv;

  const ocularBlur = (3.4 + Math.sin(t * 4.8) * 1.8) * shakeEnv;
  const ocularScale = 1.15 + Math.sin(t * 3.2) * 0.04 * shakeEnv;

  const headlineP = remap(t, 0.1, 0.75, 0, 1, EASE_OUT_EXPO);
  const pdfEntrance = remap(t, 0.4, 1.1, 0, 1, EASE_OUT_EXPO);
  const labEntrance = remap(t, 0.95, 1.65, 0, 1, EASE_OUT_EXPO);
  const brandP = remap(t, 2.7, 3.55, 0, 1, EASE_OUT_EXPO);

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-[#05070c]"
      style={{ opacity: exitFade }}
    >
      {/* 16:9 Split Hook Stage */}
      <div
        className="absolute inset-0 grid grid-cols-12 items-center px-20 gap-12"
        style={{
          opacity: 1 - shutterP,
          transform: `scale(${1 + shutterP * 0.06})`,
        }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 32% 50%, rgba(28, 34, 48, 0.55) 0%, #05070a 70%)',
          }}
        />

        {/* Left 6 Cols: Shaky Circular Microscope Ocular */}
        <div className="col-span-6 relative z-10 flex items-center justify-center">
          <div
            className="relative w-[660px] h-[660px] rounded-full overflow-hidden border-[8px] border-zinc-800/90 shadow-[0_0_110px_rgba(0,0,0,0.95)]"
            style={{
              transform: `translate3d(${shakeX.toFixed(1)}px, ${shakeY.toFixed(
                1
              )}px, 0) rotate(${shakeRot.toFixed(2)}deg)`,
            }}
          >
            <img
              src="/teaser-assets/pele-espessa-hd.jpg"
              alt="Ocular instável"
              className="w-full h-full object-cover"
              style={{
                transform: `scale(${ocularScale.toFixed(3)}) translate3d(-6%, 4%, 0)`,
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
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[190px] h-[190px] border-2 border-dashed border-amber-400/80 rounded-2xl flex items-end justify-center pb-3">
              <span className="px-3 py-1 rounded-md bg-rose-600/90 font-mono text-[14px] font-bold tracking-wider text-white uppercase">
                Foco Instável
              </span>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Headline + Pain Cards */}
        <div className="col-span-6 relative z-10 flex flex-col items-start justify-center space-y-6 pr-6">
          <div
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-rose-500/15 border border-rose-400/35"
            style={{ opacity: headlineP }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span className="font-mono text-[15px] font-bold tracking-widest text-rose-200 uppercase">
              23:47 • Véspera de Prova Prática
            </span>
          </div>

          <div
            style={{
              opacity: headlineP,
              transform: `translate3d(0, ${((1 - headlineP) * 18).toFixed(1)}px, 0)`,
            }}
          >
            <h1 className="font-serif font-extrabold text-[54px] text-white leading-[1.1] tracking-tight">
              Foto tremida da{' '}
              <span className="text-amber-300">ocular de novo?</span>
            </h1>
            <p className="mt-3 font-sans text-[22px] text-zinc-400 leading-relaxed">
              Na véspera da prova prática, estudar por fotos borradas e PDFs pesados custa tempo e precisão.
            </p>
          </div>

          <div className="w-full space-y-4 pt-2">
            <div
              className="w-full max-w-[620px] rounded-2xl bg-zinc-950/[0.94] border border-rose-500/50 px-6 py-4 shadow-2xl flex items-center gap-4"
              style={{
                opacity: pdfEntrance,
                transform: `translate3d(${((1 - pdfEntrance) * 28).toFixed(1)}px, 0, 0)`,
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                <FileWarning className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[13px] text-rose-300 font-semibold uppercase tracking-wider">
                  PDF Corrompido • 248 MB
                </div>
                <div className="font-sans text-[19px] font-semibold text-white truncate">
                  Laminas_Histologia_Print_WhatsApp.pdf
                </div>
              </div>
            </div>

            <div
              className="w-full max-w-[620px] rounded-2xl bg-zinc-950/[0.94] border border-amber-500/50 px-6 py-4 shadow-2xl flex items-center gap-4"
              style={{
                opacity: labEntrance,
                transform: `translate3d(${((1 - labEntrance) * 28).toFixed(1)}px, 0, 0)`,
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="font-mono text-[13px] text-amber-300 font-semibold uppercase tracking-wider">
                  Laboratório Fechado às 18h
                </div>
                <div className="font-sans text-[19px] font-semibold text-white">
                  Sem acesso às lâminas reais para revisar em casa
                </div>
              </div>
            </div>
          </div>

          <div
            className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/5 border border-white/10 font-mono text-[14px] text-zinc-300"
            style={{ opacity: labEntrance }}
          >
            <WifiOff className="w-4 h-4 text-rose-400" />
            <span>Sem escala óptica • Sem marcações interativas</span>
            <AlertTriangle className="w-4 h-4 text-amber-400 ml-1" />
          </div>
        </div>
      </div>

      {/* Phase 1B: Smooth Widescreen Iris Reveal */}
      {isSnapPhase && (
        <div
          className="absolute inset-0 bg-[#f8fafc] flex flex-col items-center justify-center overflow-hidden"
          style={{
            clipPath: `circle(${(shutterP * 135).toFixed(2)}% at 50% 50%)`,
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
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[960px] h-[640px] rounded-full pointer-events-none"
            style={{
              background:
                'radial-gradient(circle, rgba(13,148,136,0.12) 0%, rgba(3,105,161,0.06) 45%, transparent 72%)',
            }}
          />

          <div
            className="relative z-10 flex flex-col items-center text-center px-10"
            style={{
              opacity: brandP,
              transform: `translate3d(0, ${((1 - brandP) * 20).toFixed(1)}px, 0) scale(${(
                0.95 +
                brandP * 0.05
              ).toFixed(3)})`,
            }}
          >
            <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full bg-white border border-teal-900/15 shadow-sm mb-7">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
              <span className="font-mono text-[15px] font-semibold tracking-[0.22em] uppercase text-teal-950">
                Precisão Morfológica Digital
              </span>
            </div>

            <PalasClinicalLogo theme="light-bg" size="xl" showSubtitle />

            <div className="mt-8 h-[3px] w-40 rounded-full bg-gradient-to-r from-slate-900 via-[#0369a1] to-teal-600" />

            <p className="mt-7 font-serif font-bold text-[50px] text-slate-950 leading-tight">
              Chega de estudar <span className="text-[#0369a1]">no escuro.</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ACT 2 (4.2s - 8.2s): 16:9 DESKTOP CONSOLE (Search + 5 Disciplines + Spotlight)
// ============================================================================
const DISCIPLINE_WINDOWS: { id: DisciplineKey; start: number; end: number }[] = [
  { id: 'histologia', start: 4.2, end: 5.55 },
  { id: 'anatomia', start: 5.55, end: 6.9 },
  { id: 'patologia', start: 6.9, end: 8.3 },
];

function HorizScene2Disciplines({ t }: { t: number }) {
  if (t < 4.05 || t > 8.65) return null;

  const enterP = remap(t, 4.05, 4.65, 0, 1, EASE_OUT_EXPO);
  const exitP = remap(t, 8.05, 8.6, 1, 0, EASE_SMOOTH);
  const sceneOpacity = clamp01(Math.min(enterP, exitP));

  const activeWindow =
    DISCIPLINE_WINDOWS.find((w) => t >= w.start && t < w.end) ||
    DISCIPLINE_WINDOWS[DISCIPLINE_WINDOWS.length - 1];
  const activeDisc =
    REAL_DISCIPLINES.find((d) => d.id === activeWindow.id) || REAL_DISCIPLINES[0];

  const cardLocalP = remap(
    t,
    activeWindow.start,
    activeWindow.start + 0.52,
    0,
    1,
    EASE_OUT_EXPO
  );

  const fullQuery = 'Osso Maduro • Pele Espessa';
  const charCount = Math.floor(remap(t, 4.35, 6.6, 0, fullQuery.length));
  const typedQuery = fullQuery.slice(0, charCount);

  return (
    <div
      className="absolute inset-0 bg-[#f8fafc] text-slate-900 flex flex-col overflow-hidden"
      style={{ opacity: sceneOpacity }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(15, 23, 42, 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.035) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <HorizontalClinicalHeader mode="home" />

      <div className="relative z-10 flex-1 grid grid-cols-12 items-center px-16 gap-12">
        {/* Left 5 Cols: Editorial Headline + Search Console + 5 Discipline Pills */}
        <div className="col-span-5 flex flex-col justify-center space-y-6">
          <div className="inline-flex items-center gap-2 self-start bg-white border border-teal-900/15 shadow-xs text-teal-950 text-[13px] font-mono font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-teal-600" />
            <span>Atlas Integrado • Ciclo Básico</span>
          </div>

          <h2 className="font-serif font-extrabold text-[48px] text-slate-950 leading-[1.1] tracking-tight">
            5 áreas morfológicas.{' '}
            <span className="text-[#0369a1]">Um único acervo real.</span>
          </h2>

          <p className="font-sans text-[19px] text-slate-600 leading-relaxed">
            Explore lâminas digitalizadas em alta definição, osteologia 3D e sínteses teóricas curadas pelas referências clássicas da medicina.
          </p>

          {/* Search Bar */}
          <div className="w-full bg-white rounded-2xl border border-slate-200/90 shadow-[0_12px_36px_rgba(15,23,42,0.05)] p-5 space-y-4">
            <div className="relative flex items-center bg-slate-50 border-2 border-[#0369a1]/45 rounded-xl px-4 py-3.5">
              <Search className="w-5 h-5 text-[#0369a1] mr-3 shrink-0" />
              <span className="font-sans text-[18px] text-slate-900 font-medium">
                {typedQuery || 'Buscar tecidos, órgãos ou lâminas...'}
              </span>
              <span className="ml-1 w-[2px] h-5 bg-[#0369a1]" />
            </div>

            <div className="flex flex-wrap gap-2">
              {REAL_DISCIPLINES.map((disc) => {
                const isSelected = disc.id === activeDisc.id;
                return (
                  <div
                    key={disc.id}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[15px] font-semibold transition-colors ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200/90'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${disc.dotClass}`} />
                    <span>{disc.label === 'Anatomia Humana' ? 'Anatomia' : disc.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 7 Cols: Active Discipline Spotlight Showcase */}
        <div className="col-span-7">
          <div
            className="w-full rounded-[30px] overflow-hidden border shadow-[0_28px_70px_rgba(15,23,42,0.12)]"
            style={{
              borderColor:
                activeDisc.id === 'histologia'
                  ? 'rgba(15,23,42,0.85)'
                  : 'rgba(203,213,225,0.9)',
              background:
                activeDisc.id === 'histologia'
                  ? 'linear-gradient(135deg, #0f172a 0%, #042f2e 55%, #0f172a 100%)'
                  : '#ffffff',
              color: activeDisc.id === 'histologia' ? '#ffffff' : '#0f172a',
              transform: `translate3d(0, ${((1 - cardLocalP) * 14).toFixed(1)}px, 0)`,
              opacity: clamp01(0.2 + cardLocalP * 0.8),
            }}
          >
            <div className="p-8 flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div
                    className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-[13px] font-mono font-semibold uppercase tracking-wider mb-2.5 ${
                      activeDisc.id === 'histologia'
                        ? 'bg-teal-500/15 border-teal-400/35 text-teal-300'
                        : `${activeDisc.badgeBgClass} ${activeDisc.badgeTextClass}`
                    }`}
                  >
                    {activeDisc.id === 'histologia' && <Layers className="w-4 h-4" />}
                    {activeDisc.id === 'anatomia' && <Compass className="w-4 h-4" />}
                    {activeDisc.id === 'patologia' && <FlaskConical className="w-4 h-4" />}
                    {(activeDisc.id === 'parasitologia' ||
                      activeDisc.id === 'microbiologia') && (
                      <GraduationCap className="w-4 h-4" />
                    )}
                    <span>{activeDisc.bibliography}</span>
                  </div>

                  <h3 className="font-serif font-extrabold text-[38px] leading-tight tracking-tight">
                    {activeDisc.label}
                  </h3>
                  <p
                    className={`mt-1 text-[18px] leading-snug ${
                      activeDisc.id === 'histologia' ? 'text-slate-300' : 'text-slate-600'
                    }`}
                  >
                    {activeDisc.subtitle}
                  </p>
                </div>
              </div>

              <div className="relative w-full h-[380px] rounded-2xl overflow-hidden border border-slate-200/20 bg-slate-950 flex items-center justify-center">
                {activeDisc.id === 'anatomia' ? (
                  <div className="w-full h-full bg-gradient-to-br from-[#070b14] via-[#0c1a2a] to-[#050811] flex items-center justify-between px-10">
                    <Osteology3DPreview t={t - 5.55} width={480} height={360} />
                    <div className="flex-1 space-y-3 pl-6">
                      <div className="font-mono text-[13px] uppercase tracking-widest text-[#d4af37]">
                        Osteologia 3D PBR • Tempo Real
                      </div>
                      <div className="font-serif font-bold text-[30px] text-white leading-tight">
                        Escápula Direita
                      </div>
                      <div className="space-y-2 pt-2">
                        {[
                          '01 Fossa Supraespinal (M. Supraespinal)',
                          '02 Tubérculo Infraglenoidal (Tríceps C.L.)',
                          '03 Processo Coracóide (Bíceps / Peitoral Menor)',
                        ].map((item) => (
                          <div
                            key={item}
                            className="px-3.5 py-2 rounded-xl bg-white/10 border border-white/10 text-[15px] text-slate-200 font-medium"
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <img
                      src={activeDisc.previewImage}
                      alt={activeDisc.label}
                      className="w-full h-full object-cover"
                      style={{
                        transform: `scale(${(1.01 + cardLocalP * 0.05).toFixed(3)})`,
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
                    <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between">
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/70 border border-white/20 text-white text-[15px] font-semibold">
                        <Microscope className="w-4 h-4 text-teal-300" />
                        <span>Microscopia Óptica 40× Nativa</span>
                      </div>
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-600 text-white text-[15px] font-semibold shadow-lg">
                        <span>Abrir no Microscópio</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                {activeDisc.topics.slice(0, 2).map((topic, idx) => (
                  <div
                    key={topic}
                    className={`px-4 py-3 rounded-xl border text-[15px] font-medium truncate flex items-center gap-2.5 ${
                      activeDisc.id === 'histologia'
                        ? 'bg-white/[0.06] border-white/10 text-slate-200'
                        : 'bg-slate-50 border-slate-200/80 text-slate-700'
                    }`}
                  >
                    <span className="font-mono text-[13px] font-bold text-teal-500">
                      0{idx + 1}
                    </span>
                    <span className="truncate">{topic}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ACT 3 (8.2s - 17.2s): 16:9 DESKTOP MICROSCOPE (Stage 1410px + Sidebar 510px)
// ============================================================================
const STAGE_W = 1410;
const STAGE_H = 1001; // 1080 - 79px header

function HorizScene3Microscope({ t }: { t: number }) {
  if (t < 8.05 || t > 17.65) return null;

  const enterP = remap(t, 8.05, 8.65, 0, 1, EASE_OUT_EXPO);
  const exitP = remap(t, 17.05, 17.6, 1, 0, EASE_SMOOTH);
  const sceneOpacity = clamp01(Math.min(enterP, exitP));

  const isOssoPhase = t >= 13.4;
  const crossfadeOsso = remap(t, 13.15, 13.75, 0, 1, EASE_SMOOTH);

  // Base image dimensions inside 1410 x 1001 desktop stage
  const imgW = 1410;
  const imgH = isOssoPhase ? 1410 : 2530;

  let focusXPct = 45;
  let focusYPct = 30;
  let scale = 1.0;
  let magDisplay = 4.0;
  let activeLens: 4 | 10 | 40 = 4;
  let activePinId = 'pin-interface';

  if (!isOssoPhase) {
    if (t < 9.3) {
      const p = remap(t, 8.2, 9.3, 0, 1, EASE_SMOOTH);
      focusXPct = lerp(46, 40, p);
      focusYPct = lerp(32, 28, p);
      scale = lerp(1.0, 1.06, p);
      magDisplay = lerp(4.0, 4.4, p);
      activeLens = 4;
      activePinId = 'pin-interface';
    } else if (t < 11.1) {
      const p = remap(t, 9.3, 10.75, 0, 1, EASE_CINEMATIC);
      focusXPct = lerp(40, 37.5, p);
      focusYPct = lerp(28, 27.8, p);
      scale = lerp(1.06, 1.65, p);
      magDisplay = lerp(4.4, 10.0, p);
      activeLens = p > 0.25 ? 10 : 4;
      activePinId = 'pin-interface';
    } else {
      const p = remap(t, 11.1, 12.65, 0, 1, EASE_CINEMATIC);
      const hold = remap(t, 12.65, 13.4, 0, 1, EASE_SMOOTH);
      focusXPct = lerp(37.5, 89.58, p);
      focusYPct = lerp(27.8, 83.66, p);
      scale = lerp(1.65, 2.55, p) + hold * 0.08;
      magDisplay = lerp(10.0, 40.0, p);
      activeLens = p > 0.22 ? 40 : 10;
      activePinId = p > 0.55 ? 'pin-hemacia' : 'pin-colageno';
    }
  } else {
    if (t < 15.2) {
      const p = remap(t, 13.4, 15.05, 0, 1, EASE_CINEMATIC);
      focusXPct = lerp(28.4, 56.3, p);
      focusYPct = lerp(16.4, 78.2, p);
      scale = lerp(1.25, 2.05, p);
      magDisplay = lerp(14.0, 40.0, p);
      activeLens = p > 0.35 ? 40 : 10;
      activePinId = p > 0.55 ? 'pin-osteon-central' : 'pin-havers-sup';
    } else {
      const p = remap(t, 15.2, 17.2, 0, 1, EASE_SMOOTH);
      focusXPct = lerp(56.3, 55.0, p);
      focusYPct = lerp(78.2, 76.5, p);
      scale = lerp(2.05, 2.18, p);
      magDisplay = 40.0;
      activeLens = 40;
      activePinId = 'pin-osteon-central';
    }
  }

  const targetX = STAGE_W * 0.5;
  const targetY = STAGE_H * 0.48;
  const focusPxX = (focusXPct / 100) * imgW;
  const focusPxY = (focusYPct / 100) * imgH;
  const rawTx = targetX - focusPxX * scale;
  const rawTy = targetY - focusPxY * scale;
  const minTx = Math.min(0, STAGE_W - imgW * scale);
  const minTy = Math.min(0, STAGE_H - imgH * scale);
  const tx = Math.min(0, Math.max(minTx, rawTx));
  const ty = Math.min(0, Math.max(minTy, rawTy));

  const activePins: SpecimenPin[] = isOssoPhase ? OSSO_MADURO_PINS : PELE_ESPESSA_PINS;
  const umValue = Math.max(25, Math.round(2000 / magDisplay));
  const scalebarLabel = umValue >= 1000 ? `${(umValue / 1000).toFixed(1)} mm` : `${umValue} µm`;

  const tap10x = t >= 9.1 && t <= 9.65 ? remap(t, 9.1, 9.65, 0, 1) : 0;
  const tap40x = t >= 10.95 && t <= 11.5 ? remap(t, 10.95, 11.5, 0, 1) : 0;

  const navW = 156;
  const navH = 116;
  const boxW = clamp01(1 / (scale * 1.1)) * navW;
  const boxH = clamp01(1 / (scale * 0.95)) * navH;
  const boxLeft = clamp01(focusXPct / 100 - boxW / (2 * navW)) * navW;
  const boxTop = clamp01(focusYPct / 100 - boxH / (2 * navH)) * navH;

  const showQuestoesTab = isOssoPhase && t >= 14.5;

  return (
    <div
      className="absolute inset-0 bg-[#eef2f6] text-slate-800 flex flex-col overflow-hidden"
      style={{ opacity: sceneOpacity }}
    >
      <HorizontalClinicalHeader
        mode="microscope"
        markersCount={activePins.length}
        breadcrumb={
          isOssoPhase
            ? 'Histologia › Tecido Ósseo › Osso Maduro 40×'
            : 'Histologia › Tecido Epitelial › Pele Espessa'
        }
      />

      {/* Desktop Side-by-Side Workspace: Optical Stage (1410px) + Lateral Sidebar (510px) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Optical Stage */}
        <div
          className="relative overflow-hidden bg-[#eef2f6] shrink-0"
          style={{ width: STAGE_W, height: STAGE_H }}
        >
          <div
            className="absolute top-0 left-0 will-change-transform"
            style={{
              width: imgW,
              height: imgH,
              transformOrigin: '0 0',
              transform: `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${scale.toFixed(
                4
              )})`,
            }}
          >
            <img
              src={
                isOssoPhase
                  ? '/teaser-assets/osso-maduro-40x-hd.jpg'
                  : '/teaser-assets/pele-espessa-hd.jpg'
              }
              alt={isOssoPhase ? 'Osso Maduro 40x' : 'Pele Espessa'}
              className="w-full h-full object-fill block select-none"
            />
          </div>

          {crossfadeOsso > 0 && crossfadeOsso < 1 && (
            <div
              className="absolute inset-0 bg-white pointer-events-none z-20"
              style={{ opacity: Math.sin(crossfadeOsso * Math.PI) * 0.42 }}
            />
          )}

          {/* Pin Overlays */}
          <div className="absolute inset-0 pointer-events-none z-20">
            {activePins.map((pin) => {
              const px = (pin.xPct / 100) * imgW;
              const py = (pin.yPct / 100) * imgH;
              const screenX = tx + px * scale;
              const screenY = ty + py * scale;

              if (
                screenX < -80 ||
                screenX > STAGE_W + 80 ||
                screenY < -80 ||
                screenY > STAGE_H + 80
              ) {
                return null;
              }

              const isActive = pin.id === activePinId;
              const radarCycle = (t * 0.55) % 1;
              const radarScale = 0.78 + radarCycle * 1.15;
              const radarOpacity = isActive ? (1 - radarCycle) * 0.85 : 0;

              return (
                <div
                  key={pin.id}
                  className="absolute"
                  style={{
                    left: screenX,
                    top: screenY,
                    transform: 'translate(-50%, -50%)',
                    zIndex: isActive ? 40 : 25,
                  }}
                >
                  {isActive && (
                    <div
                      className="absolute rounded-full border-[3px] border-[#fbbf24] bg-amber-400/25 pointer-events-none"
                      style={{
                        width: 64,
                        height: 64,
                        left: '50%',
                        top: '50%',
                        transform: `translate(-50%, -50%) scale(${radarScale.toFixed(3)})`,
                        opacity: radarOpacity,
                      }}
                    />
                  )}

                  <div
                    className="relative rounded-full border-[3px] border-white flex items-center justify-center font-mono font-extrabold text-white"
                    style={{
                      width: isActive ? 42 : 34,
                      height: isActive ? 42 : 34,
                      fontSize: isActive ? 17 : 14,
                      backgroundColor: isActive ? '#d97706' : '#0f766e',
                      boxShadow: isActive
                        ? '0 0 0 2.5px #0f172a, 0 0 24px rgba(245,158,11,0.9), 0 6px 16px rgba(15,23,42,0.5)'
                        : '0 3px 10px rgba(15,23,42,0.45), 0 0 0 1.5px rgba(15,23,42,0.22)',
                    }}
                  >
                    {pin.number}
                  </div>

                  {isActive && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 mt-2.5 whitespace-nowrap px-4 py-1.5 rounded-full bg-slate-900 text-[#fef3c7] border-2 border-[#fbbf24] shadow-[0_0_0_2px_rgba(255,255,255,0.94),0_10px_28px_rgba(15,23,42,0.45)] flex items-center gap-2 font-sans text-[16px] font-bold"
                      style={{ top: '100%' }}
                    >
                      <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24]" />
                      <span>{pin.label}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Top-Left Floating Headline Pill inside Optical Stage */}
          <div className="absolute top-6 left-6 z-30 bg-white/[0.95] border border-slate-200/90 rounded-2xl px-6 py-3.5 shadow-[0_14px_36px_rgba(15,23,42,0.12)] flex items-center gap-4">
            <span className="w-3 h-3 rounded-full bg-[#0369a1]" />
            <div>
              <div className="font-mono text-[12px] uppercase tracking-[0.2em] text-[#0369a1] font-bold">
                {!isOssoPhase
                  ? 'Microscopia DZI • Calibração Biológica 0,156 µm/px'
                  : 'Panorama 6×8 Costurado • 36,2 Megapixels'}
              </div>
              <div className="font-serif font-extrabold text-[24px] text-slate-950 leading-tight">
                {!isOssoPhase
                  ? 'Zoom óptico até 40× real com pinos interativos'
                  : 'Lâminas reais + revisão ativa no Caderno de Bancada'}
              </div>
            </div>
          </div>

          {/* Top-Right Scalebar */}
          <div className="absolute top-6 right-6 z-30 bg-white/[0.95] border border-slate-300 rounded-xl px-4 py-2.5 shadow-md flex flex-col items-center">
            <span className="font-mono text-[15px] font-bold text-slate-900 leading-none mb-1.5 tabular-nums">
              {scalebarLabel}
            </span>
            <div className="w-[104px] h-[3px] bg-slate-900 relative">
              <span className="absolute left-0 -top-1 w-[2px] h-[10px] bg-slate-900" />
              <span className="absolute right-0 -top-1 w-[2px] h-[10px] bg-slate-900" />
            </div>
          </div>

          {/* Bottom-Left Objective Revolver (#viewerLensPanel) */}
          <div className="absolute bottom-6 left-6 z-30 flex items-center gap-2 p-2.5 rounded-2xl bg-white/[0.96] border border-slate-200/90 shadow-[0_18px_46px_rgba(15,23,42,0.16)] font-mono">
            {([4, 10, 40, 60, 100] as const).map((mag) => {
              const isDisabled = !isOssoPhase && mag > 40;
              const isSelected = activeLens === mag;
              const ripple =
                (mag === 10 && tap10x > 0) || (mag === 40 && tap40x > 0)
                  ? mag === 10
                    ? tap10x
                    : tap40x
                  : 0;

              return (
                <div
                  key={mag}
                  className={`relative px-4 py-2 rounded-xl text-[16px] font-bold flex items-center justify-center ${
                    isSelected
                      ? 'bg-[#0369a1] text-white shadow-sm'
                      : isDisabled
                      ? 'text-slate-300 opacity-50'
                      : 'text-slate-600 bg-slate-50'
                  }`}
                >
                  {mag}x
                  {ripple > 0 && (
                    <span
                      className="absolute inset-0 rounded-xl border-2 border-[#0369a1] pointer-events-none"
                      style={{
                        transform: `scale(${(1 + ripple * 0.45).toFixed(2)})`,
                        opacity: 1 - ripple,
                      }}
                    />
                  )}
                </div>
              );
            })}
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-700 font-bold text-[18px] flex items-center justify-center">
              +
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-700 font-bold text-[18px] flex items-center justify-center">
              &minus;
            </div>
            <div className="px-3 h-10 rounded-xl bg-slate-50 text-slate-700 font-semibold text-[14px] flex items-center justify-center">
              1:1
            </div>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-sky-50 border border-sky-200">
              <span className="w-2 h-2 rounded-full bg-[#0284c7]" />
              <span className="text-[#0369a1] font-bold text-[17px] tabular-nums">
                {magDisplay >= 39.6 ? '40x' : `${magDisplay.toFixed(1)}x`}
              </span>
            </div>
          </div>

          {/* Bottom-Right OpenSeadragon Navigator Minimap */}
          <div
            className="absolute bottom-6 right-6 z-30 rounded-xl overflow-hidden bg-white/[0.95] border border-slate-300 shadow-lg"
            style={{ width: navW, height: navH }}
          >
            <img
              src={
                isOssoPhase
                  ? '/teaser-assets/osso-maduro-40x-hd.jpg'
                  : '/teaser-assets/pele-espessa-hd.jpg'
              }
              alt="Minimap"
              className="w-full h-full object-cover opacity-85"
            />
            <div
              className="absolute border-2 border-rose-600 bg-rose-500/15"
              style={{
                left: boxLeft,
                top: boxTop,
                width: Math.max(14, boxW),
                height: Math.max(14, boxH),
              }}
            />
          </div>
        </div>

        {/* Right: Authentic Desktop Lateral Sidebar (#viewerSidebar — 510px) */}
        <aside className="w-[510px] h-full bg-white border-l border-slate-200 flex flex-col shrink-0 z-30">
          {/* Sidebar Header */}
          <div className="px-7 pt-6 pb-5 bg-slate-50 border-b border-slate-200">
            <span className="inline-block text-[11px] font-mono uppercase tracking-[0.2em] text-slate-500 mb-1">
              Análise Morfológica
            </span>
            <h2 className="text-[26px] font-serif font-extrabold text-slate-900 leading-snug">
              {isOssoPhase ? 'Osso Maduro 40×' : 'Pele Espessa'}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-md bg-white border border-slate-200 text-[13px] font-medium text-slate-700">
                {isOssoPhase
                  ? 'Corte por Desgaste • Mapeamento 6×8'
                  : 'Tricrômico / H&E • 40×'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-teal-50 border border-teal-200 text-[13px] font-semibold text-teal-800">
                <span className="w-2 h-2 rounded-full bg-teal-600" />
                <span>40× Nativa</span>
              </span>
            </div>
          </div>

          {/* Sidebar Tabs */}
          <div className="px-7 py-3.5 flex items-center gap-2.5 border-b border-slate-200 bg-slate-100/70">
            <div
              className={`px-4 py-2 rounded-lg text-[14px] font-semibold ${
                !showQuestoesTab
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 bg-white border border-slate-200'
              }`}
            >
              Descrição
            </div>
            <div
              className={`px-4 py-2 rounded-lg text-[14px] font-semibold flex items-center gap-2 ${
                showQuestoesTab
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 bg-white border border-slate-200'
              }`}
            >
              <span>Questões</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[12px] font-mono ${
                  showQuestoesTab ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                2
              </span>
            </div>
          </div>

          {/* Sidebar Body */}
          <div className="p-7 flex-1 flex flex-col justify-between overflow-hidden">
            {!showQuestoesTab ? (
              <div className="space-y-5">
                <div className="space-y-3 text-[15.5px] text-slate-700 leading-relaxed">
                  {!isOssoPhase ? (
                    <>
                      <p>
                        Preparação histológica de <strong>pele espessa</strong> exibindo transição nítida na{' '}
                        <span
                          className={`px-1.5 py-0.5 rounded font-semibold ${
                            activePinId === 'pin-interface'
                              ? 'bg-amber-100 text-amber-900 border-b-2 border-amber-500'
                              : 'bg-teal-50 text-teal-800 border-b-2 border-teal-500'
                          }`}
                        >
                          interface dermo-epidérmica
                        </span>{' '}
                        e densos feixes de colágeno tipo I na derme reticular.
                      </p>
                      <p>
                        No campo profundo destacam-se{' '}
                        <span
                          className={`px-1.5 py-0.5 rounded font-semibold ${
                            activePinId === 'pin-hemacia'
                              ? 'bg-amber-100 text-amber-900 border-b-2 border-amber-500'
                              : 'bg-teal-50 text-teal-800 border-b-2 border-teal-500'
                          }`}
                        >
                          hemácias em arteríola dérmica
                        </span>{' '}
                        (diâmetro de referência biológica 7,5 µm).
                      </p>
                    </>
                  ) : (
                    <p>
                      Corte transversal por desgaste preservando a matriz mineralizada organizada em{' '}
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border-b-2 border-amber-500 font-semibold">
                        Sistemas de Havers (ósteons)
                      </span>
                      , canais vasculares centrais e lacunas de osteócitos intercomunicadas por canalículos.
                    </p>
                  )}
                </div>

                {/* Pin List inside Sidebar */}
                <div className="space-y-2.5 pt-2">
                  <div className="font-mono text-[11px] uppercase tracking-widest text-slate-400 font-semibold">
                    Pontos de Interesse Mapeados
                  </div>
                  {activePins.map((pin) => {
                    const isFocused = pin.id === activePinId;
                    return (
                      <div
                        key={pin.id}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 ${
                          isFocused
                            ? 'bg-[#fffbeb] border-[#f59e0b] border-l-4 border-l-[#d97706] shadow-xs'
                            : 'bg-slate-50 border-slate-200 border-l-4 border-l-teal-600'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-full font-mono text-[13px] font-bold flex items-center justify-center shrink-0 ${
                              isFocused
                                ? 'bg-[#d97706] text-white'
                                : 'bg-teal-700 text-white'
                            }`}
                          >
                            {pin.number}
                          </span>
                          <span
                            className={`text-[14.5px] truncate ${
                              isFocused
                                ? 'font-bold text-amber-950'
                                : 'font-medium text-slate-800'
                            }`}
                          >
                            {pin.label}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[12px] shrink-0 ${
                            isFocused ? 'font-bold text-amber-700' : 'text-teal-700'
                          }`}
                        >
                          {isFocused ? 'Em foco' : 'Focar →'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-[12px] font-mono uppercase tracking-wider text-slate-500">
                  <span>Caderno de Bancada</span>
                  <span>2 questões</span>
                </div>

                <div className="rounded-2xl border-2 border-teal-600 bg-teal-50/60 p-5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-md text-[12px] font-mono font-bold bg-teal-700 text-white">
                      {REAL_BENCH_QUESTION.code}
                    </span>
                    <span className="font-mono text-[12px] text-teal-800 font-semibold">
                      Em foco no visor &rarr;
                    </span>
                  </div>
                  <h4 className="font-sans font-bold text-[17px] text-slate-900 leading-snug">
                    {REAL_BENCH_QUESTION.title}
                  </h4>
                  <p className="text-[14.5px] text-slate-700 leading-relaxed border-l-2 border-teal-500 pl-3">
                    {REAL_BENCH_QUESTION.prompt}
                  </p>
                  <div className="pt-2 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono uppercase text-slate-500">
                      <span>Sua Anotação Diagnóstica</span>
                      <span className="text-teal-700 font-semibold">
                        {REAL_BENCH_QUESTION.status}
                      </span>
                    </div>
                    <div className="w-full rounded-xl bg-white border border-teal-600/40 p-3 text-[13.5px] text-slate-800 font-medium">
                      {REAL_BENCH_QUESTION.notePreview}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[12px] text-slate-400 font-mono">
              <span>Junqueira &amp; Carneiro</span>
              <span>Resolução 1:1 Verificada</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// ============================================================================
// ACT 4 (17.2s - 22.4s): 16:9 WIDESCREEN MULTI-DEVICE + 3 PILLARS
// ============================================================================
function HorizScene4MultiDevice({ t }: { t: number }) {
  if (t < 17.05 || t > 22.7) return null;

  const enterP = remap(t, 17.05, 17.95, 0, 1, EASE_OUT_EXPO);
  const exitP = remap(t, 22.15, 22.65, 1, 0, EASE_SMOOTH);
  const sceneOpacity = clamp01(Math.min(enterP, exitP));

  const floatPhase = (t - 17.2) * 0.85;
  const ipadFloatY = Math.sin(floatPhase) * 6;
  const phoneFloatY = Math.cos(floatPhase + 0.8) * 7;

  const pillar1P = remap(t, 17.85, 18.55, 0, 1, EASE_OUT_EXPO);
  const pillar2P = remap(t, 18.45, 19.15, 0, 1, EASE_OUT_EXPO);
  const pillar3P = remap(t, 19.05, 19.75, 0, 1, EASE_OUT_EXPO);

  const ossoPan = remap(t, 17.2, 22.4, 1.1, 1.22, EASE_CINEMATIC);
  const pelePan = remap(t, 17.2, 22.4, 1.12, 1.25, EASE_CINEMATIC);

  return (
    <div
      className="absolute inset-0 bg-[#f8fafc] text-slate-900 overflow-hidden flex flex-col justify-between px-16 py-12"
      style={{ opacity: sceneOpacity }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(15, 23, 42, 0.038) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.038) 1px, transparent 1px)',
          backgroundSize: '42px 42px',
        }}
      />

      {/* Top Headline Row */}
      <div className="relative z-10 flex items-end justify-between">
        <div>
          <div className="font-mono text-[14px] uppercase tracking-[0.24em] text-[#0369a1] font-bold mb-1.5">
            Portabilidade &amp; Velocidade • Estude em Qualquer Lugar
          </div>
          <h2 className="font-serif font-extrabold text-[48px] text-slate-950 leading-none tracking-tight">
            O laboratório inteiro{' '}
            <span className="text-[#0369a1]">no seu bolso ou bancada.</span>
          </h2>
        </div>

        <div className="inline-flex items-center gap-5 px-6 py-3 rounded-full bg-white border border-slate-200/90 shadow-xs font-mono text-[14px] text-slate-600 font-semibold">
          <span className="inline-flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#0369a1]" /> iPhone &amp; Android
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-2">
            <Tablet className="w-4 h-4 text-teal-700" /> iPad (Pinça nativa)
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-2">
            <Laptop className="w-4 h-4 text-slate-800" /> Notebook &amp; Desktop
          </span>
        </div>
      </div>

      {/* Center Widescreen Trio of Devices + Right Feature Column */}
      <div className="relative z-10 grid grid-cols-12 items-center gap-10 my-auto">
        {/* Left 7 Cols: Overlapping Laptop + iPad Pro + iPhone */}
        <div
          className="col-span-7 relative h-[560px] flex items-center justify-center"
          style={{ perspective: '1600px' }}
        >
          {/* Laptop Card */}
          <div
            className="absolute top-0 left-0 w-[600px] rounded-2xl bg-white border border-slate-200/90 shadow-[0_24px_60px_rgba(15,23,42,0.1)] overflow-hidden"
            style={{
              opacity: clamp01(enterP * 0.96),
              transform: `translate3d(${((1 - enterP) * -28).toFixed(1)}px, 0, 0) rotateY(5deg)`,
            }}
          >
            <div className="h-8 px-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <span className="font-mono text-[11px] text-slate-500">
                palasatlas.netlify.app
              </span>
              <span className="w-8" />
            </div>
            <div className="p-4 flex items-center justify-between bg-gradient-to-r from-[#edf4f3] to-white">
              <PalasClinicalLogo theme="light-bg" size="xs" />
              <div className="flex items-center gap-2 text-[12px] font-medium text-slate-600">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white">Histologia</span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200">Anatomia</span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200">Patologia</span>
              </div>
            </div>
          </div>

          {/* iPad Pro Mockup */}
          <div
            className="relative z-10 -ml-10 mt-16 w-[660px] h-[440px] rounded-[30px] bg-slate-900 p-[11px] shadow-[0_34px_80px_rgba(15,23,42,0.26)] border border-slate-700/80"
            style={{
              transform: `translate3d(0, ${(ipadFloatY + (1 - enterP) * 24).toFixed(
                1
              )}px, 0) rotateY(-4deg) rotateX(2deg)`,
            }}
          >
            <div className="w-full h-full rounded-[20px] overflow-hidden bg-[#f8fafc] flex flex-col">
              <div className="h-10 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                <PalasClinicalLogo theme="light-bg" size="xs" />
                <span className="px-2.5 py-0.5 rounded-lg bg-[#f0fdfa] border border-[#5eead4] text-[#0f766e] font-sans text-[11px] font-semibold">
                  Marcações 3 • iPad Touch
                </span>
              </div>
              <div className="flex-1 grid grid-cols-12 overflow-hidden">
                <div className="col-span-8 relative bg-[#eef2f6] overflow-hidden">
                  <img
                    src="/teaser-assets/osso-maduro-40x-hd.jpg"
                    alt="Osso Maduro no iPad"
                    className="w-full h-full object-cover"
                    style={{ transform: `scale(${ossoPan.toFixed(3)})` }}
                  />
                  <div className="absolute left-[46%] top-[44%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                    <div className="w-7 h-7 rounded-full bg-[#d97706] border-2 border-white text-white font-mono text-[12px] font-bold flex items-center justify-center shadow-lg">
                      1
                    </div>
                    <div className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-200 border border-amber-400 text-[10px] font-semibold whitespace-nowrap">
                      Canal de Havers
                    </div>
                  </div>
                </div>
                <div className="col-span-4 bg-white border-l border-slate-200 p-3 flex flex-col justify-between">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-slate-400">
                      Análise Morfológica
                    </span>
                    <h4 className="font-serif font-bold text-[15px] text-slate-900 mt-0.5">
                      Osso Maduro 40×
                    </h4>
                    <p className="mt-2 text-[11px] text-slate-600 leading-relaxed">
                      Sistemas de Havers com lamelas concêntricas e canalículos radiados.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 font-mono text-[9px] text-teal-700 font-semibold">
                    Junqueira &amp; Carneiro
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* iPhone 16 Pro Mockup */}
          <div
            className="absolute right-2 bottom-0 z-20 w-[250px] h-[495px] rounded-[40px] bg-slate-950 p-[10px] border-[2px] border-slate-600/80 shadow-[0_32px_70px_rgba(15,23,42,0.36)]"
            style={{
              transform: `translate3d(${((1 - enterP) * 32).toFixed(1)}px, ${(
                phoneFloatY +
                (1 - enterP) * 20
              ).toFixed(1)}px, 0) rotateY(6deg)`,
            }}
          >
            <div className="w-full h-full rounded-[31px] overflow-hidden bg-[#eef2f6] flex flex-col relative">
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 rounded-full bg-black z-30" />
              <div className="pt-8 pb-2 px-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                <span className="font-display font-bold text-[11px] tracking-[0.16em] text-[#0f172a]">
                  PALAS <span className="text-[#0369a1]">ATLAS</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-[9px] font-mono font-bold text-teal-800">
                  40×
                </span>
              </div>
              <div className="relative flex-1 overflow-hidden">
                <img
                  src="/teaser-assets/pele-espessa-hd.jpg"
                  alt="Pele Espessa no iPhone"
                  className="w-full h-full object-cover"
                  style={{
                    transform: `scale(${pelePan.toFixed(3)}) translate3d(-4%, -6%, 0)`,
                  }}
                />
                <div className="absolute left-[42%] top-[36%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div className="w-6 h-6 rounded-full bg-[#d97706] border-2 border-white text-white font-mono text-[11px] font-bold flex items-center justify-center shadow-lg">
                    2
                  </div>
                  <div className="mt-1 px-2 py-0.5 rounded-full bg-slate-900 text-amber-200 border border-amber-400 text-[9px] font-semibold whitespace-nowrap">
                    Interface Dermo-Epidérmica
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: 3 Vertical Differential Cards */}
        <div className="col-span-5 space-y-4">
          {[
            {
              p: pillar1P,
              icon: <Zap className="w-6 h-6 text-teal-700" />,
              tag: '24/7 Livre',
              title: 'Sem depender do horário do laboratório',
              desc: 'Revise lâminas reais no iPad, celular ou notebook antes da prova prática.',
            },
            {
              p: pillar2P,
              icon: <Crosshair className="w-6 h-6 text-[#0369a1]" />,
              tag: '0,156 µm/px',
              title: 'Calibração óptica real verificada',
              desc: 'Objetivas de 4×, 10× e 40× com régua física em micrômetros e zero pixel esticado.',
            },
            {
              p: pillar3P,
              icon: <Sparkles className="w-6 h-6 text-teal-700" />,
              tag: '100% Gratuito',
              title: 'Acesso aberto e imediato',
              desc: 'Sem mensalidades e sem cadastro obrigatório. Feito por estudantes para estudantes.',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl bg-white/[0.96] border border-slate-200/90 shadow-[0_12px_32px_rgba(15,23,42,0.06)] p-6 flex items-start gap-4"
              style={{
                opacity: item.p,
                transform: `translate3d(${((1 - item.p) * 28).toFixed(1)}px, 0, 0)`,
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0 mt-0.5">
                {item.icon}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="font-serif font-bold text-[22px] text-slate-950 leading-tight">
                    {item.title}
                  </h3>
                  <span className="font-mono text-[12px] font-bold tracking-wider text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full shrink-0">
                    {item.tag}
                  </span>
                </div>
                <p className="font-sans text-[16px] text-slate-600 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ACT 5 (22.4s - 26.0s): 16:9 WIDESCREEN PRESTIGIOUS FINALE & CTA
// ============================================================================
function HorizScene5Outro({ t }: { t: number }) {
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
      className="absolute inset-0 bg-gradient-to-b from-[#edf4f3] via-[#f8fafc] to-white text-slate-950 flex flex-col items-center justify-center overflow-hidden px-16"
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
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[980px] h-[980px] text-teal-950 pointer-events-none select-none flex items-center justify-center"
        style={{ opacity: 0.042 }}
      >
        <PalasOwlIcon className="w-full h-full" />
      </div>

      <div className="relative z-10 flex flex-col items-center text-center max-w-[1120px]">
        <div
          style={{
            opacity: logoP,
            transform: `translate3d(0, ${((1 - logoP) * 20).toFixed(1)}px, 0) scale(${(
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
          className="my-7 h-[3px] rounded-full bg-gradient-to-r from-slate-900 via-[#0369a1] to-teal-600"
          style={{
            width: `${Math.round(logoP * 200)}px`,
            opacity: logoP,
          }}
        />

        <div
          className="flex flex-wrap items-center justify-center gap-3 mb-6"
          style={{
            opacity: headlineP,
            transform: `translate3d(0, ${((1 - headlineP) * 14).toFixed(1)}px, 0)`,
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
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-slate-200/90 shadow-xs text-[17px] font-semibold text-slate-700"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${d.dot}`} />
              {d.name}
            </span>
          ))}
        </div>

        <h2
          className="font-serif font-extrabold text-[62px] leading-[1.08] tracking-tight text-slate-950 mb-8"
          style={{
            opacity: headlineP,
            transform: `translate3d(0, ${((1 - headlineP) * 16).toFixed(1)}px, 0)`,
          }}
        >
          Chegue pronto na{' '}
          <span className="text-[#0369a1]">prova prática.</span>
        </h2>

        <div
          className="flex items-center justify-center gap-5"
          style={{
            opacity: clamp01(ctaP),
            transform: `scale(${(0.92 + ctaP * 0.08).toFixed(3)})`,
          }}
        >
          <div className="relative overflow-hidden inline-flex items-center gap-3.5 px-9 py-5 rounded-2xl bg-slate-900 text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)] border border-slate-800">
            <span className="font-sans font-bold text-[24px] tracking-tight">
              Acesse gratuitamente agora
            </span>
            <ArrowUpRight className="w-6 h-6 text-[#d4af37]" />
            <span
              aria-hidden="true"
              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 pointer-events-none"
              style={{ transform: `translateX(${shimmerX.toFixed(1)}%) skewX(-18deg)` }}
            />
          </div>

          <div className="inline-flex items-center gap-3 px-7 py-5 rounded-2xl bg-white border-2 border-[#0369a1]/35 shadow-md">
            <Globe className="w-6 h-6 text-[#0369a1]" />
            <span className="font-mono font-bold text-[24px] tracking-wide text-[#0369a1]">
              palasatlas.netlify.app
            </span>
          </div>
        </div>

        <p
          className="font-sans text-[18px] font-medium text-slate-500 mt-5"
          style={{ opacity: clamp01(ctaP) }}
        >
          100% gratuito &bull; Sem cadastro &bull; Feito para estudantes de medicina
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// MASTER 1920x1080 HORIZONTAL STAGE + STUDIO CONSOLE
// ============================================================================
export interface PalasHorizontalTeaserProps {
  recordMode?: boolean;
  deterministicMode?: boolean;
  initialTimeSec?: number;
}

export function PalasHorizontalTeaser({
  recordMode = false,
  deterministicMode = false,
  initialTimeSec = 0,
}: PalasHorizontalTeaserProps) {
  const [t, setT] = useState(() =>
    Math.max(0, Math.min(REEL_DURATION_SEC, initialTimeSec))
  );
  const [isPlaying, setIsPlaying] = useState(() => !deterministicMode);
  const [isMuted, setIsMuted] = useState(false);
  const [previewScale, setPreviewScale] = useState(0.55);

  const timeRef = useRef(t);
  const lastMsRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  useEffect(() => {
    if (recordMode) {
      setPreviewScale(1);
      return;
    }
    const computeScale = () => {
      const availH = Math.max(320, window.innerHeight - 210);
      const availW = Math.max(480, window.innerWidth - 64);
      setPreviewScale(Math.min(0.75, availH / HORIZ_HEIGHT, availW / HORIZ_WIDTH));
    };
    computeScale();
    window.addEventListener('resize', computeScale);
    return () => window.removeEventListener('resize', computeScale);
  }, [recordMode]);

  useEffect(() => {
    if (deterministicMode || !isPlaying) {
      lastMsRef.current = null;
      return;
    }
    let rafId = 0;
    const tick = (now: number) => {
      if (lastMsRef.current === null) lastMsRef.current = now;
      const dt = Math.min((now - lastMsRef.current) / 1000, 0.08);
      lastMsRef.current = now;
      let next = timeRef.current + dt;
      if (next >= REEL_DURATION_SEC) next = next % REEL_DURATION_SEC;
      timeRef.current = next;
      setT(next);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, deterministicMode]);

  const seekTo = useCallback((sec: number) => {
    const clamped = Math.max(0, Math.min(REEL_DURATION_SEC, sec));
    timeRef.current = clamped;
    setT(clamped);
    if (audioRef.current) audioRef.current.currentTime = clamped;
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
      id="palas-horizontal-stage"
      className="relative overflow-hidden bg-[#f8fafc] select-none font-sans antialiased"
      style={{
        width: HORIZ_WIDTH,
        height: HORIZ_HEIGHT,
        transform: recordMode ? undefined : `scale(${previewScale})`,
        transformOrigin: 'top left',
      }}
    >
      <HorizScene1Hook t={t} />
      <HorizScene2Disciplines t={t} />
      <HorizScene3Microscope t={t} />
      <HorizScene4MultiDevice t={t} />
      <HorizScene5Outro t={t} />
    </div>
  );

  if (recordMode) {
    return (
      <div
        className="w-[1920px] h-[1080px] overflow-hidden bg-black m-0 p-0"
        data-frame={currentFrame}
      >
        {stageNode}
      </div>
    );
  }

  const scaledW = Math.round(HORIZ_WIDTH * previewScale);
  const scaledH = Math.round(HORIZ_HEIGHT * previewScale);

  return (
    <div className="w-full flex flex-col items-center justify-center gap-4">
      <audio
        ref={audioRef}
        src="/teaser-assets/palas-reels-soundtrack.mp3"
        preload="auto"
        loop
      />
      <div
        className="relative rounded-[22px] overflow-hidden border border-white/15 shadow-[0_32px_90px_rgba(0,0,0,0.8)] bg-black shrink-0"
        style={{ width: scaledW, height: scaledH }}
      >
        {stageNode}
      </div>

      <div className="w-full max-w-[960px] rounded-2xl bg-[#0a0f1a]/95 border border-white/10 p-4 shadow-2xl space-y-3">
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
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px] text-slate-300 tabular-nums">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-teal-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              1920×1080 (16:9) • {REEL_FPS}fps
            </span>
            <span>
              {t.toFixed(2)}s / {REEL_DURATION_SEC.toFixed(2)}s
            </span>
          </div>
        </div>

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
        />

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
            href="/teaser-horizontal?record=1"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#d4af37]/15 hover:bg-[#d4af37]/25 border border-[#d4af37]/40 text-[11px] font-semibold text-[#f3dca2] no-underline transition-colors"
          >
            <Film className="w-3.5 h-3.5" />
            <span>Modo 1920×1080 Puro</span>
          </a>
        </div>
      </div>
    </div>
  );
}

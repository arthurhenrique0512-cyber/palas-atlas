'use client';

import React from 'react';
import {
  Search,
  Layers,
  FlaskConical,
  Compass,
  GraduationCap,
  ArrowRight,
  Microscope,
} from 'lucide-react';
import { EASE_OUT_EXPO, EASE_SMOOTH, clamp01, remap } from '../timeline';
import { REAL_DISCIPLINES, DisciplineKey } from '../palasCatalogBridge';
import { PalasClinicalHeader } from '../PalasClinicalHeader';
import { Osteology3DPreview } from '../Osteology3DPreview';
import { KineticCaption } from '../KineticCaption';

interface Scene2DisciplineMorphProps {
  t: number;
}

// 4.0s total (4.20s - 8.20s): 3 unhurried spotlight moments (~1.35s each)
const DISCIPLINE_WINDOWS: { id: DisciplineKey; start: number; end: number }[] = [
  { id: 'histologia', start: 4.2, end: 5.55 },
  { id: 'anatomia', start: 5.55, end: 6.9 },
  { id: 'patologia', start: 6.9, end: 8.3 },
];

export function Scene2DisciplineMorph({ t }: Scene2DisciplineMorphProps) {
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

  // Smooth, unhurried typing simulation inside Palas Atlas search bar
  const fullQuery = 'Osso Maduro • Pele Espessa';
  const charCount = Math.floor(remap(t, 4.35, 6.6, 0, fullQuery.length));
  const typedQuery = fullQuery.slice(0, charCount);

  return (
    <div
      className="absolute inset-0 bg-[#f8fafc] text-slate-900 flex flex-col overflow-hidden"
      style={{
        opacity: sceneOpacity,
        transform: `scale(${(0.98 + enterP * 0.02).toFixed(3)})`,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(15, 23, 42, 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(15, 23, 42, 0.035) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-20">
        <PalasClinicalHeader breadcrumb="Acervo Integrado" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col justify-center px-12 pt-[180px] pb-[290px] gap-6">
        <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-[0_16px_44px_rgba(15,23,42,0.06)] p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="font-sans text-[22px] font-bold text-slate-900 tracking-tight">
              Pesquise no Acervo Morfológico
            </span>
            <span className="font-mono text-[14px] uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full font-semibold">
              5 Disciplinas
            </span>
          </div>

          <div className="relative flex items-center bg-slate-50 border-2 border-[#0369a1]/45 rounded-2xl px-5 py-4 shadow-sm">
            <Search className="w-6 h-6 text-[#0369a1] mr-4 shrink-0" />
            <span className="font-sans text-[22px] text-slate-900 font-medium">
              {typedQuery || 'Buscar tecidos, órgãos ou lâminas...'}
            </span>
            <span className="ml-1 w-[2.5px] h-6 bg-[#0369a1]" />
          </div>

          <div className="mt-5 flex flex-wrap gap-2.5">
            {REAL_DISCIPLINES.map((disc) => {
              const isSelected = disc.id === activeDisc.id;
              return (
                <div
                  key={disc.id}
                  className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-[18px] font-semibold transition-colors ${
                    isSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-[1.03]'
                      : 'bg-white text-slate-600 border-slate-200/90'
                  }`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full ${disc.dotClass}`} />
                  <span>{disc.label === 'Anatomia Humana' ? 'Anatomia' : disc.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Discipline Hero Spotlight Card */}
        <div
          className="w-full rounded-[28px] overflow-hidden border shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
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
          <div className="p-7 flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div
                  className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border text-[14px] font-mono font-semibold uppercase tracking-wider mb-3 ${
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

                <h2 className="font-serif font-extrabold text-[40px] leading-tight tracking-tight">
                  {activeDisc.label}
                </h2>
                <p
                  className={`mt-1.5 text-[20px] leading-snug ${
                    activeDisc.id === 'histologia' ? 'text-slate-300' : 'text-slate-600'
                  }`}
                >
                  {activeDisc.subtitle}
                </p>
              </div>
            </div>

            <div className="relative w-full h-[360px] rounded-2xl overflow-hidden border border-slate-200/20 bg-slate-950 flex items-center justify-center">
              {activeDisc.id === 'anatomia' ? (
                <div className="w-full h-full bg-gradient-to-br from-[#070b14] via-[#0c1a2a] to-[#050811] flex items-center justify-between px-6">
                  <Osteology3DPreview t={t - 5.55} width={440} height={350} />
                  <div className="flex-1 space-y-2.5 pr-2">
                    <div className="font-mono text-[13px] uppercase tracking-widest text-[#d4af37]">
                      Osteologia 3D PBR
                    </div>
                    <div className="font-serif font-bold text-[26px] text-white leading-tight">
                      Escápula Direita
                    </div>
                    <div className="space-y-1.5 pt-2">
                      {['01 Fossa Supraespinal', '02 Tub. Infraglenoidal', '03 Processo Coracóide'].map(
                        (item) => (
                          <div
                            key={item}
                            className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-[15px] text-slate-200 font-medium"
                          >
                            {item}
                          </div>
                        )
                      )}
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
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/70 border border-white/20 text-white text-[16px] font-semibold">
                      <Microscope className="w-4 h-4 text-teal-300" />
                      <span>Microscopia Real 40×</span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-600 text-white text-[16px] font-semibold shadow-lg">
                      <span>Abrir Lâmina</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {activeDisc.topics.slice(0, 2).map((topic, idx) => (
                <div
                  key={topic}
                  className={`px-4 py-3 rounded-xl border text-[16px] font-medium truncate flex items-center gap-2.5 ${
                    activeDisc.id === 'histologia'
                      ? 'bg-white/[0.06] border-white/10 text-slate-200'
                      : 'bg-slate-50 border-slate-200/80 text-slate-700'
                  }`}
                >
                  <span className="font-mono text-[14px] font-bold text-teal-500">
                    0{idx + 1}
                  </span>
                  <span className="truncate">{topic}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <KineticCaption
        t={t}
        start={4.25}
        end={8.15}
        variant="light"
        position="top"
        eyebrow="Palas Atlas • Plataforma Gratuita"
        headline={
          <>
            5 áreas do ciclo básico.{' '}
            <span className="text-teal-700">Acervo real.</span>
          </>
        }
      />
    </div>
  );
}

'use client';

import React from 'react';
import {
  EASE_CINEMATIC,
  EASE_OUT_EXPO,
  EASE_SMOOTH,
  clamp01,
  lerp,
  remap,
} from '../timeline';
import {
  PELE_ESPESSA_PINS,
  OSSO_MADURO_PINS,
  REAL_BENCH_QUESTION,
  SpecimenPin,
} from '../palasCatalogBridge';
import { PalasClinicalHeader } from '../PalasClinicalHeader';
import { KineticCaption } from '../KineticCaption';

interface Scene3MicroscopeZoomProps {
  t: number;
}

const STAGE_W = 1080;
const STAGE_H = 1831;

interface CameraSample {
  focusXPct: number;
  focusYPct: number;
  scale: number;
  targetX: number;
  targetY: number;
  magDisplay: number;
  activeLens: 4 | 10 | 40;
  activePinId: string;
}

function samplePeleCamera(t: number): CameraSample {
  // 8.20s - 9.30s: Calm 4.0x panoramic overview
  if (t < 9.3) {
    const p = remap(t, 8.2, 9.3, 0, 1, EASE_SMOOTH);
    return {
      focusXPct: lerp(48, 43, p),
      focusYPct: lerp(36, 32, p),
      scale: lerp(1.0, 1.08, p),
      targetX: 540,
      targetY: 730,
      magDisplay: lerp(4.0, 4.4, p),
      activeLens: 4,
      activePinId: 'pin-interface',
    };
  }

  // 9.30s - 11.10s: Slow, silky 1.5s glide into 10.0x on Interface Dermo-Epidérmica (Pin 2)
  if (t < 11.1) {
    const p = remap(t, 9.3, 10.75, 0, 1, EASE_CINEMATIC);
    return {
      focusXPct: lerp(43, 37.5, p),
      focusYPct: lerp(32, 27.8, p),
      scale: lerp(1.08, 2.02, p),
      targetX: 540,
      targetY: 710,
      magDisplay: lerp(4.4, 10.0, p),
      activeLens: p > 0.25 ? 10 : 4,
      activePinId: 'pin-interface',
    };
  }

  // 11.10s - 13.40s: Unhurried 1.85s optical dive to 40.0x on Hemácia / Vaso Sanguíneo (Pin 4) + hold
  const p = remap(t, 11.1, 12.65, 0, 1, EASE_CINEMATIC);
  const microHold = remap(t, 12.65, 13.4, 0, 1, EASE_SMOOTH);
  return {
    focusXPct: lerp(37.5, 89.58, p),
    focusYPct: lerp(27.8, 83.66, p),
    scale: lerp(2.02, 3.35, p) + microHold * 0.1,
    targetX: lerp(540, 620, p),
    targetY: lerp(710, 730, p),
    magDisplay: lerp(10.0, 40.0, p),
    activeLens: p > 0.22 ? 40 : 10,
    activePinId: p > 0.55 ? 'pin-hemacia' : 'pin-colageno',
  };
}

function sampleOssoCamera(t: number): CameraSample {
  // 13.40s - 15.20s: Smooth 1.7s glide from Pin 1 (Canal de Havers upper) to Pin 3 (Central Osteon)
  if (t < 15.2) {
    const p = remap(t, 13.4, 15.05, 0, 1, EASE_CINEMATIC);
    return {
      focusXPct: lerp(28.4, 56.3, p),
      focusYPct: lerp(16.4, 78.2, p),
      scale: lerp(1.5, 2.4, p),
      targetX: 540,
      targetY: 695,
      magDisplay: lerp(14.0, 40.0, p),
      activeLens: p > 0.35 ? 40 : 10,
      activePinId: p > 0.55 ? 'pin-osteon-central' : 'pin-havers-sup',
    };
  }

  // 15.20s - 17.20s: Calm 2.0s hold on Central Osteon while Caderno de Bancada is read
  const p = remap(t, 15.2, 17.2, 0, 1, EASE_SMOOTH);
  return {
    focusXPct: lerp(56.3, 55.0, p),
    focusYPct: lerp(78.2, 76.2, p),
    scale: lerp(2.4, 2.55, p),
    targetX: 540,
    targetY: 685,
    magDisplay: 40.0,
    activeLens: 40,
    activePinId: 'pin-osteon-central',
  };
}

export function Scene3MicroscopeZoom({ t }: Scene3MicroscopeZoomProps) {
  if (t < 8.05 || t > 17.65) return null;

  const enterP = remap(t, 8.05, 8.65, 0, 1, EASE_OUT_EXPO);
  const exitP = remap(t, 17.05, 17.6, 1, 0, EASE_SMOOTH);
  const sceneOpacity = clamp01(Math.min(enterP, exitP));

  const isOssoPhase = t >= 13.4;
  const crossfadeOsso = remap(t, 13.15, 13.75, 0, 1, EASE_SMOOTH);

  const cam = isOssoPhase ? sampleOssoCamera(t) : samplePeleCamera(t);

  const imgW = isOssoPhase ? 1440 : 1080;
  const imgH = isOssoPhase ? 1440 : 1938;

  const focusPxX = (cam.focusXPct / 100) * imgW;
  const focusPxY = (cam.focusYPct / 100) * imgH;
  const rawTx = cam.targetX - focusPxX * cam.scale;
  const rawTy = cam.targetY - focusPxY * cam.scale;
  const minTx = Math.min(0, STAGE_W - imgW * cam.scale);
  const minTy = Math.min(0, STAGE_H - imgH * cam.scale);
  const tx = Math.min(0, Math.max(minTx, rawTx));
  const ty = Math.min(0, Math.max(minTy, rawTy));

  const activePins: SpecimenPin[] = isOssoPhase ? OSSO_MADURO_PINS : PELE_ESPESSA_PINS;

  const umValue = Math.max(25, Math.round(2000 / cam.magDisplay));
  const scalebarLabel = umValue >= 1000 ? `${(umValue / 1000).toFixed(1)} mm` : `${umValue} µm`;

  // Smooth, unhurried slide-up clinical cards (0.60s entrance)
  const peleCardP =
    t >= 11.55 && t < 13.4
      ? Math.min(
          remap(t, 11.55, 12.15, 0, 1, EASE_OUT_EXPO),
          remap(t, 13.0, 13.4, 1, 0, EASE_SMOOTH)
        )
      : 0;
  const ossoCardP =
    t >= 14.65
      ? Math.min(
          remap(t, 14.65, 15.25, 0, 1, EASE_OUT_EXPO),
          remap(t, 16.95, 17.45, 1, 0, EASE_SMOOTH)
        )
      : 0;
  const activeCardP = isOssoPhase ? ossoCardP : peleCardP;

  // Gentle tap ripple on objective revolver buttons (9.20s on 10x, 11.00s on 40x)
  const tap10x = t >= 9.1 && t <= 9.65 ? remap(t, 9.1, 9.65, 0, 1) : 0;
  const tap40x = t >= 10.95 && t <= 11.5 ? remap(t, 10.95, 11.5, 0, 1) : 0;

  const navW = 148;
  const navH = 112;
  const boxW = clamp01(1 / (cam.scale * 1.15)) * navW;
  const boxH = clamp01(1 / (cam.scale * 0.95)) * navH;
  const boxLeft = clamp01(cam.focusXPct / 100 - boxW / (2 * navW)) * navW;
  const boxTop = clamp01(cam.focusYPct / 100 - boxH / (2 * navH)) * navH;

  return (
    <div
      className="absolute inset-0 bg-[#eef2f6] text-slate-800 flex flex-col overflow-hidden"
      style={{ opacity: sceneOpacity }}
    >
      <div className="relative z-30">
        <PalasClinicalHeader
          showMicroscopeControls
          markersVisible
          markersCount={activePins.length}
          breadcrumb={isOssoPhase ? 'Osso Maduro 40×' : 'Pele Espessa'}
        />
      </div>

      <div
        className="relative flex-1 overflow-hidden bg-[#eef2f6]"
        style={{ width: STAGE_W, height: STAGE_H }}
      >
        <div
          className="absolute top-0 left-0 will-change-transform"
          style={{
            width: imgW,
            height: imgH,
            transformOrigin: '0 0',
            transform: `translate3d(${tx.toFixed(2)}px, ${ty.toFixed(2)}px, 0) scale(${cam.scale.toFixed(
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

        {/* Gentle optical cross-dissolve veil on specimen switch */}
        {crossfadeOsso > 0 && crossfadeOsso < 1 && (
          <div
            className="absolute inset-0 bg-white pointer-events-none z-20"
            style={{ opacity: Math.sin(crossfadeOsso * Math.PI) * 0.42 }}
          />
        )}

        {/* Native-Resolution Pin Overlays */}
        <div className="absolute inset-0 pointer-events-none z-20">
          {activePins.map((pin) => {
            const px = (pin.xPct / 100) * imgW;
            const py = (pin.yPct / 100) * imgH;
            const screenX = tx + px * cam.scale;
            const screenY = ty + py * cam.scale;

            if (
              screenX < -100 ||
              screenX > STAGE_W + 100 ||
              screenY < -100 ||
              screenY > STAGE_H + 100
            ) {
              return null;
            }

            const isActive = pin.id === cam.activePinId;
            const radarCycle = (t * 0.55) % 1; // Slower radar pulse
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
                      width: 68,
                      height: 68,
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
                    width: isActive ? 46 : 36,
                    height: isActive ? 46 : 36,
                    fontSize: isActive ? 19 : 15,
                    backgroundColor: isActive ? '#d97706' : '#0f766e',
                    boxShadow: isActive
                      ? '0 0 0 2.5px #0f172a, 0 0 26px rgba(245,158,11,0.9), 0 6px 18px rgba(15,23,42,0.5)'
                      : '0 3px 12px rgba(15,23,42,0.45), 0 0 0 1.5px rgba(15,23,42,0.22)',
                  }}
                >
                  {pin.number}
                </div>

                {isActive && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 mt-2.5 whitespace-nowrap px-4 py-1.5 rounded-full bg-slate-900 text-[#fef3c7] border-2 border-[#fbbf24] shadow-[0_0_0_2px_rgba(255,255,255,0.94),0_10px_28px_rgba(15,23,42,0.45)] flex items-center gap-2 font-sans text-[18px] font-bold"
                    style={{
                      top: '100%',
                    }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#fbbf24] shadow-[0_0_8px_#fbbf24]" />
                    <span>{pin.label}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Scalebar */}
        <div
          className="absolute right-8 z-30 bg-white/[0.95] border border-slate-300 rounded-xl px-4 py-2 shadow-[0_6px_18px_rgba(15,23,42,0.12)] flex flex-col items-center"
          style={{ top: 325 }}
        >
          <span className="font-mono text-[16px] font-bold text-slate-900 leading-none mb-1.5 tabular-nums">
            {scalebarLabel}
          </span>
          <div className="w-[104px] h-[3px] bg-slate-900 relative">
            <span className="absolute left-0 -top-1 w-[2px] h-[10px] bg-slate-900" />
            <span className="absolute right-0 -top-1 w-[2px] h-[10px] bg-slate-900" />
          </div>
        </div>

        {/* Slide Identity Chip */}
        <div
          className="absolute left-8 z-30 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-white/[0.95] border border-slate-200/90 shadow-md"
          style={{ top: 325 }}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
          <span className="font-serif font-bold text-[18px] text-slate-900">
            {isOssoPhase ? 'Osso Maduro 40× (Desgaste)' : 'Pele Espessa (Tricrômico/H&E)'}
          </span>
        </div>

        {/* Navigator Minimap */}
        <div
          className="absolute right-8 z-30 rounded-xl overflow-hidden bg-white/[0.95] border border-slate-300 shadow-[0_10px_28px_rgba(15,23,42,0.16)]"
          style={{ width: navW, height: navH, bottom: 424 }}
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

        {/* Slide-Up Clinical Info Card */}
        {activeCardP > 0.01 && (
          <div
            className="absolute left-7 right-[196px] z-30 rounded-2xl bg-white/[0.96] border border-slate-200 shadow-[0_20px_50px_rgba(15,23,42,0.2)] p-5"
            style={{
              bottom: 424,
              opacity: activeCardP,
              transform: `translate3d(0, ${((1 - activeCardP) * 24).toFixed(1)}px, 0)`,
            }}
          >
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-slate-200">
              <div
                className={`px-3.5 py-1.5 rounded-lg text-[15px] font-semibold ${
                  !isOssoPhase
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                Descrição
              </div>
              <div
                className={`px-3.5 py-1.5 rounded-lg text-[15px] font-semibold flex items-center gap-1.5 ${
                  isOssoPhase
                    ? 'bg-teal-700 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <span>Questões</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[12px] font-mono ${
                    isOssoPhase ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  2
                </span>
              </div>
            </div>

            {!isOssoPhase ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[13px] uppercase tracking-wider text-amber-700 font-bold">
                    PIN 04 • EM FOCO
                  </span>
                  <span className="font-mono text-[13px] text-teal-700 font-semibold">
                    Calibrado 0,156 µm/px
                  </span>
                </div>
                <p className="text-[17px] text-slate-700 leading-snug">
                  Na derme evidenciam-se{' '}
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border-b-2 border-amber-500 font-semibold">
                    hemácias em arteríola dérmica
                  </span>{' '}
                  (ref. biológica 7,5 µm) e densas fibras colágenas.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded bg-teal-50 border border-teal-200 font-mono text-[13px] font-bold text-teal-800">
                    {REAL_BENCH_QUESTION.code} • CADERNO DE BANCADA
                  </span>
                  <span className="font-mono text-[13px] text-slate-500">
                    {REAL_BENCH_QUESTION.status}
                  </span>
                </div>
                <div className="font-sans font-bold text-[18px] text-slate-900">
                  {REAL_BENCH_QUESTION.title}
                </div>
                <p className="text-[16px] text-slate-600 leading-snug">
                  {REAL_BENCH_QUESTION.prompt}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Objective Revolver */}
        <div
          className="absolute left-7 z-35 flex items-center gap-2 p-2.5 rounded-2xl bg-white/[0.96] border border-slate-200/90 shadow-[0_18px_46px_rgba(15,23,42,0.18)] font-mono"
          style={{ bottom: 324 }}
        >
          {([4, 10, 40, 60, 100] as const).map((mag) => {
            const isDisabled = !isOssoPhase && mag > 40;
            const isSelected = cam.activeLens === mag;
            const ripple =
              (mag === 10 && tap10x > 0) || (mag === 40 && tap40x > 0)
                ? mag === 10
                  ? tap10x
                  : tap40x
                : 0;

            return (
              <div
                key={mag}
                className={`relative px-4 py-2.5 rounded-xl text-[18px] font-bold flex items-center justify-center ${
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

          <div className="w-px h-7 bg-slate-200 mx-1" />

          <div className="w-11 h-11 rounded-xl bg-slate-50 text-slate-700 font-bold text-[20px] flex items-center justify-center">
            +
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-50 text-slate-700 font-bold text-[20px] flex items-center justify-center">
            &minus;
          </div>
          <div className="px-3.5 h-11 rounded-xl bg-slate-50 text-slate-700 font-semibold text-[16px] flex items-center justify-center">
            1:1
          </div>

          <div className="w-px h-7 bg-slate-200 mx-1" />

          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0284c7]" />
            <span className="text-[#0369a1] font-bold text-[19px] tabular-nums">
              {cam.magDisplay >= 39.6
                ? '40x'
                : `${cam.magDisplay.toFixed(1)}x`}
            </span>
          </div>
        </div>
      </div>

      {/* Stage Captions */}
      <KineticCaption
        t={t}
        start={8.25}
        end={11.15}
        variant="light"
        position="top"
        eyebrow="Microscópio Digital DZI"
        headline={
          <>
            Zoom óptico até <span className="text-[#0369a1]">40× real.</span>
          </>
        }
      />
      <KineticCaption
        t={t}
        start={11.15}
        end={13.55}
        variant="light"
        position="top"
        eyebrow="Pinos Morfológicos"
        headline={
          <>
            Cada estrutura <span className="text-teal-700">identificada.</span>
          </>
        }
      />
      <KineticCaption
        t={t}
        start={13.55}
        end={17.2}
        variant="light"
        position="top"
        eyebrow="Caderno de Bancada"
        headline={
          <>
            Lâminas reais +{' '}
            <span className="text-[#0369a1]">revisão ativa.</span>
          </>
        }
      />
    </div>
  );
}

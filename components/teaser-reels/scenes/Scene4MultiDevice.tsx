'use client';

import React from 'react';
import { Tablet, Smartphone, Laptop, Zap, Crosshair, Sparkles } from 'lucide-react';
import { EASE_CINEMATIC, EASE_OUT_EXPO, EASE_SMOOTH, clamp01, remap } from '../timeline';
import { PalasClinicalLogo } from '../PalasClinicalHeader';
import { KineticCaption } from '../KineticCaption';

interface Scene4MultiDeviceProps {
  t: number;
}

export function Scene4MultiDevice({ t }: Scene4MultiDeviceProps) {
  if (t < 17.05 || t > 22.7) return null;

  const enterP = remap(t, 17.05, 17.95, 0, 1, EASE_OUT_EXPO);
  const exitP = remap(t, 22.15, 22.65, 1, 0, EASE_SMOOTH);
  const sceneOpacity = clamp01(Math.min(enterP, exitP));

  // Slower, gentler floating rhythm
  const floatPhase = (t - 17.2) * 0.85;
  const ipadFloatY = Math.sin(floatPhase) * 7;
  const phoneFloatY = Math.cos(floatPhase + 0.8) * 8;

  const pillar1P = remap(t, 17.9, 18.6, 0, 1, EASE_OUT_EXPO);
  const pillar2P = remap(t, 18.6, 19.3, 0, 1, EASE_OUT_EXPO);
  const pillar3P = remap(t, 19.3, 20.0, 0, 1, EASE_OUT_EXPO);

  const ossoPan = remap(t, 17.2, 22.4, 1.12, 1.24, EASE_CINEMATIC);
  const pelePan = remap(t, 17.2, 22.4, 1.15, 1.28, EASE_CINEMATIC);

  return (
    <div
      className="absolute inset-0 bg-[#f8fafc] text-slate-900 overflow-hidden flex flex-col"
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

      <div
        className="absolute top-[22%] left-1/2 -translate-x-1/2 w-[900px] h-[720px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(3,105,161,0.11) 0%, rgba(13,148,136,0.08) 45%, transparent 72%)',
        }}
      />

      <div
        className="relative flex-1 flex flex-col items-center justify-center px-10 pt-[270px] pb-[320px]"
        style={{ perspective: '1600px' }}
      >
        <div className="relative w-full max-w-[940px] h-[660px] flex items-center justify-center">
          {/* BACKGROUND LAPTOP / DESKTOP BROWSER CARD */}
          <div
            className="absolute -top-4 left-2 w-[680px] rounded-3xl bg-white border border-slate-200/90 shadow-[0_26px_70px_rgba(15,23,42,0.12)] overflow-hidden"
            style={{
              opacity: clamp01(enterP * 0.96),
              transform: `translate3d(${((1 - enterP) * -32).toFixed(1)}px, 0, 0) rotateY(6deg) rotateX(2deg)`,
            }}
          >
            <div className="h-9 px-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              </div>
              <span className="font-mono text-[12px] text-slate-500">
                palasatlas.netlify.app
              </span>
              <span className="w-8" />
            </div>
            <div className="p-5 flex items-center justify-between bg-gradient-to-r from-[#edf4f3] to-white">
              <PalasClinicalLogo theme="light-bg" size="xs" />
              <div className="flex items-center gap-2 text-[13px] font-medium text-slate-600">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white">Histologia</span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200">Anatomia</span>
                <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200">Patologia</span>
              </div>
            </div>
          </div>

          {/* CENTER-LEFT IPAD PRO MOCKUP */}
          <div
            className="relative z-10 -ml-20 mt-20 w-[700px] h-[470px] rounded-[34px] bg-slate-900 p-[12px] shadow-[0_38px_90px_rgba(15,23,42,0.28)] border border-slate-700/80"
            style={{
              transform: `translate3d(0, ${(ipadFloatY + (1 - enterP) * 32).toFixed(
                1
              )}px, 0) rotateY(-5deg) rotateX(3deg)`,
            }}
          >
            <div className="w-full h-full rounded-[24px] overflow-hidden bg-[#f8fafc] flex flex-col">
              <div className="h-11 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                <PalasClinicalLogo theme="light-bg" size="xs" />
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-[#f0fdfa] border border-[#5eead4] text-[#0f766e] font-sans text-[12px] font-semibold">
                    Marcações 3
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-sans text-[12px] font-semibold">
                    iPad • Touch
                  </span>
                </div>
              </div>

              <div className="flex-1 grid grid-cols-12 overflow-hidden">
                <div className="col-span-8 relative bg-[#eef2f6] overflow-hidden">
                  <img
                    src="/teaser-assets/osso-maduro-40x-hd.jpg"
                    alt="Osso Maduro 40x no iPad"
                    className="w-full h-full object-cover"
                    style={{ transform: `scale(${ossoPan.toFixed(3)})` }}
                  />
                  <div className="absolute left-[46%] top-[44%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-[#d97706] border-2 border-white text-white font-mono text-[13px] font-bold flex items-center justify-center shadow-lg">
                      1
                    </div>
                    <div className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-200 border border-amber-400 text-[11px] font-semibold whitespace-nowrap">
                      Canal de Havers
                    </div>
                  </div>
                  <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/95 border border-slate-200 shadow-md font-mono text-[11px] font-bold">
                    <span className="text-slate-500 px-1.5">4x</span>
                    <span className="text-slate-500 px-1.5">10x</span>
                    <span className="bg-[#0369a1] text-white px-2 py-0.5 rounded-lg">40x</span>
                  </div>
                </div>

                <div className="col-span-4 bg-white border-l border-slate-200 p-3.5 flex flex-col justify-between">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
                      Análise Morfológica
                    </span>
                    <h4 className="font-serif font-bold text-[17px] text-slate-900 leading-tight mt-0.5">
                      Osso Maduro 40×
                    </h4>
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-[10px] font-semibold text-teal-800">
                      Desgaste • Panorama 6×8
                    </span>
                    <p className="mt-2.5 text-[11.5px] text-slate-600 leading-relaxed">
                      Sistemas de Havers com lamelas concêntricas, lacunas osteocitárias e canalículos radiados.
                    </p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 font-mono text-[10px] text-teal-700 font-semibold">
                    Junqueira &amp; Carneiro
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* FOREGROUND-RIGHT IPHONE 16 PRO MOCKUP */}
          <div
            className="absolute right-4 bottom-0 z-20 w-[290px] h-[570px] rounded-[46px] bg-slate-950 p-[11px] border-[2px] border-slate-600/80 shadow-[0_36px_80px_rgba(15,23,42,0.38)]"
            style={{
              transform: `translate3d(${((1 - enterP) * 38).toFixed(1)}px, ${(
                phoneFloatY +
                (1 - enterP) * 24
              ).toFixed(1)}px, 0) rotateY(7deg) rotateX(2deg)`,
            }}
          >
            <div className="w-full h-full rounded-[36px] overflow-hidden bg-[#eef2f6] flex flex-col relative">
              <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-24 h-5 rounded-full bg-black z-30" />

              <div className="pt-9 pb-2.5 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
                <span className="font-display font-bold text-[13px] tracking-[0.16em] text-[#0f172a]">
                  PALAS <span className="text-[#0369a1]">ATLAS</span>
                </span>
                <span className="px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-[10px] font-mono font-bold text-teal-800">
                  40×
                </span>
              </div>

              <div className="relative flex-1 overflow-hidden">
                <img
                  src="/teaser-assets/pele-espessa-hd.jpg"
                  alt="Pele Espessa no celular"
                  className="w-full h-full object-cover"
                  style={{
                    transform: `scale(${pelePan.toFixed(3)}) translate3d(-4%, -6%, 0)`,
                  }}
                />
                <div className="absolute left-[42%] top-[36%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                  <div className="w-7 h-7 rounded-full bg-[#d97706] border-2 border-white text-white font-mono text-[12px] font-bold flex items-center justify-center shadow-lg">
                    2
                  </div>
                  <div className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-200 border border-amber-400 text-[10px] font-semibold whitespace-nowrap">
                    Interface Dermo-Epidérmica
                  </div>
                </div>

                <div className="absolute bottom-3 inset-x-3 rounded-2xl bg-white/95 border border-slate-200 p-2 flex items-center justify-between shadow-lg font-mono text-[11px] font-bold">
                  <span className="text-slate-500 px-1.5">4x</span>
                  <span className="text-slate-500 px-1.5">10x</span>
                  <span className="bg-[#0369a1] text-white px-2.5 py-1 rounded-lg">40x</span>
                  <span className="text-[#0369a1] bg-sky-50 px-2 py-1 rounded-lg">Pinça</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Differential Pills */}
        <div className="w-full max-w-[940px] grid grid-cols-3 gap-4 mt-10">
          {[
            {
              p: pillar1P,
              icon: <Zap className="w-6 h-6 text-teal-700" />,
              tag: '24/7 Livre',
              title: 'Sem horário de lab',
              desc: 'Revise no ônibus, plantão ou madrugada',
            },
            {
              p: pillar2P,
              icon: <Crosshair className="w-6 h-6 text-[#0369a1]" />,
              tag: '0,156 µm/px',
              title: 'Precisão óptica',
              desc: 'Escala física calibrada sem distorção',
            },
            {
              p: pillar3P,
              icon: <Sparkles className="w-6 h-6 text-teal-700" />,
              tag: '100% Aberto',
              title: 'Acesso imediato',
              desc: 'Celular, iPad ou notebook • Sem cadastro',
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl bg-white/95 border border-slate-200/90 shadow-[0_12px_32px_rgba(15,23,42,0.06)] p-5 flex flex-col gap-2"
              style={{
                opacity: item.p,
                transform: `translate3d(0, ${((1 - item.p) * 18).toFixed(1)}px, 0)`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-teal-50 flex items-center justify-center">
                  {item.icon}
                </div>
                <span className="font-mono text-[13px] font-bold tracking-wider text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full">
                  {item.tag}
                </span>
              </div>
              <div className="font-serif font-bold text-[22px] text-slate-950 leading-tight mt-1">
                {item.title}
              </div>
              <p className="font-sans text-[15px] text-slate-600 leading-snug">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        <div
          className="mt-5 inline-flex items-center gap-6 px-6 py-2.5 rounded-full bg-white/90 border border-slate-200/90 shadow-sm font-mono text-[14px] text-slate-600 font-semibold"
          style={{ opacity: pillar1P }}
        >
          <span className="inline-flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#0369a1]" /> iPhone &amp; Android
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-2">
            <Tablet className="w-4 h-4 text-teal-700" /> iPad (Pinça nativa)
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-2">
            <Laptop className="w-4 h-4 text-slate-800" /> Notebook
          </span>
        </div>
      </div>

      <KineticCaption
        t={t}
        start={17.25}
        end={22.3}
        variant="light"
        position="top"
        eyebrow="Portabilidade & Velocidade"
        headline={
          <>
            O laboratório inteiro{' '}
            <span className="text-[#0369a1]">no seu bolso.</span>
          </>
        }
      />
    </div>
  );
}

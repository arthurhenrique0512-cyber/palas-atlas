'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { PalasOwlIcon } from './PalasBrandMark';

/**
 * Stylized Desktop + Mobile App Mockups showcasing Palas Atlas running
 * the interactive 3D Right Scapula & Classic Atlas Cross-Reference module.
 */
export function AppDeviceMockups() {
  return (
    <div className="relative w-full max-w-[340px] mx-auto select-none">
      {/* Subtle studio pedestal glow behind devices */}
      <div
        className="absolute -inset-6 rounded-full pointer-events-none blur-3xl opacity-55"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(212,175,55,0.22) 0%, rgba(13,148,136,0.18) 45%, transparent 75%)',
        }}
      />

      {/* DESKTOP APP MOCKUP */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-[90%] rounded-xl border border-white/15 bg-[#090d16]/95 shadow-[0_24px_60px_rgba(0,0,0,0.75)] overflow-hidden backdrop-blur-xl"
      >
        {/* Top macOS / Browser Bar */}
        <div className="h-5 px-2.5 bg-slate-900/90 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400/80" />
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
          </div>
          <div className="px-2 py-[1px] rounded bg-white/5 border border-white/10 font-mono text-[6.5px] text-slate-300 tracking-wider">
            palasatlas.com/anatomia-3d
          </div>
          <div className="w-5" />
        </div>

        {/* Desktop App Interior */}
        <div className="p-2.5 grid grid-cols-12 gap-2 h-[142px]">
          {/* Left Landmarks Sidebar */}
          <div className="col-span-3 rounded-lg bg-white/[0.03] border border-white/10 p-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1 pb-1 mb-1 border-b border-white/10">
                <span className="text-[#d4af37]">
                  <PalasOwlIcon className="w-2.5 h-2.5" />
                </span>
                <span className="font-display font-bold text-[6.5px] tracking-[0.16em] text-slate-100">
                  PALAS
                </span>
              </div>
              <div className="space-y-1">
                <div className="px-1 py-0.5 rounded bg-teal-500/20 border border-teal-400/30 text-[5.5px] text-teal-200 font-medium truncate">
                  01 Supraespinal
                </div>
                <div className="px-1 py-0.5 rounded bg-white/[0.03] text-[5.5px] text-slate-400 truncate">
                  02 Infraespinal
                </div>
                <div className="px-1 py-0.5 rounded bg-amber-500/15 border border-amber-400/25 text-[5.5px] text-amber-200 truncate">
                  03 Tríceps (C.L.)
                </div>
                <div className="px-1 py-0.5 rounded bg-white/[0.03] text-[5.5px] text-slate-400 truncate">
                  04 Coracóide
                </div>
              </div>
            </div>
            <span className="font-mono text-[5px] text-slate-500 uppercase tracking-wider">
              Scapula Dextra
            </span>
          </div>

          {/* Center 3D Viewport */}
          <div className="col-span-6 relative rounded-lg bg-gradient-to-b from-[#0b1120] to-[#05070c] border border-white/10 overflow-hidden flex items-center justify-center">
            <div
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 50% 45%, rgba(56,189,248,0.28), transparent 65%)',
              }}
            />
            <svg viewBox="0 0 120 120" className="w-20 h-20 drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
              <defs>
                <linearGradient id="miniBoneDesk" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f5ebd6" />
                  <stop offset="60%" stopColor="#d8c39e" />
                  <stop offset="100%" stopColor="#9c825c" />
                </linearGradient>
              </defs>
              <path
                d="M 30 22 C 46 25, 62 29, 76 32 C 88 35, 92 48, 86 60 C 75 76, 62 96, 52 106 C 46 112, 38 106, 34 94 C 28 74, 24 44, 30 22 Z"
                fill="url(#miniBoneDesk)"
                stroke="#fff7e6"
                strokeOpacity="0.4"
                strokeWidth="0.9"
              />
              <path
                d="M 27 45 C 46 40, 72 32, 96 26 C 102 25, 102 32, 92 36 C 74 42, 48 48, 28 50 Z"
                fill="#f6edd9"
                stroke="#7c6342"
                strokeWidth="0.7"
              />
              <circle cx="84" cy="58" r="3" fill="#d4af37" />
              <circle cx="84" cy="58" r="6" fill="none" stroke="#d4af37" strokeOpacity="0.5" />
              <circle cx="54" cy="30" r="2.5" fill="#38bdf8" />
              <circle cx="52" cy="64" r="2.5" fill="#2dd4bf" />
            </svg>
            <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 border border-white/10 font-mono text-[5px] text-teal-300 tracking-wider">
              3D PBR • 60FPS
            </div>
          </div>

          {/* Right Classic Atlas Sync Column */}
          <div className="col-span-3 rounded-lg bg-[#f5ecd9] border border-amber-700/30 p-1.5 flex flex-col justify-between text-[#3b2816]">
            <div>
              <div className="font-mono text-[5px] font-bold uppercase tracking-wider text-amber-800">
                Netter • Pr. 408
              </div>
              <div className="mt-1 h-14 rounded bg-[#ebd9b8] border border-amber-900/20 flex items-center justify-center">
                <svg viewBox="0 0 60 60" className="w-10 h-10 opacity-85">
                  <path
                    d="M 16 12 C 28 14, 38 17, 44 24 C 46 32, 36 46, 26 52 C 20 50, 14 32, 16 12 Z"
                    fill="#d7ba8c"
                    stroke="#3d2817"
                    strokeWidth="1.2"
                  />
                  <line x1="15" y1="24" x2="46" y2="16" stroke="#3d2817" strokeWidth="1.4" />
                  <circle cx="42" cy="32" r="2.5" fill="#b93829" />
                </svg>
              </div>
            </div>
            <div className="font-mono text-[4.8px] uppercase tracking-wider text-amber-900/80 border-t border-amber-900/20 pt-1">
              Sync Sobotta / Gray&apos;s
            </div>
          </div>
        </div>
      </motion.div>

      {/* FLOATING MOBILE APP MOCKUP (Overlapping Lower Right) */}
      <motion.div
        initial={{ opacity: 0, y: 34, x: 14, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
        transition={{ duration: 0.85, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="relative -mt-14 ml-auto w-[43%] mr-1 rounded-[20px] border-[2.5px] border-slate-300/30 bg-[#060911] shadow-[0_24px_50px_rgba(0,0,0,0.85)] overflow-hidden p-1.5"
      >
        {/* Dynamic Island Notch */}
        <div className="mx-auto w-9 h-2 rounded-full bg-black border border-white/10 mb-1.5" />

        {/* Mobile App Viewport */}
        <div className="rounded-[14px] bg-gradient-to-b from-[#0b1222] to-[#05070c] border border-white/10 p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-[7px] tracking-[0.16em] text-[#d4af37]">
              PALAS ATLAS
            </span>
            <span className="px-1 py-[1px] rounded-full bg-teal-500/20 text-teal-300 font-mono text-[4.8px]">
              MOBILE 3D
            </span>
          </div>

          <div className="relative h-20 rounded-lg bg-black/50 border border-white/10 flex items-center justify-center overflow-hidden">
            <svg viewBox="0 0 100 100" className="w-16 h-16">
              <path
                d="M 26 18 C 40 20, 56 24, 68 28 C 78 32, 78 44, 72 54 C 62 70, 52 86, 44 92 C 38 94, 30 82, 26 64 C 22 44, 22 28, 26 18 Z"
                fill="#e2cfab"
                stroke="#fff8e8"
                strokeOpacity="0.45"
                strokeWidth="0.9"
              />
              <path
                d="M 24 38 C 44 34, 64 26, 84 22 C 88 24, 86 30, 78 32 C 62 36, 42 41, 24 43 Z"
                fill="#f6edd9"
                stroke="#856b47"
                strokeWidth="0.7"
              />
              <circle cx="71" cy="52" r="3.2" fill="#d4af37" />
              <circle cx="71" cy="52" r="6.5" fill="none" stroke="#d4af37" strokeOpacity="0.6" />
            </svg>
            <div className="absolute bottom-1 left-1 right-1 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur border border-[#d4af37]/40 flex items-center justify-between">
              <span className="text-[5px] font-semibold text-amber-200 truncate">
                Cabeça Longa do Tríceps
              </span>
              <span className="text-[4.5px] font-mono text-[#d4af37]">PIN 03</span>
            </div>
          </div>

          {/* Mobile Classic Atlas Strip */}
          <div className="grid grid-cols-4 gap-1">
            {['Netter', 'Sobotta', "Gray's", 'Pernkopf'].map((name) => (
              <div
                key={name}
                className="rounded bg-white/[0.05] border border-white/10 py-0.5 text-center font-mono text-[4.5px] text-slate-300"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

import React from 'react';

export default function Loading() {
  return (
    <div className="fixed inset-0 splash-container flex flex-col items-center justify-center z-[99999] bg-neutral-950 text-slate-200 select-none">
      <div className="flex flex-col items-center text-center">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="font-serif font-bold text-2xl tracking-[0.24em] text-white">PALAS</span>
          <div className="text-[#d4af37]">
            <svg className="w-8 h-8" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2a10 10 0 1 0 10 10A10.011 10.011 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8.009 8.009 0 0 1-8 8z" />
            </svg>
          </div>
          <span className="font-serif font-normal text-2xl tracking-[0.24em] text-[#d4af37]">ATLAS</span>
        </div>
        <p className="text-[11px] text-neutral-400 tracking-[0.25em] font-mono uppercase mt-4">
          Mapeando estruturas morfológicas...
        </p>
      </div>
    </div>
  );
}

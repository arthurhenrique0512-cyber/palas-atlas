'use client';

import React from 'react';

interface BrandLogoProps {
  theme?: 'dark-bg' | 'light-bg';
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  isHome?: boolean;
  compact?: boolean;
}

export function BrandLogo({
  theme = 'dark-bg',
  size = 'md',
  showSubtitle = true,
  isHome = false,
  compact = false
}: BrandLogoProps) {
  const sizeMap = {
    sm: { owl: 'w-6 h-6', text: 'text-lg', track: 'tracking-[0.2em]' },
    md: { owl: 'w-8 h-8', text: 'text-xl sm:text-2xl', track: 'tracking-[0.24em]' },
    lg: { owl: 'w-11 h-11', text: 'text-2xl sm:text-3xl md:text-4xl', track: 'tracking-[0.24em]' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const isDark = theme === 'dark-bg';

  return (
    <div className="flex flex-col items-center select-none text-center">
      <div className="flex items-center gap-2.5 sm:gap-3">
        {/* PALAS */}
        <span
          className={`font-serif font-bold ${currentSize.text} ${currentSize.track} leading-none transition-colors duration-300 ${
            isDark ? 'text-slate-100' : 'text-slate-900'
          }`}
        >
          PALAS
        </span>

        {/* Emblema Coruja / Cérebro */}
        <div
          className={`shrink-0 transition-all duration-300 flex items-center justify-center ${
            compact ? 'max-w-0 opacity-0 overflow-hidden scale-75' : 'max-w-[48px] opacity-100 scale-100'
          } ${isHome ? 'text-[#d4af37]' : isDark ? 'text-[#c8ad5f]' : 'text-slate-700'}`}
        >
          <svg className={currentSize.owl} viewBox="0 0 400 400" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M 164.5 78.0 L 181.0 77.5 L 186.0 79.5 L 192.5 85.0 L 196.5 95.0 L 196.0 120.5 L 194.0 120.5 L 184.5 115.0 L 184.5 98.0 L 183.5 94.0 L 179.0 89.5 L 168.0 89.5 L 161.0 92.5 L 155.5 98.0 L 153.5 103.0 L 154.5 113.0 L 161.5 122.0 L 161.5 127.0 L 159.0 129.5 L 154.0 130.5 L 147.5 125.0 L 142.5 116.0 L 141.5 107.0 L 137.0 106.5 L 128.0 111.5 L 122.5 117.0 L 118.5 125.0 L 119.0 126.5 L 127.0 128.5 L 136.5 134.0 L 138.5 137.0 L 138.5 141.0 L 135.0 144.5 L 132.0 145.5 L 122.0 139.5 L 112.0 139.5 L 107.0 142.5 L 104.0 142.5 L 94.5 138.0 L 99.0 132.5 L 105.5 129.0 L 105.5 125.0 L 110.5 113.0 L 121.0 101.5 L 132.0 95.5 L 139.0 93.5 L 144.0 93.5 L 150.0 85.5 L 157.0 80.5 L 164.0 78.5 Z"
            />
          </svg>
        </div>

        {/* ATLAS */}
        <span
          className={`font-serif font-normal ${currentSize.text} ${currentSize.track} leading-none transition-colors duration-300 ${
            isHome ? 'text-[#d4af37]' : isDark ? 'text-slate-200' : 'text-slate-700'
          }`}
        >
          ATLAS
        </span>
      </div>

      {showSubtitle && !compact && (
        <span className="font-mono text-[8px] sm:text-[9px] tracking-[0.3em] uppercase text-neutral-400 mt-1.5 font-medium">
          Atlas Morfológico Digital
        </span>
      )}
    </div>
  );
}

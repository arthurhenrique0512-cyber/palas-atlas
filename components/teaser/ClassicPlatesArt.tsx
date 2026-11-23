'use client';

import React from 'react';
import { AtlasSourceId, CLASSIC_PLATES } from './types';

interface ClassicPlateArtworkProps {
  atlasId: AtlasSourceId;
  compact?: boolean;
  highlightZone?: 'all' | 'triceps' | 'coracoid' | 'fossae';
  className?: string;
}

/**
 * Museum-grade vector archival plates for the Right Scapula (Scapula dextra)
 * tailored to each classic anatomical atlas aesthetic:
 * Netter, Sobotta, Gray's, and Pernkopf.
 */
export function ClassicPlateArtwork({
  atlasId,
  compact = false,
  highlightZone = 'all',
  className = '',
}: ClassicPlateArtworkProps) {
  const meta = CLASSIC_PLATES.find((p) => p.id === atlasId) || CLASSIC_PLATES[0];

  const palettes: Record<
    AtlasSourceId,
    {
      paper: string;
      paperEdge: string;
      border: string;
      boneBase: string;
      boneShadow: string;
      boneHighlight: string;
      ink: string;
      muscleOrigin: string;
      muscleInsert: string;
      vessel: string;
      callout: string;
    }
  > = {
    netter: {
      paper: '#f7eedb',
      paperEdge: '#e6d5b5',
      border: '#a17c50',
      boneBase: '#edd9b8',
      boneShadow: '#b99365',
      boneHighlight: '#fcf5e6',
      ink: '#3d2817',
      muscleOrigin: '#b93829',
      muscleInsert: '#1e5b88',
      vessel: '#991b1b',
      callout: '#5c3c22',
    },
    sobotta: {
      paper: '#f3f6f0',
      paperEdge: '#dbe2d6',
      border: '#4d6b7a',
      boneBase: '#eae8de',
      boneShadow: '#a6aeb4',
      boneHighlight: '#fbfcf8',
      ink: '#1e293b',
      muscleOrigin: '#0369a1',
      muscleInsert: '#be123c',
      vessel: '#0284c7',
      callout: '#1e3a5f',
    },
    grays: {
      paper: '#ede0c7',
      paperEdge: '#d7c39d',
      border: '#57422a',
      boneBase: '#e4d3b3',
      boneShadow: '#8c7252',
      boneHighlight: '#f7eedc',
      ink: '#291e12',
      muscleOrigin: '#7c2d12',
      muscleInsert: '#3f3f46',
      vessel: '#451a03',
      callout: '#3a2b18',
    },
    pernkopf: {
      paper: '#f5efe4',
      paperEdge: '#dfd2bc',
      border: '#7f1d1d',
      boneBase: '#ebe0cc',
      boneShadow: '#9e8b74',
      boneHighlight: '#fdfaf2',
      ink: '#18181b',
      muscleOrigin: '#be123c',
      muscleInsert: '#1d4ed8',
      vessel: '#dc2626',
      callout: '#3f1d28',
    },
  };

  const pal = palettes[atlasId];

  // Shared anatomical SVG silhouette of the Right Scapula (Posterior / Dorsal view)
  // Centered around (160, 185) inside viewBox 0 0 320 360
  const scapulaSilhouette =
    'M 78 72 C 98 76, 128 84, 154 90 C 168 93, 175 106, 182 104 C 190 101, 198 92, 214 96 C 232 100, 240 112, 238 134 C 237 152, 238 168, 224 184 C 202 214, 174 260, 146 298 C 132 316, 114 316, 102 292 C 88 258, 74 202, 68 144 C 65 112, 68 82, 78 72 Z';

  // Spine & Acromion crest
  const spinePath =
    'M 68 136 C 102 128, 152 114, 206 96 C 228 88, 254 78, 268 84 C 280 90, 278 106, 260 112 C 242 118, 224 114, 208 118 C 166 130, 112 142, 68 146 Z';

  // Coracoid Process projecting supero-laterally/anteriorly
  const coracoidPath =
    'M 192 98 C 196 76, 206 60, 222 58 C 236 56, 246 66, 240 76 C 234 85, 218 82, 210 95 Z';

  // Glenoid Cavity rim (lateral/right angle)
  const glenoidPath =
    'M 232 126 C 245 126, 250 144, 247 162 C 244 176, 234 180, 227 170 C 222 162, 224 132, 232 126 Z';

  return (
    <div
      className={`relative overflow-hidden select-none flex flex-col justify-between ${className}`}
      style={{
        background: `radial-gradient(circle at 48% 42%, ${pal.paper} 45%, ${pal.paperEdge} 100%)`,
        color: pal.ink,
      }}
    >
      {/* Archival double frame border */}
      <div
        className="absolute inset-2 pointer-events-none rounded-[2px]"
        style={{ border: `1px solid ${pal.border}55` }}
      />
      <div
        className="absolute inset-[11px] pointer-events-none rounded-[1px]"
        style={{ border: `0.5px solid ${pal.border}33` }}
      />

      {/* Top Plate Header */}
      <div
        className={`relative z-10 flex items-start justify-between ${
          compact ? 'px-3.5 pt-3 pb-1' : 'px-5 pt-4 pb-2'
        }`}
      >
        <div>
          <div
            className="font-mono uppercase tracking-[0.2em] font-semibold"
            style={{
              fontSize: compact ? '7.5px' : '9px',
              color: meta.accentColor || pal.callout,
            }}
          >
            {meta.author.toUpperCase()} • {meta.plateCode}
          </div>
          <div
            className="font-display font-bold leading-tight mt-0.5"
            style={{
              fontSize: compact ? '12px' : '15px',
              color: pal.ink,
            }}
          >
            Scapula Dextra
          </div>
        </div>
        <span
          className="font-mono uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-sm border"
          style={{
            fontSize: compact ? '6.5px' : '8px',
            borderColor: `${pal.border}66`,
            backgroundColor: `${pal.paper}cc`,
            color: pal.callout,
          }}
        >
          Facies Dorsalis
        </span>
      </div>

      {/* Main Engraving / Plate Illustration */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-2">
        <svg
          viewBox="0 0 320 350"
          className="w-full h-full max-h-[260px]"
          aria-label={`Prancha anatômica ${meta.author} - Escápula Direita`}
        >
          <defs>
            {/* Steel engraving crosshatch for Gray's / classical shading */}
            <pattern
              id={`hatch-${atlasId}`}
              width="4"
              height="4"
              patternTransform="rotate(35 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="4"
                stroke={pal.ink}
                strokeWidth={atlasId === 'grays' ? '0.65' : '0.35'}
                strokeOpacity={atlasId === 'grays' ? '0.34' : '0.18'}
              />
            </pattern>
            <pattern
              id={`crosshatch-${atlasId}`}
              width="5"
              height="5"
              patternTransform="rotate(-40 0 0)"
              patternUnits="userSpaceOnUse"
            >
              <line
                x1="0"
                y1="0"
                x2="0"
                y2="5"
                stroke={pal.ink}
                strokeWidth="0.5"
                strokeOpacity={atlasId === 'grays' ? '0.26' : '0.12'}
              />
            </pattern>

            <linearGradient id={`boneGrad-${atlasId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={pal.boneHighlight} />
              <stop offset="55%" stopColor={pal.boneBase} />
              <stop offset="100%" stopColor={pal.boneShadow} />
            </linearGradient>

            <radialGradient id={`fossaShade-${atlasId}`} cx="45%" cy="55%" r="55%">
              <stop offset="0%" stopColor={pal.boneShadow} stopOpacity="0.45" />
              <stop offset="100%" stopColor={pal.boneBase} stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Subtle cartographic plate registration crosshair */}
          <g stroke={pal.border} strokeOpacity="0.22" strokeWidth="0.6" strokeDasharray="2 3">
            <line x1="160" y1="18" x2="160" y2="332" />
            <line x1="20" y1="170" x2="300" y2="170" />
            <circle cx="160" cy="170" r="118" fill="none" />
          </g>

          {/* Coracoid Process (behind neck in dorsal view) */}
          <path
            d={coracoidPath}
            fill={`url(#boneGrad-${atlasId})`}
            stroke={pal.ink}
            strokeWidth="1.25"
            strokeLinejoin="round"
          />
          <path d={coracoidPath} fill={`url(#hatch-${atlasId})`} opacity="0.6" />

          {/* Main Scapular Blade */}
          <path
            d={scapulaSilhouette}
            fill={`url(#boneGrad-${atlasId})`}
            stroke={pal.ink}
            strokeWidth="1.45"
            strokeLinejoin="round"
          />

          {/* Infraspinous Fossa recessed shading */}
          <path
            d="M 80 152 C 120 144, 178 134, 212 146 C 194 198, 168 250, 140 288 C 122 302, 108 282, 96 238 C 86 202, 80 176, 80 152 Z"
            fill={`url(#fossaShade-${atlasId})`}
          />
          <path
            d="M 80 152 C 120 144, 178 134, 212 146 C 194 198, 168 250, 140 288 C 122 302, 108 282, 96 238 C 86 202, 80 176, 80 152 Z"
            fill={`url(#hatch-${atlasId})`}
          />

          {/* Supraspinous Fossa recessed shading */}
          <path
            d="M 82 82 C 108 86, 144 96, 172 104 C 148 114, 104 126, 74 130 C 72 110, 76 92, 82 82 Z"
            fill={`url(#crosshatch-${atlasId})`}
          />

          {/* Muscular Origin/Insertion Zones (Classic Netter / Sobotta / Pernkopf Color Coding) */}
          <g opacity={highlightZone === 'all' ? 0.72 : 0.45}>
            {/* Supraspinatus Origin */}
            <path
              d="M 84 89 C 110 92, 144 100, 164 106 C 138 115, 102 123, 78 125 C 76 110, 79 96, 84 89 Z"
              fill={pal.muscleOrigin}
              fillOpacity="0.28"
              stroke={pal.muscleOrigin}
              strokeWidth="0.9"
              strokeDasharray="2.5 1.5"
            />
            {/* Infraspinatus Origin */}
            <path
              d="M 84 156 C 118 148, 164 140, 192 152 C 176 196, 152 246, 132 276 C 114 276, 98 228, 84 156 Z"
              fill={pal.muscleOrigin}
              fillOpacity="0.24"
              stroke={pal.muscleOrigin}
              strokeWidth="0.9"
              strokeDasharray="2.5 1.5"
            />
            {/* Long Head of Triceps Origin (Infraglenoid Tubercle) */}
            <ellipse
              cx="224"
              cy="178"
              rx="10"
              ry="7"
              transform="rotate(-24 224 178)"
              fill={pal.muscleOrigin}
              fillOpacity="0.52"
              stroke={pal.muscleOrigin}
              strokeWidth="1.1"
            />
            {/* Coracoid Muscle Attachments */}
            <ellipse
              cx="229"
              cy="68"
              rx="10"
              ry="6"
              transform="rotate(14 229 68)"
              fill={pal.muscleInsert}
              fillOpacity="0.46"
              stroke={pal.muscleInsert}
              strokeWidth="1.1"
            />
          </g>

          {/* Glenoid Cavity */}
          <path
            d={glenoidPath}
            fill={pal.boneShadow}
            fillOpacity="0.42"
            stroke={pal.ink}
            strokeWidth="1.25"
          />
          <path
            d="M 234 132 C 242 133, 245 147, 243 160 C 240 170, 234 172, 230 164 C 227 156, 228 136, 234 132 Z"
            fill={`url(#crosshatch-${atlasId})`}
          />

          {/* Scapular Spine & Acromion in Foreground */}
          <path
            d={spinePath}
            fill={`url(#boneGrad-${atlasId})`}
            stroke={pal.ink}
            strokeWidth="1.55"
            strokeLinejoin="round"
          />
          {/* Spine shadow underside */}
          <path
            d="M 70 144 C 116 138, 170 126, 210 116 C 232 110, 258 112, 266 104 C 254 114, 230 116, 208 120 C 166 132, 112 144, 70 147 Z"
            fill={pal.ink}
            fillOpacity="0.22"
          />

          {/* Pernkopf Topographic Vascular Accent */}
          {atlasId === 'pernkopf' && (
            <g fill="none" strokeLinecap="round">
              <path
                d="M 164 62 C 174 78, 178 96, 184 112 C 194 128, 206 134, 218 142"
                stroke={pal.vessel}
                strokeWidth="1.9"
                strokeOpacity="0.82"
              />
              <path
                d="M 228 194 C 214 202, 198 206, 186 196"
                stroke={pal.vessel}
                strokeWidth="1.6"
                strokeOpacity="0.75"
              />
            </g>
          )}

          {/* Classic Leader Lines & Latin Labels */}
          <g
            fontFamily="Georgia, serif"
            fontStyle="italic"
            fontSize="8.5"
            fill={pal.callout}
            stroke={pal.callout}
            strokeWidth="0.65"
          >
            {/* Spina scapulae */}
            <line x1="158" y1="122" x2="128" y2="54" strokeOpacity="0.7" />
            <circle cx="158" cy="122" r="2" fill={pal.callout} stroke="none" />
            <text x="58" y="48" stroke="none" fontWeight="600">
              Spina scapulae
            </text>

            {/* Processus coracoideus */}
            <line x1="230" y1="67" x2="254" y2="38" strokeOpacity="0.7" />
            <circle cx="230" cy="67" r="2" fill={pal.callout} stroke="none" />
            <text x="206" y="32" stroke="none" fontWeight="600">
              Proc. coracoideus
            </text>

            {/* Acromion */}
            <line x1="266" y1="95" x2="286" y2="95" strokeOpacity="0.7" />
            <circle cx="266" cy="95" r="2" fill={pal.callout} stroke="none" />
            <text x="252" y="128" stroke="none" fontWeight="600">
              Acromion
            </text>

            {/* Tuberculum infraglenoidale / Caput longum tricipitis */}
            <line x1="224" y1="178" x2="258" y2="212" strokeOpacity="0.7" />
            <circle cx="224" cy="178" r="2.2" fill={pal.muscleOrigin} stroke="none" />
            <text x="202" y="224" stroke="none" fontWeight="600">
              Tub. infraglenoidale
            </text>
            <text x="202" y="234" stroke="none" fontSize="7" opacity="0.85">
              (M. triceps, c. longum)
            </text>

            {/* Fossa infraspinata */}
            <line x1="132" y1="210" x2="62" y2="252" strokeOpacity="0.7" />
            <circle cx="132" cy="210" r="2" fill={pal.callout} stroke="none" />
            <text x="20" y="264" stroke="none" fontWeight="600">
              Fossa infraspinata
            </text>
          </g>
        </svg>
      </div>

      {/* Bottom Archival Caption */}
      <div
        className={`relative z-10 border-t flex items-center justify-between ${
          compact ? 'px-3.5 py-2' : 'px-5 py-2.5'
        }`}
        style={{ borderColor: `${pal.border}38` }}
      >
        <span
          className="font-sans font-medium truncate"
          style={{ fontSize: compact ? '8.5px' : '10px', color: pal.ink }}
        >
          {meta.highlightLandmark}
        </span>
        <span
          className="font-mono uppercase tracking-wider shrink-0 ml-2"
          style={{ fontSize: compact ? '7px' : '8px', color: pal.callout }}
        >
          {meta.editionNote.split(' ')[0]}
        </span>
      </div>
    </div>
  );
}

/**
 * Deterministic 60fps Timeline & Cubic-Bezier Curve Engine for Palas Atlas Reels (9:16 • 1080x1920)
 * Calibrated for smooth, unhurried, high-retention editorial pacing (26.0s @ 60fps = 1560 frames).
 */

export const REEL_WIDTH = 1080;
export const REEL_HEIGHT = 1920;
export const REEL_FPS = 60;
export const REEL_DURATION_SEC = 26.0;
export const REEL_TOTAL_FRAMES = REEL_DURATION_SEC * REEL_FPS; // 1560 frames

/**
 * Instagram Reels Safe Zones on a 1080x1920 canvas:
 * Keeps all headlines, pins, telemetry, and CTAs clear of IG header, right action stack, and bottom caption bar.
 */
export const REEL_SAFE_ZONE = {
  top: 150,
  bottom: 310,
  left: 52,
  right: 120,
} as const;

export type ReelActId = 1 | 2 | 3 | 4 | 5;

export interface ReelActMeta {
  id: ReelActId;
  startSec: number;
  endSec: number;
  label: string;
  shortTag: string;
}

export const REEL_ACTS: ReelActMeta[] = [
  { id: 1, startSec: 0.0, endSec: 4.2, label: 'Hook + Dor Real', shortTag: '00s–04s' },
  { id: 2, startSec: 4.2, endSec: 8.2, label: 'Módulos Morfológicos', shortTag: '04s–08s' },
  { id: 3, startSec: 8.2, endSec: 17.2, label: 'Zoom Óptico + Pinos', shortTag: '08s–17s' },
  { id: 4, startSec: 17.2, endSec: 22.4, label: 'Multi-Dispositivo 24/7', shortTag: '17s–22s' },
  { id: 5, startSec: 22.4, endSec: 26.0, label: 'CTA Magnético', shortTag: '22s–26s' },
];

export function getActAtTime(t: number): ReelActId {
  if (t < 4.2) return 1;
  if (t < 8.2) return 2;
  if (t < 17.2) return 3;
  if (t < 22.4) return 4;
  return 5;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function remap(
  value: number,
  inStart: number,
  inEnd: number,
  outStart = 0,
  outEnd = 1,
  easing?: (x: number) => number
): number {
  if (inEnd === inStart) return outEnd;
  const raw = clamp01((value - inStart) / (inEnd - inStart));
  const eased = easing ? easing(raw) : raw;
  return lerp(outStart, outEnd, eased);
}

/**
 * Exact mathematical CSS cubic-bezier(x1, y1, x2, y2) solver
 * so deterministic Playwright frame stepping matches CSS cubic-bezier curves identically.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;

  const sampleCurveX = (u: number) => ((ax * u + bx) * u + cx) * u;
  const sampleCurveY = (u: number) => ((ay * u + by) * u + cy) * u;
  const sampleDerivativeX = (u: number) => (3 * ax * u + 2 * bx) * u + cx;

  return (tInput: number) => {
    const x = clamp01(tInput);
    if (x === 0 || x === 1) return x;

    let u = x;
    for (let i = 0; i < 8; i++) {
      const dx = sampleCurveX(u) - x;
      if (Math.abs(dx) < 1e-6) return sampleCurveY(u);
      const d = sampleDerivativeX(u);
      if (Math.abs(d) < 1e-6) break;
      u -= dx / d;
    }

    let lo = 0;
    let hi = 1;
    u = x;
    for (let i = 0; i < 16; i++) {
      const val = sampleCurveX(u);
      if (Math.abs(val - x) < 1e-6) break;
      if (x > val) lo = u;
      else hi = u;
      u = 0.5 * (lo + hi);
    }
    return sampleCurveY(u);
  };
}

/** Smooth, unhurried motion curves */
export const EASE_OUT_EXPO = cubicBezier(0.22, 1, 0.36, 1);
export const EASE_CINEMATIC = cubicBezier(0.33, 0, 0.2, 1);
export const EASE_SMOOTH = cubicBezier(0.42, 0, 0.58, 1);
export const EASE_OVERSHOOT = cubicBezier(0.28, 1.18, 0.54, 1);
export const EASE_SHARP_IN_OUT = cubicBezier(0.65, 0, 0.35, 1);

/** Smooth fade-in + hold + fade-out envelope for kinetic captions */
export function envelope(
  t: number,
  start: number,
  end: number,
  fadeIn = 0.55,
  fadeOut = 0.45
): number {
  if (t < start || t > end) return 0;
  const inP = fadeIn > 0 ? remap(t, start, start + fadeIn, 0, 1, EASE_OUT_EXPO) : 1;
  const outP = fadeOut > 0 ? remap(t, end - fadeOut, end, 1, 0, EASE_SMOOTH) : 1;
  return Math.min(inP, outP);
}

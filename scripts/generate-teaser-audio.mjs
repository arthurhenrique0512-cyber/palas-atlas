#!/usr/bin/env node
/**
 * Palas Atlas — Procedural 48kHz Stereo Soundtrack & Frame-Accurate SFX Generator (26.0s Edition)
 * Generates a 26.00s unhurried minimal electronic synth soundtrack (96 BPM) + optical/UI sound design
 * synchronized to the 5 acts of the Palas Atlas Reels teaser.
 *
 * Output:
 *   public/teaser-assets/palas-reels-soundtrack.wav
 *   public/teaser-assets/palas-reels-soundtrack.mp3
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const SAMPLE_RATE = 48000;
const DURATION_SEC = 26.0;
const TOTAL_SAMPLES = Math.floor(SAMPLE_RATE * DURATION_SEC);

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function softClip(x) {
  return Math.tanh(x * 1.15);
}

function adsr(t, dur, a = 0.02, d = 0.12, s = 0.6, r = 0.2) {
  if (t < 0 || t > dur) return 0;
  if (t < a) return t / Math.max(1e-5, a);
  if (t < a + d) return 1 - ((1 - s) * (t - a)) / Math.max(1e-5, d);
  if (t < dur - r) return s;
  return s * (1 - (t - (dur - r)) / Math.max(1e-5, r));
}

function generateSoundtrack() {
  const left = new Float32Array(TOTAL_SAMPLES);
  const right = new Float32Array(TOTAL_SAMPLES);

  let seed = 133742;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return (seed / 0xffffffff) * 2 - 1;
  };

  const addTone = ({
    start,
    dur,
    freq,
    freqEnd = freq,
    amp = 0.1,
    pan = 0,
    wave = 'sine',
    attack = 0.02,
    decay = 0.1,
    sustain = 0.55,
    release = 0.18,
  }) => {
    const i0 = Math.max(0, Math.floor(start * SAMPLE_RATE));
    const i1 = Math.min(TOTAL_SAMPLES, Math.floor((start + dur) * SAMPLE_RATE));
    let phase = 0;
    const panL = Math.cos(((pan + 1) * Math.PI) / 4);
    const panR = Math.sin(((pan + 1) * Math.PI) / 4);

    for (let i = i0; i < i1; i++) {
      const localT = (i - i0) / SAMPLE_RATE;
      const p = localT / Math.max(1e-5, dur);
      const f = freq + (freqEnd - freq) * p;
      phase += (2 * Math.PI * f) / SAMPLE_RATE;

      let sig = 0;
      if (wave === 'sine') {
        sig = Math.sin(phase);
      } else if (wave === 'triangle') {
        sig = (2 / Math.PI) * Math.asin(Math.sin(phase));
      } else if (wave === 'warmpad') {
        sig =
          0.58 * Math.sin(phase) +
          0.26 * Math.sin(phase * 2 + 0.3) +
          0.11 * Math.sin(phase * 3 + 0.7) +
          0.05 * Math.sin(phase * 0.5);
      } else if (wave === 'pluck') {
        const harmDecay = Math.exp(-localT * 10);
        sig =
          Math.sin(phase) +
          0.4 * harmDecay * Math.sin(phase * 2) +
          0.18 * harmDecay * Math.sin(phase * 3);
      } else if (wave === 'bell') {
        sig =
          0.68 * Math.sin(phase) +
          0.22 * Math.sin(phase * 2.0) * Math.exp(-localT * 5) +
          0.1 * Math.sin(phase * 3.01) * Math.exp(-localT * 8);
      }

      const env = adsr(localT, dur, attack, decay, sustain, release);
      const sample = sig * env * amp;
      left[i] += sample * panL;
      right[i] += sample * panR;
    }
  };

  const addKick = (start, amp = 0.34) => {
    const dur = 0.32;
    const i0 = Math.max(0, Math.floor(start * SAMPLE_RATE));
    const i1 = Math.min(TOTAL_SAMPLES, Math.floor((start + dur) * SAMPLE_RATE));
    let phase = 0;
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SAMPLE_RATE;
      const f = 43 + 105 * Math.exp(-t * 32);
      phase += (2 * Math.PI * f) / SAMPLE_RATE;
      const env = Math.exp(-t * 10.5);
      const click = Math.exp(-t * 140) * 0.18;
      const s = (Math.sin(phase) * env + click) * amp;
      left[i] += s;
      right[i] += s;
    }
  };

  const addHiHat = (start, dur = 0.055, amp = 0.04, pan = 0.15) => {
    const i0 = Math.max(0, Math.floor(start * SAMPLE_RATE));
    const i1 = Math.min(TOTAL_SAMPLES, Math.floor((start + dur) * SAMPLE_RATE));
    const panL = Math.cos(((pan + 1) * Math.PI) / 4);
    const panR = Math.sin(((pan + 1) * Math.PI) / 4);
    let prev = 0;
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SAMPLE_RATE;
      const n = rand();
      const hp = n - prev * 0.88;
      prev = n;
      const env = Math.exp(-t * 55);
      const s = hp * env * amp;
      left[i] += s * panL;
      right[i] += s * panR;
    }
  };

  const addWhoosh = (start, dur, amp = 0.075, panStart = -0.35, panEnd = 0.35) => {
    const i0 = Math.max(0, Math.floor(start * SAMPLE_RATE));
    const i1 = Math.min(TOTAL_SAMPLES, Math.floor((start + dur) * SAMPLE_RATE));
    let lp1 = 0;
    let lp2 = 0;
    for (let i = i0; i < i1; i++) {
      const t = (i - i0) / SAMPLE_RATE;
      const p = t / dur;
      const env = Math.sin(p * Math.PI);
      const cutoff = 0.018 + 0.13 * env;
      const n = rand();
      lp1 += cutoff * (n - lp1);
      lp2 += cutoff * (lp1 - lp2);
      const band = lp1 - lp2;
      const pan = panStart + (panEnd - panStart) * p;
      const panL = Math.cos(((pan + 1) * Math.PI) / 4);
      const panR = Math.sin(((pan + 1) * Math.PI) / 4);
      const s = band * env * amp * 4.0;
      left[i] += s * panL;
      right[i] += s * panR;
    }
  };

  const addUiClick = (start, pitch = 1350, amp = 0.08, pan = 0) => {
    addTone({
      start,
      dur: 0.032,
      freq: pitch,
      freqEnd: pitch * 0.55,
      amp,
      pan,
      wave: 'triangle',
      attack: 0.002,
      decay: 0.018,
      sustain: 0.1,
      release: 0.012,
    });
  };

  const addPinChime = (start, rootMidi = 74, amp = 0.08) => {
    const notes = [rootMidi, rootMidi + 7, rootMidi + 12];
    notes.forEach((m, idx) => {
      addTone({
        start: start + idx * 0.045,
        dur: 0.85,
        freq: midiToFreq(m),
        amp: amp * (1 - idx * 0.18),
        pan: (idx - 1) * 0.25,
        wave: 'bell',
        attack: 0.006,
        decay: 0.22,
        sustain: 0.25,
        release: 0.45,
      });
    });
  };

  // =========================================================================
  // 1. ACT 1 (0.00s - 2.55s): TENSE HOOK + PAIN ALERTS + IRIS REVEAL
  // =========================================================================
  addTone({
    start: 0.0,
    dur: 2.55,
    freq: midiToFreq(38),
    freqEnd: midiToFreq(37),
    amp: 0.2,
    wave: 'warmpad',
    attack: 0.15,
    decay: 0.5,
    sustain: 0.72,
    release: 0.25,
  });

  [0.12, 0.92, 1.72].forEach((tBeat) => {
    addKick(tBeat, 0.24);
  });

  // Pain toast blips (0.40s & 1.00s)
  addTone({
    start: 0.4,
    dur: 0.16,
    freq: 510,
    freqEnd: 450,
    amp: 0.075,
    pan: -0.28,
    wave: 'triangle',
  });
  addTone({
    start: 1.0,
    dur: 0.16,
    freq: 470,
    freqEnd: 405,
    amp: 0.075,
    pan: 0.28,
    wave: 'triangle',
  });

  // Smooth optical iris reveal (2.45s - 3.35s)
  addWhoosh(2.05, 1.05, 0.09, -0.45, 0.45);
  addUiClick(2.5, 1950, 0.11, 0);
  addKick(2.52, 0.36);

  // Luminous Palas Atlas chord bloom (2.52s - 4.25s)
  [50, 57, 60, 64, 69].forEach((m, idx) => {
    addTone({
      start: 2.52,
      dur: 1.85,
      freq: midiToFreq(m),
      amp: 0.06,
      pan: (idx - 2) * 0.2,
      wave: 'warmpad',
      attack: 0.15,
      decay: 0.4,
      sustain: 0.72,
      release: 0.45,
    });
  });
  addPinChime(2.65, 74, 0.07);

  // =========================================================================
  // 2. ACTS 2, 3, 4 (4.20s - 22.40s): CALM 96 BPM ELECTRONIC FLOW
  //    At 96 BPM, 1 beat = 0.625s, 1 bar (4 beats) = 2.50s
  // =========================================================================
  const chordBars = [
    { start: 4.2, dur: 2.6, bass: 38, notes: [50, 53, 57, 60, 64], arp: [62, 64, 65, 69, 72, 69, 65, 64] },
    { start: 6.8, dur: 2.6, bass: 34, notes: [46, 53, 57, 58, 62], arp: [62, 65, 69, 70, 74, 70, 69, 65] },
    { start: 9.4, dur: 2.6, bass: 41, notes: [48, 53, 57, 60, 64], arp: [60, 64, 65, 69, 72, 69, 65, 64] },
    { start: 12.0, dur: 2.6, bass: 36, notes: [48, 52, 55, 57, 62], arp: [60, 62, 64, 67, 72, 67, 64, 62] },
    { start: 14.6, dur: 2.6, bass: 38, notes: [50, 53, 57, 60, 64], arp: [62, 65, 69, 72, 76, 72, 69, 65] },
    { start: 17.2, dur: 2.6, bass: 34, notes: [46, 53, 57, 60, 65], arp: [62, 65, 69, 74, 77, 74, 69, 65] },
    { start: 19.8, dur: 2.6, bass: 41, notes: [48, 53, 57, 60, 67], arp: [64, 67, 69, 72, 76, 79, 76, 72] },
  ];

  for (const bar of chordBars) {
    const beatDur = bar.dur / 4; // 0.65s per beat (~92.3 BPM)
    const eighthDur = beatDur / 2;
    const sixteenthDur = beatDur / 4;

    bar.notes.forEach((m, idx) => {
      addTone({
        start: bar.start,
        dur: bar.dur + 0.35,
        freq: midiToFreq(m),
        amp: 0.048,
        pan: (idx - 2) * 0.22,
        wave: 'warmpad',
        attack: 0.25,
        decay: 0.4,
        sustain: 0.8,
        release: 0.4,
      });
    });

    for (let step = 0; step < 8; step++) {
      const st = bar.start + step * eighthDur;
      const isDownbeat = step % 2 === 0;
      addTone({
        start: st,
        dur: eighthDur * 0.9,
        freq: midiToFreq(bar.bass),
        amp: isDownbeat ? 0.16 : 0.11,
        wave: 'triangle',
        attack: 0.012,
        decay: 0.1,
        sustain: 0.45,
        release: 0.08,
      });
    }

    for (let step = 0; step < 16; step++) {
      const noteMidi = bar.arp[step % bar.arp.length];
      const st = bar.start + step * sixteenthDur;
      addTone({
        start: st,
        dur: sixteenthDur * 1.6,
        freq: midiToFreq(noteMidi),
        amp: step % 4 === 0 ? 0.06 : 0.038,
        pan: ((step % 4) - 1.5) * 0.24,
        wave: 'pluck',
        attack: 0.005,
        decay: 0.09,
        sustain: 0.22,
        release: 0.12,
      });
    }

    for (let beat = 0; beat < 4; beat++) {
      const bt = bar.start + beat * beatDur;
      addKick(bt, 0.32);
      addHiHat(bt + eighthDur, 0.06, 0.042, 0.16);
      addHiHat(bt + eighthDur + sixteenthDur, 0.04, 0.024, -0.16);
    }
  }

  // =========================================================================
  // 3. CHOREOGRAPHED SFX FOR ACTS 2, 3, 4 (26.0s TIMELINE)
  // =========================================================================
  // Act 2: 3 unhurried discipline transitions (4.25s, 5.55s, 6.90s)
  [4.25, 5.55, 6.9].forEach((tSwitch, idx) => {
    addUiClick(tSwitch, 1250 + idx * 160, 0.08, (idx - 1) * 0.22);
  });

  // Act 3A: Pele Espessa 10x (9.20s) & 40x (11.00s) + Pin Lock Chimes
  addUiClick(9.2, 1600, 0.095, -0.2);
  addWhoosh(9.3, 1.35, 0.07, -0.3, 0.2);
  addPinChime(10.2, 74, 0.075);

  addUiClick(11.0, 1800, 0.1, -0.15);
  addWhoosh(11.1, 1.5, 0.08, -0.2, 0.35);
  addPinChime(12.15, 77, 0.085);

  // Act 3B: Osso Maduro 40x switch (13.40s) + Questões card (14.65s)
  addWhoosh(13.15, 0.75, 0.075, 0.3, -0.3);
  addUiClick(13.4, 1500, 0.085, 0);
  addPinChime(14.7, 76, 0.08);

  // Act 4: Multi-Device showcase entrance & 3 feature pills (17.9s, 18.6s, 19.3s)
  addWhoosh(17.05, 0.85, 0.08, -0.35, 0.35);
  addPinChime(17.95, 74, 0.06);
  addPinChime(18.65, 76, 0.06);
  addPinChime(19.35, 79, 0.065);

  // =========================================================================
  // 4. ACT 5 (22.40s - 26.00s): PRESTIGIOUS FINALE + CTA SHIMMER
  // =========================================================================
  addKick(22.4, 0.36);
  addWhoosh(22.15, 0.7, 0.07, -0.3, 0.3);

  [38, 50, 57, 60, 64, 69, 74].forEach((m, idx) => {
    addTone({
      start: 22.4,
      dur: 3.55,
      freq: midiToFreq(m),
      amp: idx === 0 ? 0.15 : 0.05,
      pan: idx === 0 ? 0 : (idx - 3.5) * 0.18,
      wave: 'warmpad',
      attack: 0.12,
      decay: 0.6,
      sustain: 0.72,
      release: 1.2,
    });
  });

  // Shimmer arpeggio on CTA button & URL (23.30s)
  [74, 77, 81, 86].forEach((m, idx) => {
    addTone({
      start: 23.3 + idx * 0.08,
      dur: 2.1,
      freq: midiToFreq(m),
      amp: 0.058,
      pan: (idx - 1.5) * 0.25,
      wave: 'bell',
      attack: 0.008,
      decay: 0.35,
      sustain: 0.25,
      release: 1.1,
    });
  });

  // =========================================================================
  // 5. STEREO PING-PONG DELAY + MASTER LIMITER + SMOOTH FADE-OUT
  // =========================================================================
  const delaySamples = Math.floor(0.48 * SAMPLE_RATE);
  const delayL = new Float32Array(TOTAL_SAMPLES);
  const delayR = new Float32Array(TOTAL_SAMPLES);

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const dl = i >= delaySamples ? delayR[i - delaySamples] * 0.26 : 0;
    const dr = i >= delaySamples ? delayL[i - delaySamples] * 0.26 : 0;
    delayL[i] = left[i] + dl;
    delayR[i] = right[i] + dr;
  }

  for (let i = 0; i < TOTAL_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const fadeOut = t > 24.8 ? clamp((26.0 - t) / 1.2, 0, 1) : 1.0;
    const fadeIn = t < 0.08 ? t / 0.08 : 1.0;
    const gain = 0.85 * fadeIn * fadeOut;

    left[i] = softClip((left[i] * 0.82 + delayL[i] * 0.24) * gain);
    right[i] = softClip((right[i] * 0.82 + delayR[i] * 0.24) * gain);
  }

  return { left, right };
}

function writeWavFile(filePath, left, right) {
  const numChannels = 2;
  const bytesPerSample = 2;
  const dataSize = left.length * numChannels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < left.length; i++) {
    const sL = Math.max(-1, Math.min(1, left[i]));
    const sR = Math.max(-1, Math.min(1, right[i]));
    buffer.writeInt16LE(Math.round(sL * 32767), offset);
    buffer.writeInt16LE(Math.round(sR * 32767), offset + 2);
    offset += 4;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

const outDir = path.resolve(process.cwd(), 'public', 'teaser-assets');
const wavPath = path.join(outDir, 'palas-reels-soundtrack.wav');
const mp3Path = path.join(outDir, 'palas-reels-soundtrack.mp3');

console.log('[Palas Audio] Synthesizing 26.0s 48kHz stereo soundtrack + SFX...');
const { left, right } = generateSoundtrack();
writeWavFile(wavPath, left, right);
console.log(`[Palas Audio] WAV saved -> ${wavPath}`);

const ff = spawnSync(
  'ffmpeg',
  [
    '-y',
    '-i',
    wavPath,
    '-af',
    'acompressor=threshold=-16dB:ratio=2.5:attack=10:release=120,alimiter=limit=0.95',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '192k',
    mp3Path,
  ],
  { stdio: 'inherit' }
);

if (ff.status === 0) {
  console.log(`[Palas Audio] MP3 saved -> ${mp3Path}`);
}

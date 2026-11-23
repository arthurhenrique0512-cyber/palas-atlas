#!/usr/bin/env node
/**
 * Palas Atlas — Deterministic 1080x1920 @ 60fps Reels Video Renderer
 * Uses parallel Playwright worker pages + FFmpeg for fast, frame-accurate 60fps H.264 output.
 *
 * Usage:
 *   node scripts/render-teaser-reels.mjs
 *   node scripts/render-teaser-reels.mjs --workers 4 --out out/palas-reels.mp4
 *   node scripts/render-teaser-reels.mjs --keyframes-dir out/keyframes
 */

import { chromium } from 'playwright';
import { spawn } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';

const ROOT_DIR = path.resolve(process.cwd());

function parseArgs(argv) {
  const args = {
    url: '',
    out: '',
    keyframesDir: '',
    fps: 60,
    durationSec: 26,
    workers: 6,
    dev: false,
    horizontal: false,
    width: 1080,
    height: 1920,
    routePath: '/teaser-reels?record=1&deterministic=1',
  };

  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--url' && argv[i + 1]) args.url = argv[++i];
    else if (k === '--out' && argv[i + 1]) args.out = path.resolve(argv[++i]);
    else if (k === '--keyframes-dir' && argv[i + 1])
      args.keyframesDir = path.resolve(argv[++i]);
    else if (k === '--fps' && argv[i + 1]) args.fps = Number(argv[++i]) || 60;
    else if (k === '--workers' && argv[i + 1])
      args.workers = Math.max(1, Math.min(8, Number(argv[++i]) || 4));
    else if (k === '--dev') args.dev = true;
    else if (k === '--horizontal') args.horizontal = true;
  }

  if (args.horizontal) {
    args.width = 1920;
    args.height = 1080;
    args.routePath = '/teaser-horizontal?record=1&deterministic=1';
    if (!args.out) {
      args.out = path.join(
        ROOT_DIR,
        'out',
        'palas-atlas-horizontal-1920x1080-60fps.mp4'
      );
    }
  } else if (!args.out) {
    args.out = path.join(ROOT_DIR, 'out', 'palas-atlas-reels-1080x1920-60fps.mp4');
  }

  return args;
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHttpReady(targetUrl, timeoutMs = 45000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(targetUrl);
      if (res.ok) return;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timeout waiting for server at ${targetUrl}`);
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let errLog = '';
    proc.stderr.on('data', (c) => {
      errLog += c.toString();
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited ${code}:\n${errLog.slice(-1500)}`));
    });
  });
}

async function prepareWorkerPage(browser, targetPage, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(targetPage, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__PALAS_REEL__), {
    timeout: 30000,
  });

  await page.evaluate(async () => {
    await document.fonts.ready;
    const assetUrls = [
      '/teaser-assets/pele-espessa-hd.jpg',
      '/teaser-assets/osso-maduro-40x-hd.jpg',
      '/teaser-assets/medula-espinal-clean.jpg',
      '/teaser-assets/muscular-esqueletico-clean.jpg',
    ];
    await Promise.all(
      assetUrls.map(
        (src) =>
          new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
              if (typeof img.decode === 'function') {
                img.decode().catch(() => {}).finally(resolve);
              } else {
                resolve();
              }
            };
            img.onerror = resolve;
            img.src = src;
          })
      )
    );
  });

  return { context, page };
}

async function main() {
  const opts = parseArgs(process.argv);
  fs.mkdirSync(path.dirname(opts.out), { recursive: true });
  if (opts.keyframesDir) {
    fs.mkdirSync(opts.keyframesDir, { recursive: true });
  }

  const tmpFramesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'palas-reel-frames-'));
  let serverProc = null;
  let browser = null;

  try {
    let baseUrl = opts.url;
    if (!baseUrl) {
      const port = await getFreePort();
      const hasProdBuild = fs.existsSync(path.join(ROOT_DIR, '.next', 'BUILD_ID'));
      const mode = opts.dev || !hasProdBuild ? 'dev' : 'start';
      console.log(
        `[Palas Render] Starting Next.js (${mode}) on http://127.0.0.1:${port}...`
      );
      const nextBin = path.join(ROOT_DIR, 'node_modules', '.bin', 'next');
      serverProc = spawn(nextBin, [mode, '-p', String(port), '-H', '127.0.0.1'], {
        cwd: ROOT_DIR,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      serverProc.stderr.on('data', (d) => {
        const msg = d.toString().trim();
        if (msg && !msg.includes('ExperimentalWarning')) {
          console.error(`[next] ${msg}`);
        }
      });
      baseUrl = `http://127.0.0.1:${port}`;
      await waitForHttpReady(`${baseUrl}${opts.routePath}`);
    }

    const totalFrames = Math.round(opts.durationSec * opts.fps);
    const targetPage = `${baseUrl.replace(/\/$/, '')}${opts.routePath}`;
    console.log(
      `[Palas Render] Launching Chromium (${opts.workers} workers, ${opts.width}x${opts.height} @ ${opts.fps}fps, ${totalFrames} frames)...`
    );

    browser = await chromium.launch({ headless: true });

    const keyframeSamples = new Set([
      Math.round(1.0 * opts.fps),
      Math.round(3.2 * opts.fps),
      Math.round(5.2 * opts.fps),
      Math.round(7.6 * opts.fps),
      Math.round(10.5 * opts.fps),
      Math.round(13.8 * opts.fps),
      Math.round(16.2 * opts.fps),
      Math.round(19.8 * opts.fps),
      Math.round(24.2 * opts.fps),
    ]);

    const tStart = Date.now();
    let completedFrames = 0;

    // Interleaved frame assignment balances heavy & light scenes evenly across workers
    const workerPromises = Array.from({ length: opts.workers }, async (_, wIdx) => {
      const { context, page } = await prepareWorkerPage(
        browser,
        targetPage,
        opts.width,
        opts.height
      );
      try {
        for (let frame = wIdx; frame < totalFrames; frame += opts.workers) {
          const tSec = frame / opts.fps;
          await page.evaluate(
            (sec) =>
              new Promise((resolve) => {
                window.__PALAS_REEL__.setTime(sec);
                requestAnimationFrame(() => requestAnimationFrame(resolve));
              }),
            tSec
          );

          // Ensure newly mounted <img> tags finish decoding before capture
          await page.evaluate(async () => {
            const imgs = Array.from(document.querySelectorAll('img'));
            await Promise.all(
              imgs.map((img) =>
                img.complete
                  ? Promise.resolve()
                  : new Promise((res) => {
                      img.addEventListener('load', res, { once: true });
                      img.addEventListener('error', res, { once: true });
                    })
              )
            );
          });

          const framePath = path.join(
            tmpFramesDir,
            `frame_${String(frame).padStart(5, '0')}.jpg`
          );
          const jpgBuf = await page.screenshot({
            path: framePath,
            type: 'jpeg',
            quality: 96,
            animations: 'disabled',
          });

          if (opts.keyframesDir && keyframeSamples.has(frame)) {
            const secLabel = tSec.toFixed(2).replace('.', '_');
            fs.writeFileSync(
              path.join(
                opts.keyframesDir,
                `frame_${String(frame).padStart(4, '0')}_${secLabel}s.jpg`
              ),
              jpgBuf
            );
          }

          completedFrames++;
          if (completedFrames % 120 === 0 || completedFrames === totalFrames) {
            const pct = ((completedFrames / totalFrames) * 100).toFixed(0);
            const elapsed = ((Date.now() - tStart) / 1000).toFixed(1);
            console.log(
              `[Palas Render] Frames ${completedFrames}/${totalFrames} (${pct}%) • ${elapsed}s`
            );
          }
        }
      } finally {
        await context.close();
      }
    });

    await Promise.all(workerPromises);
    await browser.close();
    browser = null;

    console.log(`[Palas Render] Encoding H.264 60fps MP4 via FFmpeg -> ${opts.out}`);
    const audioWavPath = path.join(
      ROOT_DIR,
      'public',
      'teaser-assets',
      'palas-reels-soundtrack.wav'
    );
    const hasAudio = fs.existsSync(audioWavPath);
    const ffmpegArgs = [
      '-y',
      '-framerate',
      String(opts.fps),
      '-i',
      path.join(tmpFramesDir, 'frame_%05d.jpg'),
      ...(hasAudio ? ['-i', audioWavPath] : []),
      '-c:v',
      'libx264',
      '-preset',
      'medium',
      '-crf',
      '15',
      '-pix_fmt',
      'yuv420p',
      ...(hasAudio
        ? [
            '-af',
            'acompressor=threshold=-16dB:ratio=2.5:attack=10:release=120,alimiter=limit=0.95',
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-ar',
            '48000',
            '-shortest',
          ]
        : []),
      '-movflags',
      '+faststart',
      opts.out,
    ];
    await runFfmpeg(ffmpegArgs);

    const stats = fs.statSync(opts.out);
    const totalSec = ((Date.now() - tStart) / 1000).toFixed(1);
    console.log(
      `[Palas Render] DONE in ${totalSec}s! Video saved to ${opts.out} (${(
        stats.size /
        (1024 * 1024)
      ).toFixed(2)} MB)`
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (serverProc) {
      serverProc.kill('SIGTERM');
    }
    fs.rmSync(tmpFramesDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('[Palas Render] ERROR:', err);
  process.exit(1);
});

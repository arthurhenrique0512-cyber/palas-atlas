import * as THREE from 'three';

/**
 * Procedural Right Scapula (Scapula dextra) 3D SDF + Marching Cubes Geometry
 * + Triplanar Dry-Bone PBR Material Generator
 *
 * Local Anatomical Axes (Right Scapula):
 *   +X : Lateral (Glenoid / Acromion)     |  -X : Medial (Vertebral Border)
 *   +Y : Superior (Superior Angle)        |  -Y : Inferior (Inferior Angle)
 *   +Z : Posterior / Dorsal (Spine)       |  -Z : Anterior / Costal (Subscapular)
 */

// ---------------------------------------------------------------------------
// 1. Fast Math & SDF Primitives
// ---------------------------------------------------------------------------

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Polynomial smooth minimum (organic bone union) */
function smin(a: number, b: number, k: number): number {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Polynomial smooth subtraction (a minus b) */
function smaxSub(d1: number, d2: number, k: number): number {
  const h = Math.max(k - Math.abs(-d2 - d1), 0) / k;
  return Math.max(d1, -d2) + h * h * k * 0.25;
}

function sdCapsule(
  px: number,
  py: number,
  pz: number,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  ra: number,
  rb: number
): number {
  const pax = px - ax;
  const pay = py - ay;
  const paz = pz - az;
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const baba = bax * bax + bay * bay + baz * baz;
  const h = baba > 1e-8 ? clamp((pax * bax + pay * bay + paz * baz) / baba, 0, 1) : 0;
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  const dz = paz - baz * h;
  const r = mix(ra, rb, h);
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

function sdEllipsoid(
  px: number,
  py: number,
  pz: number,
  rx: number,
  ry: number,
  rz: number
): number {
  const k0 = Math.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
  const k1 = Math.sqrt((px / (rx * rx)) ** 2 + (py / (ry * ry)) ** 2 + (pz / (rz * rz)) ** 2);
  if (k1 < 1e-7) return -Math.min(rx, Math.min(ry, rz));
  return (k0 * (k0 - 1.0)) / k1;
}

// ---------------------------------------------------------------------------
// 2. 2D Anatomical Scapular Blade Contour LUT (O(1) per 3D sample)
// ---------------------------------------------------------------------------

const BLADE_CONTROL_POINTS: Array<[number, number]> = [
  [-0.59, 0.87], // Superior angle
  [-0.34, 0.84], // Superior border medial
  [-0.06, 0.77], // Superior border mid
  [0.12, 0.72],  // Medial rim of suprascapular notch
  [0.18, 0.61],  // Deep suprascapular notch
  [0.25, 0.69],  // Lateral rim of notch
  [0.42, 0.64],  // Upper neck
  [0.57, 0.54],  // Glenoid upper neck
  [0.59, 0.28],  // Glenoid lower neck / infraglenoid region
  [0.47, 0.06],  // Upper axillary border
  [0.28, -0.26], // Mid axillary border
  [0.06, -0.64], // Lower axillary border
  [-0.17, -0.94],// Approach to inferior angle
  [-0.33, -1.04],// Inferior angle apex
  [-0.45, -0.91],// Medial inferior sweep
  [-0.54, -0.52],// Lower vertebral border
  [-0.62, -0.05],// Mid vertebral border
  [-0.67, 0.42], // Root of spine (trigonum spinae)
  [-0.66, 0.68], // Upper vertebral border
  [-0.63, 0.82], // Approach to superior angle
];

function sampleClosedCatmullRom(
  pts: Array<[number, number]>,
  samplesPerSegment: number
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const x =
        0.5 *
        (2 * p1[0] +
          (-p0[0] + p2[0]) * t +
          (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
          (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
      const y =
        0.5 *
        (2 * p1[1] +
          (-p0[1] + p2[1]) * t +
          (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
          (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
      out.push([x, y]);
    }
  }
  return out;
}

const LUT_W = 96;
const LUT_H = 96;
const LUT_MIN_X = -0.82;
const LUT_MAX_X = 0.78;
const LUT_MIN_Y = -1.16;
const LUT_MAX_Y = 1.02;

let cachedBladeLut: Float32Array | null = null;

function getBlade2DLut(): Float32Array {
  if (cachedBladeLut) return cachedBladeLut;
  const poly = sampleClosedCatmullRom(BLADE_CONTROL_POINTS, 3);
  const m = poly.length;
  const lut = new Float32Array(LUT_W * LUT_H);

  for (let iy = 0; iy < LUT_H; iy++) {
    const y = mix(LUT_MIN_Y, LUT_MAX_Y, iy / (LUT_H - 1));
    for (let ix = 0; ix < LUT_W; ix++) {
      const x = mix(LUT_MIN_X, LUT_MAX_X, ix / (LUT_W - 1));
      let minDistSq = Infinity;
      let inside = false;

      for (let i = 0, j = m - 1; i < m; j = i++) {
        const ax = poly[j][0];
        const ay = poly[j][1];
        const bx = poly[i][0];
        const by = poly[i][1];

        const ex = bx - ax;
        const ey = by - ay;
        const wx = x - ax;
        const wy = y - ay;
        const ee = ex * ex + ey * ey;
        const proj = ee > 1e-10 ? clamp((wx * ex + wy * ey) / ee, 0, 1) : 0;
        const dx = wx - ex * proj;
        const dy = wy - ey * proj;
        const dSq = dx * dx + dy * dy;
        if (dSq < minDistSq) minDistSq = dSq;

        if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay + 1e-12) + ax) {
          inside = !inside;
        }
      }

      const d = Math.sqrt(minDistSq);
      lut[iy * LUT_W + ix] = inside ? -d : d;
    }
  }

  cachedBladeLut = lut;
  return lut;
}

function sampleBlade2D(x: number, y: number): number {
  const lut = getBlade2DLut();
  const u = ((x - LUT_MIN_X) / (LUT_MAX_X - LUT_MIN_X)) * (LUT_W - 1);
  const v = ((y - LUT_MIN_Y) / (LUT_MAX_Y - LUT_MIN_Y)) * (LUT_H - 1);

  if (u <= 0 || u >= LUT_W - 1 || v <= 0 || v >= LUT_H - 1) {
    const cx = clamp(x, LUT_MIN_X, LUT_MAX_X);
    const cy = clamp(y, LUT_MIN_Y, LUT_MAX_Y);
    const cu = clamp(((cx - LUT_MIN_X) / (LUT_MAX_X - LUT_MIN_X)) * (LUT_W - 1), 0, LUT_W - 1.001);
    const cv = clamp(((cy - LUT_MIN_Y) / (LUT_MAX_Y - LUT_MIN_Y)) * (LUT_H - 1), 0, LUT_H - 1.001);
    const ix = Math.floor(cu);
    const iy = Math.floor(cv);
    const edgeD = lut[iy * LUT_W + ix];
    const outDx = x - cx;
    const outDy = y - cy;
    return Math.max(0, edgeD) + Math.sqrt(outDx * outDx + outDy * outDy);
  }

  const ix = Math.floor(u);
  const iy = Math.floor(v);
  const fx = u - ix;
  const fy = v - iy;

  const d00 = lut[iy * LUT_W + ix];
  const d10 = lut[iy * LUT_W + ix + 1];
  const d01 = lut[(iy + 1) * LUT_W + ix];
  const d11 = lut[(iy + 1) * LUT_W + ix + 1];

  return mix(mix(d00, d10, fx), mix(d01, d11, fx), fy);
}

// ---------------------------------------------------------------------------
// 3. Full 3D Right Scapula Signed Distance Field
// ---------------------------------------------------------------------------

/** Thoracic wall curvature so costal surface is gently concave */
function bladeCamberZ(x: number, y: number): number {
  const xNorm = clamp((x + 0.08) / 0.8, -1.2, 1.2);
  return 0.078 * (1 - xNorm * xNorm) - 0.042 * y * y;
}

/** Spine center Y height along X across posterior blade */
function spineCrestLineY(x: number): number {
  const t = clamp((x + 0.65) / 1.15, 0, 1);
  return mix(0.43, 0.68, smoothstep(0, 1, t));
}

export function evaluateScapulaSDF(px: number, py: number, pz: number): number {
  // --- A. Scapular Blade with Fossae & Thickened Borders ---
  const d2d = sampleBlade2D(px, py);
  const zMid = bladeCamberZ(px, py);

  // Depth inside silhouette (0 at border, ~0.42 in central infraspinous fossa)
  const interior = Math.max(0, -d2d);

  // Thin cortical bone inside supraspinous & infraspinous fossae, thicker at borders
  const spineDistY = Math.abs(py - spineCrestLineY(px));
  const fossaDepression =
    smoothstep(0.05, 0.24, interior) * smoothstep(0.06, 0.22, spineDistY);
  let halfThickness = mix(0.042, 0.024, fossaDepression);

  // Inferior angle thickening (M. teres major origin)
  const infAngleProx = Math.exp(-((px + 0.31) ** 2 + (py + 0.96) ** 2) / 0.032);
  halfThickness += 0.022 * infAngleProx;

  // Superior angle slight thickening
  const supAngleProx = Math.exp(-((px + 0.58) ** 2 + (py - 0.84) ** 2) / 0.022);
  halfThickness += 0.012 * supAngleProx;

  // Subtle oblique costal muscular ridges on anterior (subscapular) surface
  const subscapZone = smoothstep(0.04, 0.16, interior) * smoothstep(0.35, -0.45, py);
  const costalRidges =
    pz < zMid ? 0.0055 * Math.sin((py - 0.42 * px) * 18.0) * subscapZone : 0;

  // Asymmetric posterior concavity in fossae vs costal curvature
  const zOffset = pz - zMid - costalRidges;
  const dz = Math.abs(zOffset) - halfThickness;

  // Exact 3D rounded-plate SDF
  const dBladeRaw =
    Math.min(Math.max(d2d, dz), 0) +
    Math.sqrt(Math.max(d2d, 0) ** 2 + Math.max(dz, 0) ** 2) -
    0.014;

  // Lateral (Axillary) Border thick cortical cylindrical buttress
  const dAxillaryBar = sdCapsule(
    px,
    py,
    pz,
    -0.31,
    -0.98,
    bladeCamberZ(-0.31, -0.98),
    0.58,
    0.22,
    -0.02,
    0.044,
    0.072
  );

  // Medial (Vertebral) Border subtle smooth rib
  const dMedialRim = sdCapsule(
    px,
    py,
    pz,
    -0.60,
    0.85,
    bladeCamberZ(-0.60, 0.85),
    -0.66,
    0.42,
    bladeCamberZ(-0.66, 0.42),
    0.036,
    0.044
  );
  const dMedialRimLow = sdCapsule(
    px,
    py,
    pz,
    -0.66,
    0.42,
    bladeCamberZ(-0.66, 0.42),
    -0.34,
    -0.98,
    bladeCamberZ(-0.34, -0.98),
    0.044,
    0.048
  );

  let dBone = smin(dBladeRaw, dAxillaryBar, 0.042);
  dBone = smin(dBone, dMedialRim, 0.028);
  dBone = smin(dBone, dMedialRimLow, 0.028);

  // --- B. Spine of the Scapula & Overhanging Acromion ---
  // Smooth osseous web rising from posterior blade out to spine crest (x: -0.65 -> +0.46)
  // Stops before x = +0.48 so the spinoglenoid notch stays cleanly open beneath the acromial neck!
  const xSpine = clamp(px, -0.64, 0.44);
  const tS = (xSpine + 0.64) / 1.08; // 0 (medial root) -> 1 (lateral crest)
  const ySpine = mix(0.43, 0.67, smoothstep(0, 1, tS));
  const zBase = bladeCamberZ(xSpine, ySpine) + 0.01;
  const zCrest = mix(0.08, 0.41, Math.pow(tS, 0.82));
  const zClamped = clamp(pz, zBase, zCrest);

  // Spine web tapers from blade attachment up to thick flared crest lip
  const heightFrac = zCrest > zBase + 1e-4 ? clamp((pz - zBase) / (zCrest - zBase), 0, 1) : 0;
  const webHalfWidth = mix(0.034, 0.052, heightFrac * smoothstep(0.05, 0.4, tS));
  const dxWeb = px - xSpine;
  const dyWeb = py - ySpine;
  const dzWeb = pz - zClamped;
  const dSpineWeb =
    Math.sqrt(dxWeb * dxWeb + dyWeb * dyWeb + dzWeb * dzWeb) - webHalfWidth;

  // Spine crest thickened rim & Acromion sweep over the spinoglenoid notch
  const dSpineSeg1 = sdCapsule(px, py, pz, -0.63, 0.43, 0.085, -0.15, 0.52, 0.25, 0.032, 0.052);
  const dSpineSeg2 = sdCapsule(px, py, pz, -0.15, 0.52, 0.25, 0.44, 0.67, 0.41, 0.052, 0.058);
  const dAcromionAngle = sdCapsule(px, py, pz, 0.44, 0.67, 0.41, 0.74, 0.76, 0.32, 0.056, 0.064);

  // Broad flattened Acromion plate extending anteriorly-laterally over glenoid
  // Anisotropic scaled ellipsoid rotated to align with acromion plane
  const acX = px - 0.83;
  const acY = py - 0.81;
  const acZ = pz - 0.06;
  // Slight pitch/roll so acromion roof slopes naturally forward & slightly laterally
  const acrRotY = acY * 0.96 + acZ * 0.28;
  const acrRotZ = -acY * 0.28 + acZ * 0.96;
  const dAcromionPlate = sdEllipsoid(acX, acrRotY, acrRotZ, 0.135, 0.044, 0.225);

  let dSpine = smin(dSpineWeb, dSpineSeg1, 0.03);
  dSpine = smin(dSpine, dSpineSeg2, 0.032);
  dSpine = smin(dSpine, dAcromionAngle, 0.04);
  dSpine = smin(dSpine, dAcromionPlate, 0.045);

  dBone = smin(dBone, dSpine, 0.042);

  // --- C. Scapular Neck, Pear-Shaped Glenoid Cavity & Tubercles ---
  const dNeck = sdCapsule(px, py, pz, 0.34, 0.41, -0.02, 0.64, 0.43, -0.05, 0.125, 0.142);
  dBone = smin(dBone, dNeck, 0.048);

  // Pear-shaped Glenoid Head centered at (0.70, 0.43, -0.06) facing laterally (+X) & slightly anterior (-Z)
  const gx = px - 0.70;
  const gy = py - 0.43;
  const gz = pz + 0.06;
  // Rotate ~16 degrees around Y so articular surface faces slightly anteriorly
  const cosG = 0.961;
  const sinG = 0.276;
  const gxr = gx * cosG - gz * sinG;
  const gzr = gx * sinG + gz * cosG;
  // Pear narrowing in superior half (gy > 0)
  const pearTaper = 1.0 - 0.26 * smoothstep(-0.08, 0.22, gy);
  const dGlenoidHead = sdEllipsoid(gxr, gy, gzr / pearTaper, 0.115, 0.235, 0.155);

  dBone = smin(dBone, dGlenoidHead, 0.035);

  // Smooth concave articular glenoid dish carved on the lateral face
  const dGlenoidDish = sdEllipsoid(gxr - 0.185, gy, gzr / pearTaper, 0.125, 0.185, 0.12);
  dBone = smaxSub(dBone, dGlenoidDish, 0.022);

  // Supraglenoid Tubercle (long head of biceps origin)
  const dSupraTub = sdEllipsoid(px - 0.66, py - 0.65, pz + 0.05, 0.052, 0.048, 0.055);
  dBone = smin(dBone, dSupraTub, 0.024);

  // Infraglenoid Tubercle (ORIGIN: Cabeça Longa do Tríceps Braquial)
  const dInfraTub = sdEllipsoid(px - 0.59, py - 0.19, pz + 0.02, 0.064, 0.058, 0.062);
  dBone = smin(dBone, dInfraTub, 0.025);

  // --- D. Coracoid Process (Processus coracoideus - Crow's Beak Hook) ---
  const dCor1 = sdCapsule(px, py, pz, 0.45, 0.61, -0.06, 0.44, 0.84, -0.12, 0.072, 0.064);
  const dCor2 = sdCapsule(px, py, pz, 0.44, 0.84, -0.12, 0.54, 0.81, -0.28, 0.064, 0.058);
  const dCor3 = sdCapsule(px, py, pz, 0.54, 0.81, -0.28, 0.65, 0.74, -0.46, 0.058, 0.042);

  let dCoracoid = smin(dCor1, dCor2, 0.036);
  dCoracoid = smin(dCoracoid, dCor3, 0.032);
  dBone = smin(dBone, dCoracoid, 0.038);

  // --- E. Crisp Suprascapular Notch Carving ---
  const dNotch = sdCapsule(px, py, pz, 0.18, 0.66, -0.25, 0.18, 0.66, 0.25, 0.052, 0.052);
  dBone = smaxSub(dBone, dNotch, 0.015);

  return dBone;
}

export function evaluateScapulaGradient(
  x: number,
  y: number,
  z: number,
  eps = 0.005
): [number, number, number] {
  const gx =
    evaluateScapulaSDF(x + eps, y, z) - evaluateScapulaSDF(x - eps, y, z);
  const gy =
    evaluateScapulaSDF(x, y + eps, z) - evaluateScapulaSDF(x, y - eps, z);
  const gz =
    evaluateScapulaSDF(x, y, z + eps) - evaluateScapulaSDF(x, y, z - eps);
  const len = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
  return [gx / len, gy / len, gz / len];
}

/**
 * Snaps an approximate anatomical landmark onto the exact SDF = 0 cortical surface
 * so 3D pins rest flush on the bone with zero floating or clipping.
 */
export function snapPointToScapulaSurface(
  approxPos: [number, number, number],
  searchDir: [number, number, number]
): { position: [number, number, number]; normal: [number, number, number] } {
  const dirLen = Math.hypot(searchDir[0], searchDir[1], searchDir[2]) || 1;
  const dx = searchDir[0] / dirLen;
  const dy = searchDir[1] / dirLen;
  const dz = searchDir[2] / dirLen;

  // March inward from outside (+0.30 along searchDir) toward inside (-0.25)
  // so we always pick the surface crossing facing searchDir!
  let [x, y, z] = approxPos;
  let bestT = 0;
  let bestScore = Infinity;

  for (let t = 0.28; t >= -0.22; t -= 0.01) {
    const cx = approxPos[0] + dx * t;
    const cy = approxPos[1] + dy * t;
    const cz = approxPos[2] + dz * t;
    const d = evaluateScapulaSDF(cx, cy, cz);
    if (Math.abs(d) < 0.04) {
      const [nx, ny, nz] = evaluateScapulaGradient(cx, cy, cz);
      const align = nx * dx + ny * dy + nz * dz;
      if (align > 0.25 && Math.abs(d) < bestScore) {
        bestScore = Math.abs(d);
        bestT = t;
      }
    }
  }

  x = approxPos[0] + dx * bestT;
  y = approxPos[1] + dy * bestT;
  z = approxPos[2] + dz * bestT;

  // Refine along SDF gradient
  for (let i = 0; i < 8; i++) {
    const d = evaluateScapulaSDF(x, y, z);
    if (Math.abs(d) < 0.0004) break;
    const [nx, ny, nz] = evaluateScapulaGradient(x, y, z);
    x -= d * nx * 0.85;
    y -= d * ny * 0.85;
    z -= d * nz * 0.85;
  }

  const normal = evaluateScapulaGradient(x, y, z);
  return {
    position: [x, y, z],
    normal,
  };
}

// ---------------------------------------------------------------------------
// 4. Marching Cubes Lookup Tables (Paul Bourke standard)
// ---------------------------------------------------------------------------

// prettier-ignore
const EDGE_TABLE = new Int32Array([
  0x0, 0x109, 0x203, 0x30a, 0x406, 0x50f, 0x605, 0x70c,
  0x80c, 0x905, 0xa0f, 0xb06, 0xc0a, 0xd03, 0xe09, 0xf00,
  0x190, 0x99, 0x393, 0x29a, 0x596, 0x49f, 0x795, 0x69c,
  0x99c, 0x895, 0xb9f, 0xa96, 0xd9a, 0xc93, 0xf99, 0xe90,
  0x230, 0x339, 0x33, 0x13a, 0x636, 0x73f, 0x435, 0x53c,
  0xa3c, 0xb35, 0x83f, 0x936, 0xe3a, 0xf33, 0xc39, 0xd30,
  0x3a0, 0x2a9, 0x1a3, 0xaa, 0x7a6, 0x6af, 0x5a5, 0x4ac,
  0xbac, 0xaa5, 0x9af, 0x8a6, 0xfaa, 0xea3, 0xda9, 0xca0,
  0x460, 0x569, 0x663, 0x76a, 0x66, 0x16f, 0x265, 0x36c,
  0xc6c, 0xd65, 0xe6f, 0xf66, 0x86a, 0x963, 0xa69, 0xb60,
  0x5f0, 0x4f9, 0x7f3, 0x6fa, 0x1f6, 0xff, 0x3f5, 0x2fc,
  0xdfc, 0xcf5, 0xfff, 0xef6, 0x9fa, 0x8f3, 0xbf9, 0xaf0,
  0x650, 0x759, 0x453, 0x55a, 0x256, 0x35f, 0x55, 0x15c,
  0xe5c, 0xf55, 0xc5f, 0xd56, 0xa5a, 0xb53, 0x859, 0x950,
  0x7c0, 0x6c9, 0x5c3, 0x4ca, 0x3c6, 0x2cf, 0x1c5, 0xcc,
  0xfcc, 0xec5, 0xdcf, 0xcc6, 0xbca, 0xac3, 0x9c9, 0x8c0,
  0x8c0, 0x9c9, 0xac3, 0xbca, 0xcc6, 0xdcf, 0xec5, 0xfcc,
  0xcc, 0x1c5, 0x2cf, 0x3c6, 0x4ca, 0x5c3, 0x6c9, 0x7c0,
  0x950, 0x859, 0xb53, 0xa5a, 0xd56, 0xc5f, 0xf55, 0xe5c,
  0x15c, 0x55, 0x35f, 0x256, 0x55a, 0x453, 0x759, 0x650,
  0xaf0, 0xbf9, 0x8f3, 0x9fa, 0xef6, 0xfff, 0xcf5, 0xdfc,
  0x2fc, 0x3f5, 0xff, 0x1f6, 0x6fa, 0x7f3, 0x4f9, 0x5f0,
  0xb60, 0xa69, 0x963, 0x86a, 0xf66, 0xe6f, 0xd65, 0xc6c,
  0x36c, 0x265, 0x16f, 0x66, 0x76a, 0x663, 0x569, 0x460,
  0xca0, 0xda9, 0xea3, 0xfaa, 0x8a6, 0x9af, 0xaa5, 0xbac,
  0x4ac, 0x5a5, 0x6af, 0x7a6, 0xaa, 0x1a3, 0x2a9, 0x3a0,
  0xd30, 0xc39, 0xf33, 0xe3a, 0x936, 0x83f, 0xb35, 0xa3c,
  0x53c, 0x435, 0x73f, 0x636, 0x13a, 0x33, 0x339, 0x230,
  0xe90, 0xf99, 0xc93, 0xd9a, 0xa96, 0xb9f, 0x895, 0x99c,
  0x69c, 0x795, 0x49f, 0x596, 0x29a, 0x393, 0x99, 0x190,
  0xf00, 0xe09, 0xd03, 0xc0a, 0xb06, 0xa0f, 0x905, 0x80c,
  0x70c, 0x605, 0x50f, 0x406, 0x30a, 0x203, 0x109, 0x0,
]);

// Full Bourke triTable (256 entries)
// prettier-ignore
const BOURKE_TRIS: number[][] = [
[],
[0,8,3],
[0,1,9],
[1,8,3,9,8,1],
[1,2,10],
[0,8,3,1,2,10],
[9,2,10,0,2,9],
[2,8,3,2,10,8,10,9,8],
[3,11,2],
[0,11,2,8,11,0],
[1,9,0,2,3,11],
[1,11,2,1,9,11,9,8,11],
[3,10,1,11,10,3],
[0,10,1,0,8,10,8,11,10],
[3,9,0,3,11,9,11,10,9],
[9,8,10,10,8,11],
[4,7,8],
[4,3,0,7,3,4],
[0,1,9,8,4,7],
[4,1,9,4,7,1,7,3,1],
[1,2,10,8,4,7],
[3,4,7,3,0,4,1,2,10],
[9,2,10,9,0,2,8,4,7],
[2,10,9,2,9,7,2,7,3,7,9,4],
[8,4,7,3,11,2],
[11,4,7,11,2,4,2,0,4],
[9,0,1,8,4,7,2,3,11],
[4,7,11,9,4,11,9,11,2,9,2,1],
[3,10,1,3,11,10,7,8,4],
[1,11,10,1,4,11,1,0,4,7,11,4],
[4,7,8,9,0,11,9,11,10,11,0,3],
[4,7,11,4,11,9,9,11,10],
[9,5,4],
[9,5,4,0,8,3],
[0,5,4,1,5,0],
[8,5,4,8,3,5,3,1,5],
[1,2,10,9,5,4],
[3,0,8,1,2,10,4,9,5],
[5,2,10,5,4,2,4,0,2],
[2,10,5,3,2,5,3,5,4,3,4,8],
[9,5,4,2,3,11],
[0,11,2,0,8,11,4,9,5],
[0,5,4,0,1,5,2,3,11],
[2,1,5,2,5,8,2,8,11,4,8,5],
[10,3,11,10,1,3,9,5,4],
[4,9,5,0,8,1,8,10,1,8,11,10],
[5,4,0,5,0,11,5,11,10,11,0,3],
[5,4,8,5,8,10,10,8,11],
[9,7,8,5,7,9],
[9,3,0,9,5,3,5,7,3],
[0,7,8,0,1,7,1,5,7],
[1,5,3,3,5,7],
[9,7,8,9,5,7,10,1,2],
[10,1,2,9,5,0,5,3,0,5,7,3],
[8,0,2,8,2,5,8,5,7,10,5,2],
[2,10,5,2,5,3,3,5,7],
[7,9,5,7,8,9,3,11,2],
[9,5,7,9,7,2,9,2,0,2,7,11],
[2,3,11,0,1,8,1,7,8,1,5,7],
[11,2,1,11,1,7,7,1,5],
[9,5,8,8,5,7,10,1,3,10,3,11],
[5,7,0,5,0,9,7,11,0,1,0,10,11,10,0],
[11,10,0,11,0,3,10,5,0,8,0,7,5,7,0],
[11,10,5,7,11,5],
[10,6,5],
[0,8,3,5,10,6],
[9,0,1,5,10,6],
[1,8,3,1,9,8,5,10,6],
[1,6,5,2,6,1],
[1,6,5,1,2,6,3,0,8],
[9,6,5,9,0,6,0,2,6],
[5,9,8,5,8,2,5,2,6,3,2,8],
[2,3,11,10,6,5],
[11,0,8,11,2,0,10,6,5],
[0,1,9,2,3,11,5,10,6],
[5,10,6,1,9,2,9,11,2,9,8,11],
[6,3,11,6,5,3,5,1,3],
[0,8,11,0,11,5,0,5,1,5,11,6],
[3,11,6,0,3,6,0,6,5,0,5,9],
[6,5,9,6,9,11,11,9,8],
[5,10,6,4,7,8],
[4,3,0,4,7,3,6,5,10],
[1,9,0,5,10,6,8,4,7],
[10,6,5,1,9,7,1,7,3,7,9,4],
[6,1,2,6,5,1,4,7,8],
[1,2,5,5,2,6,3,0,4,3,4,7],
[8,4,7,9,0,5,0,6,5,0,2,6],
[7,3,9,7,9,4,3,2,9,5,9,6,2,6,9],
[3,11,2,7,8,4,10,6,5],
[5,10,6,4,7,2,4,2,0,2,7,11],
[0,1,9,4,7,8,2,3,11,5,10,6],
[9,2,1,9,11,2,9,4,11,7,11,4,5,10,6],
[8,4,7,3,11,5,3,5,1,5,11,6],
[5,1,11,5,11,6,1,0,11,7,11,4,0,4,11],
[0,5,9,0,6,5,0,3,6,11,6,3,8,4,7],
[6,5,9,6,9,11,4,7,9,7,11,9],
[10,4,9,6,4,10],
[4,10,6,4,9,10,0,8,3],
[10,0,1,10,6,0,6,4,0],
[8,3,1,8,1,6,8,6,4,6,1,10],
[1,4,9,1,2,4,2,6,4],
[3,0,8,1,2,9,2,4,9,2,6,4],
[0,2,4,4,2,6],
[8,3,2,8,2,4,4,2,6],
[10,4,9,10,6,4,11,2,3],
[0,8,2,2,8,11,4,9,10,4,10,6],
[3,11,2,0,1,6,0,6,4,6,1,10],
[6,4,1,6,1,10,4,8,1,2,1,11,8,11,1],
[9,6,4,9,3,6,9,1,3,11,6,3],
[8,11,1,8,1,0,11,6,1,9,1,4,6,4,1],
[3,11,6,3,6,0,0,6,4],
[6,4,8,11,6,8],
[7,10,6,7,8,10,8,9,10],
[0,7,3,0,10,7,0,9,10,6,7,10],
[10,6,7,1,10,7,1,7,8,1,8,0],
[10,6,7,10,7,1,1,7,3],
[1,2,6,1,6,8,1,8,9,8,6,7],
[2,6,9,2,9,1,6,7,9,0,9,3,7,3,9],
[7,8,0,7,0,6,6,0,2],
[7,3,2,6,7,2],
[2,3,11,10,6,8,10,8,9,8,6,7],
[2,0,7,2,7,11,0,9,7,6,7,10,9,10,7],
[1,8,0,1,7,8,1,10,7,6,7,10,2,3,11],
[11,2,1,11,1,7,10,6,1,6,7,1],
[8,9,6,8,6,7,9,1,6,11,6,3,1,3,6],
[0,9,1,11,6,7],
[7,8,0,7,0,6,3,11,0,11,6,0],
[7,11,6],
[7,6,11],
[3,0,8,11,7,6],
[0,1,9,11,7,6],
[8,1,9,8,3,1,11,7,6],
[10,1,2,6,11,7],
[1,2,10,3,0,8,6,11,7],
[2,9,0,2,10,9,6,11,7],
[6,11,7,2,10,3,10,8,3,10,9,8],
[7,2,3,6,2,7],
[7,0,8,7,6,0,6,2,0],
[2,7,6,2,3,7,0,1,9],
[1,6,2,1,8,6,1,9,8,8,7,6],
[10,7,6,10,1,7,1,3,7],
[10,7,6,1,7,10,1,8,7,1,0,8],
[0,3,7,0,7,10,0,10,9,6,10,7],
[7,6,10,7,10,8,8,10,9],
[6,8,4,11,8,6],
[3,6,11,3,0,6,0,4,6],
[8,6,11,8,4,6,9,0,1],
[9,4,6,9,6,3,9,3,1,11,3,6],
[6,8,4,6,11,8,2,10,1],
[1,2,10,3,0,11,0,6,11,0,4,6],
[4,11,8,4,6,11,0,2,9,2,10,9],
[10,9,3,10,3,2,9,4,3,11,3,6,4,6,3],
[8,2,3,8,4,2,4,6,2],
[0,4,2,4,6,2],
[1,9,0,2,3,4,2,4,6,4,3,8],
[1,9,4,1,4,2,2,4,6],
[8,1,3,8,6,1,8,4,6,6,10,1],
[10,1,0,10,0,6,6,0,4],
[4,6,3,4,3,8,6,10,3,0,3,9,10,9,3],
[10,9,4,6,10,4],
[4,9,5,7,6,11],
[0,8,3,4,9,5,11,7,6],
[5,0,1,5,4,0,7,6,11],
[11,7,6,8,3,4,3,5,4,3,1,5],
[9,5,4,10,1,2,7,6,11],
[6,11,7,1,2,10,0,8,3,4,9,5],
[7,6,11,5,4,10,4,2,10,4,0,2],
[3,4,8,3,5,4,3,2,5,10,5,2,11,7,6],
[7,2,3,7,6,2,5,4,9],
[9,5,4,0,8,6,0,6,2,6,8,7],
[3,6,2,3,7,6,1,5,0,5,4,0],
[6,2,8,6,8,7,2,1,8,4,8,5,1,5,8],
[9,5,4,10,1,6,1,7,6,1,3,7],
[1,6,10,1,7,6,1,0,7,8,7,0,9,5,4],
[4,0,10,4,10,5,0,3,10,6,10,7,3,7,10],
[7,6,10,7,10,8,5,4,10,4,8,10],
[6,9,5,6,11,9,11,8,9],
[3,6,11,0,6,3,0,5,6,0,9,5],
[0,11,8,0,5,11,0,1,5,5,6,11],
[6,11,3,6,3,5,5,3,1],
[1,2,10,9,5,11,9,11,8,11,5,6],
[0,11,3,0,6,11,0,9,6,5,6,9,1,2,10],
[11,8,5,11,5,6,8,0,5,10,5,2,0,2,5],
[6,11,3,6,3,5,2,10,3,10,5,3],
[5,8,9,5,2,8,5,6,2,3,8,2],
[9,5,6,9,6,0,0,6,2],
[1,5,8,1,8,0,5,6,8,3,8,2,6,2,8],
[1,5,6,2,1,6],
[1,3,6,1,6,10,3,8,6,5,6,9,8,9,6],
[10,1,0,10,0,6,9,5,0,5,6,0],
[0,3,8,5,6,10],
[10,5,6],
[11,5,10,7,5,11],
[11,5,10,11,7,5,8,3,0],
[5,11,7,5,10,11,1,9,0],
[10,7,5,10,11,7,9,8,1,8,3,1],
[11,1,2,11,7,1,7,5,1],
[0,8,3,1,2,7,1,7,5,7,2,11],
[9,7,5,9,2,7,9,0,2,2,11,7],
[7,5,2,7,2,11,5,9,2,3,2,8,9,8,2],
[2,5,10,2,3,5,3,7,5],
[8,2,0,8,5,2,8,7,5,10,2,5],
[9,0,1,5,10,3,5,3,7,3,10,2],
[9,8,2,9,2,1,8,7,2,10,2,5,7,5,2],
[1,3,5,3,7,5],
[0,8,7,0,7,1,1,7,5],
[9,0,3,9,3,5,5,3,7],
[9,8,7,5,9,7],
[5,8,4,5,10,8,10,11,8],
[5,0,4,5,11,0,5,10,11,11,3,0],
[0,1,9,8,4,10,8,10,11,10,4,5],
[10,11,4,10,4,5,11,3,4,9,4,1,3,1,4],
[2,5,1,2,8,5,2,11,8,4,5,8],
[0,4,11,0,11,3,4,5,11,2,11,1,5,1,11],
[0,2,5,0,5,9,2,11,5,4,5,8,11,8,5],
[9,4,5,2,11,3],
[2,5,10,3,5,2,3,4,5,3,8,4],
[5,10,2,5,2,4,4,2,0],
[3,10,2,3,5,10,3,8,5,4,5,8,0,1,9],
[5,10,2,5,2,4,1,9,2,9,4,2],
[8,4,5,8,5,3,3,5,1],
[0,4,5,1,0,5],
[8,4,5,8,5,3,9,0,5,0,3,5],
[9,4,5],
[4,11,7,4,9,11,9,10,11],
[0,8,3,4,9,7,9,11,7,9,10,11],
[1,10,11,1,11,4,1,4,0,7,4,11],
[3,1,4,3,4,8,1,10,4,7,4,11,10,11,4],
[4,11,7,9,11,4,9,2,11,9,1,2],
[9,7,4,9,11,7,9,1,11,2,11,1,0,8,3],
[11,7,4,11,4,2,2,4,0],
[11,7,4,11,4,2,8,3,4,3,2,4],
[2,9,10,2,7,9,2,3,7,7,4,9],
[9,10,7,9,7,4,10,2,7,8,7,0,2,0,7],
[3,7,10,3,10,2,7,4,10,1,10,0,4,0,10],
[1,10,2,8,7,4],
[4,9,1,4,1,7,7,1,3],
[4,9,1,4,1,7,0,8,1],
[4,0,3,7,4,3],
[4,8,7],
[9,10,8,10,11,8],
[3,0,9,3,9,11,11,9,10],
[0,1,10,0,10,8,8,10,11],
[3,1,10,11,3,10],
[1,2,11,1,11,9,9,11,8],
[3,0,9,3,9,11,1,2,9,2,11,9],
[0,2,11,8,0,11],
[3,2,11],
[2,3,8,2,8,10,10,8,9],
[9,10,2,0,9,2],
[2,3,8,2,8,10,0,1,8,1,10,8],
[1,10,2],
[1,3,8,9,1,8],
[0,9,1],
[0,3,8],
[]
];

const EDGE_CORNERS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7],
];

const CORNER_OFFSETS: Array<[number, number, number]> = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];

// ---------------------------------------------------------------------------
// 5. Marching Cubes Mesh Builder + Cortical Color & AO Baking
// ---------------------------------------------------------------------------

export function buildRightScapulaGeometry(resolutionScale = 1): THREE.BufferGeometry {
  const nx = Math.round(78 * resolutionScale);
  const ny = Math.round(98 * resolutionScale);
  const nz = Math.round(54 * resolutionScale);

  const minX = -0.84;
  const maxX = 1.06;
  const minY = -1.18;
  const maxY = 1.04;
  const minZ = -0.58;
  const maxZ = 0.56;

  const dx = (maxX - minX) / (nx - 1);
  const dy = (maxY - minY) / (ny - 1);
  const dz = (maxZ - minZ) / (nz - 1);

  const field = new Float32Array(nx * ny * nz);
  field.fill(1.0);
  const strideY = nx;
  const strideZ = nx * ny;

  // Two-pass block culling: sample coarse grid strictly once, then evaluate only active blocks
  const step = 3;
  const cnx = Math.ceil(nx / step);
  const cny = Math.ceil(ny / step);
  const cnz = Math.ceil(nz / step);
  const coarse = new Float32Array(cnx * cny * cnz);

  for (let cz = 0; cz < cnz; cz++) {
    const iz = Math.min(cz * step, nz - 1);
    const z = minZ + iz * dz;
    for (let cy = 0; cy < cny; cy++) {
      const iy = Math.min(cy * step, ny - 1);
      const y = minY + iy * dy;
      for (let cx = 0; cx < cnx; cx++) {
        const ix = Math.min(cx * step, nx - 1);
        const x = minX + ix * dx;
        const val = evaluateScapulaSDF(x, y, z);
        coarse[(cz * cny + cy) * cnx + cx] = val;
        field[iz * strideZ + iy * strideY + ix] = val;
      }
    }
  }

  for (let cz = 0; cz < cnz - 1; cz++) {
    const bz = cz * step;
    const bzEnd = cz === cnz - 2 ? nz : (cz + 1) * step;
    for (let cy = 0; cy < cny - 1; cy++) {
      const by = cy * step;
      const byEnd = cy === cny - 2 ? ny : (cy + 1) * step;
      for (let cx = 0; cx < cnx - 1; cx++) {
        const bx = cx * step;
        const bxEnd = cx === cnx - 2 ? nx : (cx + 1) * step;

        const base = (cz * cny + cy) * cnx + cx;
        const v000 = coarse[base];
        const v100 = coarse[base + 1];
        const v010 = coarse[base + cnx];
        const v110 = coarse[base + cnx + 1];
        const v001 = coarse[base + cnx * cny];
        const v101 = coarse[base + cnx * cny + 1];
        const v011 = coarse[base + cnx * cny + cnx];
        const v111 = coarse[base + cnx * cny + cnx + 1];

        const minV = Math.min(v000, v100, v010, v110, v001, v101, v011, v111);
        const maxV = Math.max(v000, v100, v010, v110, v001, v101, v011, v111);
        if (minV > 0.26) continue;
        if (maxV < -0.26) {
          for (let iz = bz; iz < bzEnd; iz++) {
            const zOff = iz * strideZ;
            for (let iy = by; iy < byEnd; iy++) {
              const yOff = zOff + iy * strideY;
              for (let ix = bx; ix < bxEnd; ix++) {
                field[yOff + ix] = -1.0;
              }
            }
          }
          continue;
        }

        for (let iz = bz; iz < bzEnd; iz++) {
          const z = minZ + iz * dz;
          const zOff = iz * strideZ;
          for (let iy = by; iy < byEnd; iy++) {
            const y = minY + iy * dy;
            const yOff = zOff + iy * strideY;
            for (let ix = bx; ix < bxEnd; ix++) {
              const x = minX + ix * dx;
              field[yOff + ix] = evaluateScapulaSDF(x, y, z);
            }
          }
        }
      }
    }
  }

  // Vertex deduplication map per grid edge
  const edgeCache = new Map<number, number>();
  const positions: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const maxDim = nx * ny * nz;
  const getVertex = (
    ix: number,
    iy: number,
    iz: number,
    edgeIdx: number,
    cVals: Float32Array
  ): number => {
    const [c0, c1] = EDGE_CORNERS[edgeIdx];
    const [o0x, o0y, o0z] = CORNER_OFFSETS[c0];
    const [o1x, o1y, o1z] = CORNER_OFFSETS[c1];

    const gx0 = ix + o0x;
    const gy0 = iy + o0y;
    const gz0 = iz + o0z;
    const gx1 = ix + o1x;
    const gy1 = iy + o1y;
    const gz1 = iz + o1z;

    const id0 = gz0 * strideZ + gy0 * strideY + gx0;
    const id1 = gz1 * strideZ + gy1 * strideY + gx1;
    const key = (id0 < id1 ? id0 : id1) * 3 + (gx0 !== gx1 ? 0 : gy0 !== gy1 ? 1 : 2);
    const existing = edgeCache.get(key);
    if (existing !== undefined) return existing;

    const v0 = cVals[c0];
    const v1 = cVals[c1];
    const t = Math.abs(v1 - v0) > 1e-6 ? clamp(-v0 / (v1 - v0), 0, 1) : 0.5;

    const px = minX + mix(gx0, gx1, t) * dx;
    const py = minY + mix(gy0, gy1, t) * dy;
    const pz = minZ + mix(gz0, gz1, t) * dz;

    const [snx, sny, snz] = evaluateScapulaGradient(px, py, pz);

    // Compute cortical bone color + baked anatomical crevice AO
    // Probe short distance outward along normal to detect fossae/notches (crevice occlusion)
    const dProbe1 = evaluateScapulaSDF(px + snx * 0.09, py + sny * 0.09, pz + snz * 0.09);
    const dProbe2 = evaluateScapulaSDF(px + snx * 0.22, py + sny * 0.22, pz + snz * 0.22);
    const ao = clamp(0.45 + 0.55 * clamp((dProbe1 / 0.09 + dProbe2 / 0.22) * 0.5, 0.2, 1.0), 0.5, 1.0);

    // Slight warm ivory / dry-bone cortical tone with pearl-cartilage glenoid tint
    const glenoidBlend =
      smoothstep(0.58, 0.72, px) *
      smoothstep(0.22, 0.34, py) *
      smoothstep(0.64, 0.50, py) *
      smoothstep(0.18, 0.02, Math.abs(pz + 0.06));

    // Warm cortical base (#ebe0cb) -> deeper mineral ochre in fossae (#9d8462) -> glenoid pearl (#f4f0e8)
    const baseR = mix(0.62, 0.93, ao);
    const baseG = mix(0.52, 0.87, ao);
    const baseB = mix(0.39, 0.76, ao);

    const r = mix(baseR, 0.96, glenoidBlend * 0.65);
    const g = mix(baseG, 0.94, glenoidBlend * 0.65);
    const b = mix(baseB, 0.90, glenoidBlend * 0.65);

    const vertIndex = positions.length / 3;
    positions.push(px, py, pz);
    normals.push(snx, sny, snz);
    colors.push(r, g, b);
    edgeCache.set(key, vertIndex);
    return vertIndex;
  };

  // Avoid unused var warning
  void maxDim;

  const cVals = new Float32Array(8);
  const edgeVerts = new Int32Array(12);

  for (let iz = 0; iz < nz - 1; iz++) {
    for (let iy = 0; iy < ny - 1; iy++) {
      for (let ix = 0; ix < nx - 1; ix++) {
        const base = iz * strideZ + iy * strideY + ix;
        cVals[0] = field[base];
        cVals[1] = field[base + 1];
        cVals[2] = field[base + strideY + 1];
        cVals[3] = field[base + strideY];
        cVals[4] = field[base + strideZ];
        cVals[5] = field[base + strideZ + 1];
        cVals[6] = field[base + strideZ + strideY + 1];
        cVals[7] = field[base + strideZ + strideY];

        let cubeIdx = 0;
        if (cVals[0] < 0) cubeIdx |= 1;
        if (cVals[1] < 0) cubeIdx |= 2;
        if (cVals[2] < 0) cubeIdx |= 4;
        if (cVals[3] < 0) cubeIdx |= 8;
        if (cVals[4] < 0) cubeIdx |= 16;
        if (cVals[5] < 0) cubeIdx |= 32;
        if (cVals[6] < 0) cubeIdx |= 64;
        if (cVals[7] < 0) cubeIdx |= 128;

        const edgeMask = EDGE_TABLE[cubeIdx];
        if (edgeMask === 0) continue;

        for (let e = 0; e < 12; e++) {
          if (edgeMask & (1 << e)) {
            edgeVerts[e] = getVertex(ix, iy, iz, e, cVals);
          }
        }

        const tris = BOURKE_TRIS[cubeIdx];
        for (let t = 0; t < tris.length; t += 3) {
          const i0 = edgeVerts[tris[t]];
          let i1 = edgeVerts[tris[t + 1]];
          let i2 = edgeVerts[tris[t + 2]];

          // Enforce outward-facing winding using analytical SDF normals
          const ax = positions[i0 * 3];
          const ay = positions[i0 * 3 + 1];
          const az = positions[i0 * 3 + 2];
          const abx = positions[i1 * 3] - ax;
          const aby = positions[i1 * 3 + 1] - ay;
          const abz = positions[i1 * 3 + 2] - az;
          const acx = positions[i2 * 3] - ax;
          const acy = positions[i2 * 3 + 1] - ay;
          const acz = positions[i2 * 3 + 2] - az;

          const fnx = aby * acz - abz * acy;
          const fny = abz * acx - abx * acz;
          const fnz = abx * acy - aby * acx;

          const avgNx = normals[i0 * 3] + normals[i1 * 3] + normals[i2 * 3];
          const avgNy = normals[i0 * 3 + 1] + normals[i1 * 3 + 1] + normals[i2 * 3 + 1];
          const avgNz = normals[i0 * 3 + 2] + normals[i1 * 3 + 2] + normals[i2 * 3 + 2];

          if (fnx * avgNx + fny * avgNy + fnz * avgNz < 0) {
            const tmp = i1;
            i1 = i2;
            i2 = tmp;
          }

          indices.push(i0, i1, i2);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  geometry.computeBoundingBox();

  return geometry;
}

let cachedScapulaGeometry: THREE.BufferGeometry | null = null;
export function getRightScapulaGeometry(): THREE.BufferGeometry {
  if (!cachedScapulaGeometry) {
    cachedScapulaGeometry = buildRightScapulaGeometry(0.95);
  }
  return cachedScapulaGeometry;
}

// ---------------------------------------------------------------------------
// 6. Seamless Procedural Dry-Bone Cortical Detail Texture + Triplanar PBR Shader
// ---------------------------------------------------------------------------

function createCorticalBoneTexture(): THREE.DataTexture {
  const size = 256;
  const data = new Uint8Array(size * size * 4);

  // Tileable deterministic pseudo-noise
  const hash = (x: number, y: number, seed: number) => {
    const wx = ((x % size) + size) % size;
    const wy = ((y % size) + size) % size;
    let n = Math.sin(wx * 12.9898 + wy * 78.233 + seed * 37.719) * 43758.5453;
    return n - Math.floor(n);
  };

  const smoothTileNoise = (u: number, v: number, freq: number, seed: number) => {
    const x = u * freq;
    const y = v * freq;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const m = Math.round(freq);
    const wrap = (k: number) => ((k % m) + m) % m;
    const h00 = Math.sin(wrap(ix) * 127.1 + wrap(iy) * 311.7 + seed) * 43758.5453;
    const h10 = Math.sin(wrap(ix + 1) * 127.1 + wrap(iy) * 311.7 + seed) * 43758.5453;
    const h01 = Math.sin(wrap(ix) * 127.1 + wrap(iy + 1) * 311.7 + seed) * 43758.5453;
    const h11 = Math.sin(wrap(ix + 1) * 127.1 + wrap(iy + 1) * 311.7 + seed) * 43758.5453;
    const f00 = h00 - Math.floor(h00);
    const f10 = h10 - Math.floor(h10);
    const f01 = h01 - Math.floor(h01);
    const f11 = h11 - Math.floor(h11);
    return mix(mix(f00, f10, sx), mix(f01, f11, sx), sy);
  };

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;

      // Anisotropic periosteal / Haversian cortical fiber striations
      const streak1 = smoothTileNoise(u * 1.0, v * 0.25, 16, 1.3);
      const streak2 = smoothTileNoise(u * 2.0, v * 0.5, 32, 4.7);
      const grain = smoothTileNoise(u, v, 48, 9.1);
      const microPore = hash(x, y, 17.3) > 0.988 ? 0.32 : 0.0;

      // R: Albedo mineral variation (0.78..1.0)
      const albedo = clamp(0.84 + (streak1 - 0.5) * 0.14 + (grain - 0.5) * 0.1 - microPore * 0.22, 0.55, 1.0);
      // G: Bump height (cortical ridges + osteon pits)
      const height = clamp(0.5 + (streak1 - 0.5) * 0.24 + (streak2 - 0.5) * 0.18 + (grain - 0.5) * 0.16 - microPore * 0.45, 0.0, 1.0);
      // B: Roughness modulation (dry bone compact sheen vs rougher micro-pits)
      const rough = clamp(0.48 + (1.0 - streak1) * 0.18 + grain * 0.14 + microPore * 0.35, 0.35, 0.92);

      const idx = (y * size + x) * 4;
      data[idx] = Math.round(albedo * 255);
      data[idx + 1] = Math.round(height * 255);
      data[idx + 2] = Math.round(rough * 255);
      data[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function createDryBonePBRMaterial(): {
  material: THREE.MeshPhysicalMaterial;
  texture: THREE.DataTexture;
} {
  const texture = createCorticalBoneTexture();

  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#f2e8d4'),
    vertexColors: true,
    roughness: 0.48,
    metalness: 0.02,
    clearcoat: 0.18,
    clearcoatRoughness: 0.52,
    reflectivity: 0.55,
    sheen: 0.18,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color('#fff5e0'),
    envMapIntensity: 1.15,
  });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBoneTex = { value: texture };
    shader.uniforms.uBoneScale = { value: 1.65 };
    shader.uniforms.uBumpStrength = { value: 0.032 };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vObjPos;
        varying vec3 vObjNorm;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vObjPos = position;
        vObjNorm = normalize(normal);`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uBoneTex;
        uniform float uBoneScale;
        uniform float uBumpStrength;
        varying vec3 vObjPos;
        varying vec3 vObjNorm;

        vec3 sampleTriplanarBone(vec3 pos, vec3 nrm) {
          vec3 blend = abs(nrm);
          blend = pow(blend, vec3(4.0));
          blend /= max(blend.x + blend.y + blend.z, 0.0001);
          vec3 cx = texture2D(uBoneTex, pos.zy * uBoneScale).rgb;
          vec3 cy = texture2D(uBoneTex, pos.xz * uBoneScale).rgb;
          vec3 cz = texture2D(uBoneTex, pos.xy * uBoneScale).rgb;
          return cx * blend.x + cy * blend.y + cz * blend.z;
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 boneDetail = sampleTriplanarBone(vObjPos, vObjNorm);
        diffuseColor.rgb *= mix(0.84, 1.08, boneDetail.r);`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor * mix(0.76, 1.24, boneDetail.b), 0.28, 0.9);`
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        float hBone = boneDetail.g * uBumpStrength;
        vec3 vSigX = dFdx(vViewPosition);
        vec3 vSigY = dFdy(vViewPosition);
        vec3 r1 = cross(vSigY, normal);
        vec3 r2 = cross(normal, vSigX);
        float fDet = dot(vSigX, r1);
        float dHx = dFdx(hBone);
        float dHy = dFdy(hBone);
        vec3 surfGrad = sign(fDet) * (dHx * r1 + dHy * r2);
        if (abs(fDet) > 1e-6) {
          normal = normalize(abs(fDet) * normal - surfGrad);
        }`
      );
  };

  material.customProgramCacheKey = () => 'palas-dry-bone-pbr-v1';

  return { material, texture };
}

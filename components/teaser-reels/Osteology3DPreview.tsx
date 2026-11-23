'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { getRightScapulaGeometry } from '@/components/teaser/scapulaGeometry';

interface Osteology3DPreviewProps {
  t: number;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Deterministic 3D software-projected Scapula preview reusing the project's
 * scapulaGeometry.ts mesh so every Playwright frame renders instantaneously in lockstep with t.
 */
export function Osteology3DPreview({
  t,
  width = 420,
  height = 360,
  className = '',
}: Osteology3DPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scapulaGeo = useMemo(() => getRightScapulaGeometry(), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    const posAttr = scapulaGeo.getAttribute('position') as THREE.BufferAttribute;
    const nrmAttr = scapulaGeo.getAttribute('normal') as THREE.BufferAttribute;
    const idxAttr = scapulaGeo.getIndex();
    if (!posAttr || !nrmAttr || !idxAttr) return;

    const rotY = -0.35 + t * 0.36;
    const rotX = 0.08 + Math.sin(t * 0.85) * 0.05;

    const rigEuler = new THREE.Euler(rotX, rotY, 0, 'XYZ');
    const rigQuat = new THREE.Quaternion().setFromEuler(rigEuler);
    const rigMat = new THREE.Matrix4().compose(
      new THREE.Vector3(0, 0.04, 0),
      rigQuat,
      new THREE.Vector3(1.12, 1.12, 1.12)
    );

    const cam = new THREE.PerspectiveCamera(38, width / height, 0.1, 30);
    cam.position.set(0, 0.12, 4.35);
    cam.lookAt(0, 0.04, 0);
    cam.updateMatrixWorld();

    const lightKey = new THREE.Vector3(0.55, 0.72, 0.78).normalize();
    const lightRim = new THREE.Vector3(-0.7, 0.35, -0.58).normalize();

    const vertCount = posAttr.count;
    const projX = new Float32Array(vertCount);
    const projY = new Float32Array(vertCount);
    const projZ = new Float32Array(vertCount);
    const viewX = new Float32Array(vertCount);
    const viewY = new Float32Array(vertCount);
    const viewZ = new Float32Array(vertCount);
    const normX = new Float32Array(vertCount);
    const normY = new Float32Array(vertCount);
    const normZ = new Float32Array(vertCount);

    const pv = new THREE.Vector3();
    const nv = new THREE.Vector3();
    const cv = new THREE.Vector3();

    for (let i = 0; i < vertCount; i++) {
      pv.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)).applyMatrix4(rigMat);
      nv.set(nrmAttr.getX(i), nrmAttr.getY(i), nrmAttr.getZ(i))
        .transformDirection(rigMat)
        .normalize();

      viewX[i] = pv.x;
      viewY[i] = pv.y;
      viewZ[i] = pv.z;
      normX[i] = nv.x;
      normY[i] = nv.y;
      normZ[i] = nv.z;

      cv.copy(pv).project(cam);
      projX[i] = (cv.x * 0.5 + 0.5) * width;
      projY[i] = (-cv.y * 0.5 + 0.5) * height;
      projZ[i] = pv.z;
    }

    const triCount = Math.floor(idxAttr.count / 3);
    const BUCKETS = 256;
    const bucketHead = new Int32Array(BUCKETS).fill(-1);
    const triNext = new Int32Array(triCount).fill(-1);
    const triColors: string[] = new Array(triCount);

    for (let ti = 0; ti < triCount; ti++) {
      const i0 = idxAttr.getX(ti * 3);
      const i1 = idxAttr.getX(ti * 3 + 1);
      const i2 = idxAttr.getX(ti * 3 + 2);

      const ax = projX[i1] - projX[i0];
      const ay = projY[i1] - projY[i0];
      const bx = projX[i2] - projX[i0];
      const by = projY[i2] - projY[i0];
      if (ax * by - ay * bx >= 0) continue;

      const avgZ = (projZ[i0] + projZ[i1] + projZ[i2]) / 3;
      const fnx = normX[i0] + normX[i1] + normX[i2];
      const fny = normY[i0] + normY[i1] + normY[i2];
      const fnz = normZ[i0] + normZ[i1] + normZ[i2];
      const fLen = Math.hypot(fnx, fny, fnz) || 1;
      const nx = fnx / fLen;
      const ny = fny / fLen;
      const nz = fnz / fLen;

      const cx = (viewX[i0] + viewX[i1] + viewX[i2]) / 3;
      const cy = (viewY[i0] + viewY[i1] + viewY[i2]) / 3;
      const cz = (viewZ[i0] + viewZ[i1] + viewZ[i2]) / 3;

      const vx = cam.position.x - cx;
      const vy = cam.position.y - cy;
      const vz = cam.position.z - cz;
      const vLen = Math.hypot(vx, vy, vz) || 1;

      const diff = Math.max(0, nx * lightKey.x + ny * lightKey.y + nz * lightKey.z);
      const rim = Math.max(0, nx * lightRim.x + ny * lightRim.y + nz * lightRim.z);
      const fresnel = Math.pow(1 - Math.max(0, (nx * vx + ny * vy + nz * vz) / vLen), 2.3);

      const r = Math.min(255, Math.round(72 + diff * 165 + rim * 24 + fresnel * 34));
      const g = Math.min(255, Math.round(64 + diff * 150 + rim * 36 + fresnel * 38));
      const b = Math.min(255, Math.round(52 + diff * 124 + rim * 52 + fresnel * 28));
      triColors[ti] = `rgb(${r},${g},${b})`;

      const bIdx = Math.max(0, Math.min(BUCKETS - 1, Math.floor(((avgZ + 2.2) / 4.4) * BUCKETS)));
      triNext[ti] = bucketHead[bIdx];
      bucketHead[bIdx] = ti;
    }

    ctx.clearRect(0, 0, width, height);

    const glow = ctx.createRadialGradient(
      width * 0.5,
      height * 0.48,
      20,
      width * 0.5,
      height * 0.48,
      width * 0.48
    );
    glow.addColorStop(0, 'rgba(3, 105, 161, 0.22)');
    glow.addColorStop(0.55, 'rgba(13, 148, 136, 0.12)');
    glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    for (let b = 0; b < BUCKETS; b++) {
      let ti = bucketHead[b];
      while (ti !== -1) {
        const i0 = idxAttr.getX(ti * 3);
        const i1 = idxAttr.getX(ti * 3 + 1);
        const i2 = idxAttr.getX(ti * 3 + 2);
        const fill = triColors[ti];
        ctx.beginPath();
        ctx.moveTo(projX[i0], projY[i0]);
        ctx.lineTo(projX[i1], projY[i1]);
        ctx.lineTo(projX[i2], projY[i2]);
        ctx.closePath();
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = fill;
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ti = triNext[ti];
      }
    }

    // Precision anatomical pins matching Palas teal/amber style
    const pins = [
      { label: '01 Fossa Supraespinal', x: width * 0.46, y: height * 0.28, color: '#0d9488' },
      { label: '02 Tub. Infraglenoidal', x: width * 0.65, y: height * 0.52, color: '#f59e0b' },
    ];
    for (const p of pins) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();
      ctx.restore();
    }
  }, [t, width, height, scapulaGeo]);

  return <canvas ref={canvasRef} className={`block ${className}`} style={{ width, height }} />;
}

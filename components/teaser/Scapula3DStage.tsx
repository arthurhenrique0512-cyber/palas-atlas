'use client';

import React, { useMemo, useRef, useEffect, useState, Component } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import {
  getRightScapulaGeometry,
  createDryBonePBRMaterial,
  snapPointToScapulaSurface,
} from './scapulaGeometry';
import { SCAPULA_HOTSPOTS, RAPID_SWITCH_SEQUENCE } from './types';

export interface ProjectedPinState {
  id: string;
  xPercent: number;
  yPercent: number;
  visible: boolean;
  intensity: number;
}

interface Scapula3DStageProps {
  currentTimeRef: React.MutableRefObject<number>;
  onPinsUpdate?: (pins: ProjectedPinState[]) => void;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// ---------------------------------------------------------------------------
// Shared Deterministic 25s Choreography (Used by both WebGL & Fallback 3D)
// ---------------------------------------------------------------------------

interface ChoreographyState {
  rotX: number;
  rotY: number;
  posX: number;
  posY: number;
  boneScale: number;
  camX: number;
  camY: number;
  camZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  boneOpacity: number;
  showWireframe: boolean;
  particleOpacity: number;
}

function computeScapulaChoreography(t: number): ChoreographyState {
  let rotY = -0.35;
  let rotX = 0.08;
  let posX = 0;
  let posY = 0.08;
  let boneScale = 1.0;

  if (t < 4.0) {
    const p = smoothstep(2.2, 4.0, t);
    rotY = mix(-0.7, -0.35, p);
    rotX = mix(0.14, 0.08, p);
    boneScale = mix(0.82, 1.0, p);
    posY = mix(-0.1, 0.08, p);
  } else if (t < 8.2) {
    const p = smoothstep(4.0, 8.2, t);
    rotY = mix(-0.35, -0.08, p);
    rotX = mix(0.08, 0.04, p);
    posY = mix(0.08, 0.04, p);
  } else if (t < 12.0) {
    const p = smoothstep(8.2, 11.4, t);
    rotY = mix(-0.08, -1.06, p);
    rotX = mix(0.04, -0.08, p);
    posY = mix(0.04, 0.02, p);
  } else if (t < 14.2) {
    const p = smoothstep(12.0, 13.6, t);
    rotY = mix(-1.06, -0.22, p);
    rotX = mix(-0.08, 0.05, p);
    posX = mix(0, -0.44, p);
    posY = 0.06;
  } else if (t < 20.0) {
    const p = smoothstep(14.2, 15.0, t);
    const sway = Math.sin((t - 14.2) * 0.9) * 0.14;
    posX = mix(-0.44, 0, p);
    rotY = mix(-0.22, 0.05, p) + sway;
    rotX = 0.04;
    posY = 0.08;
  } else {
    const p = smoothstep(20.0, 21.8, t);
    rotY = 0.18 + (t - 20.0) * 0.12;
    rotX = 0.06;
    posY = mix(0.08, 0.45, p);
    boneScale = mix(1.0, 0.72, p);
  }

  let camX = 0;
  let camY = 0.05;
  let camZ = 5.4;
  let targetX = 0;
  let targetY = 0.02;
  let targetZ = 0;

  if (t < 4.0) {
    const p = smoothstep(2.0, 4.0, t);
    camZ = mix(6.8, 5.05, p);
    camY = mix(0.22, 0.08, p);
  } else if (t < 8.0) {
    const p = smoothstep(4.2, 7.6, t);
    camZ = mix(5.05, 3.38, p);
    camY = mix(0.08, 0.24, p);
    targetY = mix(0.02, 0.18, p);
    targetX = mix(0, 0.06, p);
  } else if (t < 12.0) {
    const p = smoothstep(8.0, 11.2, t);
    camZ = mix(3.38, 3.68, p);
    camY = mix(0.24, 0.30, p);
    targetX = mix(0.06, 0.26, p);
    targetY = mix(0.18, 0.26, p);
  } else if (t < 14.2) {
    const p = smoothstep(12.0, 13.5, t);
    camZ = mix(3.68, 5.15, p);
    targetX = mix(0.26, 0.12, p);
    targetY = mix(0.26, 0.06, p);
  } else if (t < 20.0) {
    const p = smoothstep(14.2, 15.0, t);
    camZ = mix(5.15, 4.85, p);
    targetX = mix(0.12, 0, p);
    targetY = 0.08;
  } else {
    const p = smoothstep(20.0, 21.5, t);
    camZ = mix(4.85, 6.8, p);
    camY = mix(0.08, 0.35, p);
    targetY = mix(0.08, 0.2, p);
  }

  const activeRapidBeat = RAPID_SWITCH_SEQUENCE.find(
    (f) => t >= f.startSec && t < f.endSec
  );

  const boneFadeIn = smoothstep(3.3, 4.25, t);
  const act4BoneDim = 1.0 - smoothstep(19.9, 21.2, t) * 0.85;
  const isShowingClassicPlate = activeRapidBeat?.mode === 'plate';
  const boneOpacity = clamp(
    boneFadeIn * act4BoneDim * (isShowingClassicPlate ? 0.12 : 1.0),
    0,
    1
  );

  const act1Boost = 1.0 - smoothstep(3.5, 5.0, t) * 0.58;
  const act4Fade = 1.0 - smoothstep(19.5, 21.5, t) * 0.65;

  return {
    rotX,
    rotY,
    posX,
    posY,
    boneScale,
    camX,
    camY,
    camZ,
    targetX,
    targetY,
    targetZ,
    boneOpacity,
    showWireframe: activeRapidBeat?.mode === '3d-wire',
    particleOpacity: 0.58 * act1Boost * act4Fade,
  };
}

// ---------------------------------------------------------------------------
// WebGL Support Detector & ErrorBoundary
// ---------------------------------------------------------------------------

function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
      canvas.getContext('experimental-webgl');
    return Boolean(gl);
  } catch {
    return false;
  }
}

class WebGLErrorBoundary extends Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { fallback: React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch() {
    // Gracefully fall back to Software 3D Canvas Rasterizer
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// Soft Bokeh Studio Dust / Mineral Motes (WebGL Path)
// ---------------------------------------------------------------------------

function createBokehSpriteTexture(): THREE.DataTexture {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x / (size - 1)) * 2 - 1;
      const dy = (y / (size - 1)) * 2 - 1;
      const r = Math.sqrt(dx * dx + dy * dy);
      const alpha = Math.pow(clamp(1 - r, 0, 1), 2.1);
      const idx = (y * size + x) * 4;
      data[idx] = 255;
      data[idx + 1] = 248;
      data[idx + 2] = 228;
      data[idx + 3] = Math.round(alpha * 255);
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

function StudioParticles({
  currentTimeRef,
}: {
  currentTimeRef: React.MutableRefObject<number>;
}) {
  const pointsRef = useRef<THREE.Points>(null);
  const matRef = useRef<THREE.PointsMaterial>(null);

  const count = 135;
  const { positions, seeds, sprite } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const s = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Mutually independent low-discrepancy R3 sequences for organic spatial spread
      const f1 = ((i * 0.7548776662 + 0.11) % 1) * 2 - 1;
      const f2 = ((i * 0.5698402910 + 0.37) % 1) * 2 - 1;
      const f3 = ((i * 0.4301597090 + 0.63) % 1) * 2 - 1;
      pos[i * 3] = f1 * 2.4;
      pos[i * 3 + 1] = f2 * 3.2;
      pos[i * 3 + 2] = f3 * 2.4 - 0.3;
      s[i * 3] = (i % 7) * 0.45 + 0.3;
      s[i * 3 + 1] = 0.08 + ((i * 13) % 10) * 0.014;
      s[i * 3 + 2] = (i % 5) * 1.1;
    }
    return { positions: pos, seeds: s, sprite: createBokehSpriteTexture() };
  }, []);

  useEffect(() => {
    return () => {
      sprite.dispose();
    };
  }, [sprite]);

  useFrame(() => {
    const t = currentTimeRef.current;
    const choreo = computeScapulaChoreography(t);
    if (pointsRef.current) {
      const attr = pointsRef.current.geometry.getAttribute(
        'position'
      ) as THREE.BufferAttribute;
      const arr = attr.array as Float32Array;
      for (let i = 0; i < count; i++) {
        const phase = seeds[i * 3];
        const speed = seeds[i * 3 + 1];
        const sway = seeds[i * 3 + 2];
        const baseX = (((i * 0.7548776662 + 0.11) % 1) * 2 - 1) * 2.4;
        const baseY = (((i * 0.5698402910 + 0.37) % 1) * 2 - 1) * 3.2;
        const wrappedY = ((baseY + t * speed + 3.2) % 6.4) - 3.2;
        arr[i * 3] = baseX + Math.sin(t * 0.55 + phase) * 0.14;
        arr[i * 3 + 1] = wrappedY;
        arr[i * 3 + 2] =
          (((i * 0.4301597090 + 0.63) % 1) * 2 - 1) * 2.4 +
          Math.cos(t * 0.4 + sway) * 0.12 -
          0.3;
      }
      attr.needsUpdate = true;
    }
    if (matRef.current) {
      matRef.current.opacity = choreo.particleOpacity;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        ref={matRef}
        map={sprite}
        size={0.085}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        color="#f5e6c4"
        opacity={0.55}
        sizeAttenuation
      />
    </points>
  );
}

// ---------------------------------------------------------------------------
// Individual 3D Anatomical Surface Pin (WebGL Path)
// ---------------------------------------------------------------------------

interface SnappedHotspot {
  id: string;
  position: [number, number, number];
  normal: [number, number, number];
  quaternion: THREE.Quaternion;
  activeWindow: [number, number];
  accentColor: string;
}

function AnatomicalPin3D({
  pin,
  currentTimeRef,
}: {
  pin: SnappedHotspot;
  currentTimeRef: React.MutableRefObject<number>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const headMatRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    const t = currentTimeRef.current;
    const [s, e] = pin.activeWindow;

    const act2Active =
      smoothstep(s - 0.35, s + 0.25, t) * (1 - smoothstep(e - 0.3, e + 0.25, t));
    const act3PinBeat =
      smoothstep(17.55, 17.8, t) * (1 - smoothstep(18.35, 18.65, t));
    const vis = Math.max(act2Active, act3PinBeat);

    if (groupRef.current) {
      groupRef.current.visible = vis > 0.02;
      const scale = mix(0.2, 1.0, vis);
      groupRef.current.scale.setScalar(scale);
    }

    if (haloRef.current) {
      const pulse = 1.0 + Math.sin(t * 5.2 + s) * 0.28;
      haloRef.current.scale.setScalar(pulse);
    }

    if (headMatRef.current) {
      headMatRef.current.emissiveIntensity = 1.15 + Math.sin(t * 6.0) * 0.35;
    }
  });

  return (
    <group ref={groupRef} position={pin.position} quaternion={pin.quaternion}>
      <mesh position={[0, 0.008, 0]}>
        <cylinderGeometry args={[0.019, 0.024, 0.012, 16]} />
        <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.25} />
      </mesh>
      <mesh position={[0, 0.048, 0]}>
        <cylinderGeometry args={[0.004, 0.004, 0.08, 10]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.092, 0]}>
        <sphereGeometry args={[0.023, 18, 18]} />
        <meshStandardMaterial
          ref={headMatRef}
          color={pin.accentColor}
          emissive={pin.accentColor}
          emissiveIntensity={1.35}
          roughness={0.18}
          metalness={0.2}
        />
      </mesh>
      <mesh ref={haloRef} position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.028, 0.042, 24]} />
        <meshBasicMaterial
          color={pin.accentColor}
          transparent
          opacity={0.78}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------------------
// Main Choreographed Scapula Scene (WebGL Path)
// ---------------------------------------------------------------------------

function ChoreographedScapulaRig({
  currentTimeRef,
  onPinsUpdate,
}: {
  currentTimeRef: React.MutableRefObject<number>;
  onPinsUpdate?: (pins: ProjectedPinState[]) => void;
}) {
  const { camera } = useThree();
  const rigGroupRef = useRef<THREE.Group>(null);
  const wireMatRef = useRef<THREE.MeshBasicMaterial>(null);

  const scapulaGeo = useMemo(() => getRightScapulaGeometry(), []);
  const { material: boneMat, texture: boneTex } = useMemo(
    () => createDryBonePBRMaterial(),
    []
  );

  useEffect(() => {
    return () => {
      boneMat.dispose();
      boneTex.dispose();
    };
  }, [boneMat, boneTex]);

  const snappedHotspots = useMemo<SnappedHotspot[]>(() => {
    const up = new THREE.Vector3(0, 1, 0);
    return SCAPULA_HOTSPOTS.map((hs) => {
      const snapped = snapPointToScapulaSurface(hs.approxPos, hs.surfaceDir);
      const nVec = new THREE.Vector3(...snapped.normal).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(up, nVec);
      return {
        id: hs.id,
        position: snapped.position,
        normal: snapped.normal,
        quaternion: quat,
        activeWindow: hs.activeWindow,
        accentColor: hs.accentColor,
      };
    });
  }, []);

  const scratchHead = useMemo(() => new THREE.Vector3(), []);
  const scratchNormal = useMemo(() => new THREE.Vector3(), []);
  const scratchCamDir = useMemo(() => new THREE.Vector3(), []);
  const scratchTarget = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const t = currentTimeRef.current;
    const c = computeScapulaChoreography(t);

    if (rigGroupRef.current) {
      rigGroupRef.current.position.set(c.posX, c.posY, 0);
      rigGroupRef.current.rotation.set(c.rotX, c.rotY, 0);
      rigGroupRef.current.scale.setScalar(c.boneScale);
      rigGroupRef.current.updateMatrixWorld();
    }

    camera.position.set(c.camX, c.camY, c.camZ);
    scratchTarget.set(c.targetX, c.targetY, c.targetZ);
    camera.lookAt(scratchTarget);
    camera.updateMatrixWorld();

    boneMat.opacity = c.boneOpacity;
    boneMat.transparent = boneMat.opacity < 0.99;

    if (wireMatRef.current) {
      wireMatRef.current.opacity = c.showWireframe ? 0.44 : 0.0;
      wireMatRef.current.visible = c.showWireframe;
    }

    if (onPinsUpdate && rigGroupRef.current) {
      const projected: ProjectedPinState[] = snappedHotspots.map((pin) => {
        const [s, e] = pin.activeWindow;
        const act2Vis =
          smoothstep(s - 0.15, s + 0.35, t) * (1 - smoothstep(e - 0.3, e + 0.15, t));
        const act3Vis =
          smoothstep(17.65, 17.85, t) * (1 - smoothstep(18.35, 18.55, t));
        const intensity = Math.max(act2Vis, act3Vis);

        if (intensity < 0.05) {
          return { id: pin.id, xPercent: 50, yPercent: 50, visible: false, intensity: 0 };
        }

        scratchHead.set(
          pin.position[0] + pin.normal[0] * 0.095,
          pin.position[1] + pin.normal[1] * 0.095,
          pin.position[2] + pin.normal[2] * 0.095
        );
        scratchHead.applyMatrix4(rigGroupRef.current!.matrixWorld);

        scratchNormal
          .set(...pin.normal)
          .transformDirection(rigGroupRef.current!.matrixWorld);
        scratchCamDir.subVectors(camera.position, scratchHead).normalize();
        const facing = scratchNormal.dot(scratchCamDir);

        scratchHead.project(camera);

        return {
          id: pin.id,
          xPercent: (scratchHead.x * 0.5 + 0.5) * 100,
          yPercent: (-scratchHead.y * 0.5 + 0.5) * 100,
          visible: facing > -0.45 && scratchHead.z < 1,
          intensity,
        };
      });
      onPinsUpdate(projected);
    }
  });

  return (
    <group ref={rigGroupRef}>
      <mesh geometry={scapulaGeo} material={boneMat} castShadow receiveShadow />
      <mesh geometry={scapulaGeo} scale={1.003}>
        <meshBasicMaterial
          ref={wireMatRef}
          color="#38bdf8"
          wireframe
          transparent
          opacity={0}
          visible={false}
          depthWrite={false}
        />
      </mesh>
      {snappedHotspots.map((pin) => (
        <AnatomicalPin3D key={pin.id} pin={pin} currentTimeRef={currentTimeRef} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------
// Software 3D Canvas Rasterizer Fallback (When WebGL is Disabled/Sandboxed)
// Projects the exact Right Scapula BufferGeometry triangles & hotspots at 60fps
// ---------------------------------------------------------------------------

function ScapulaSoftwareStage({
  currentTimeRef,
  onPinsUpdate,
}: Scapula3DStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const scapulaGeo = useMemo(() => getRightScapulaGeometry(), []);

  const snappedHotspots = useMemo(
    () =>
      SCAPULA_HOTSPOTS.map((hs) => ({
        ...hs,
        snapped: snapPointToScapulaSurface(hs.approxPos, hs.surfaceDir),
      })),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const posAttr = scapulaGeo.getAttribute('position') as THREE.BufferAttribute;
    const normAttr = scapulaGeo.getAttribute('normal') as THREE.BufferAttribute;
    const colAttr = scapulaGeo.getAttribute('color') as THREE.BufferAttribute;
    const idxAttr = scapulaGeo.getIndex()!;

    const vertCount = posAttr.count;
    const triCount = idxAttr.count / 3;
    const posArr = posAttr.array as Float32Array;
    const normArr = normAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;
    const idxArr = idxAttr.array as Uint16Array | Uint32Array;

    // Pre-allocated screen projection buffers
    const scrX = new Float32Array(vertCount);
    const scrY = new Float32Array(vertCount);
    const scrZ = new Float32Array(vertCount);
    const camSpaceX = new Float32Array(vertCount);
    const camSpaceY = new Float32Array(vertCount);
    const camSpaceZ = new Float32Array(vertCount);

    // 512 depth buckets for O(N) painter's order sorting
    const NUM_BUCKETS = 512;
    const bucketHeads = new Int32Array(NUM_BUCKETS);
    const triNext = new Int32Array(triCount);

    const cam = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 30);
    const rigMat = new THREE.Matrix4();
    const viewMat = new THREE.Matrix4();
    const mvMat = new THREE.Matrix4();
    const euler = new THREE.Euler();
    const posVec = new THREE.Vector3();
    const scaleVec = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const targetVec = new THREE.Vector3();
    const worldHead = new THREE.Vector3();
    const worldNrm = new THREE.Vector3();
    const camDir = new THREE.Vector3();

    // Key & rim directional vectors (normalized)
    const keyDir = new THREE.Vector3(0.55, 0.65, 0.52).normalize();
    const rimDir = new THREE.Vector3(-0.68, 0.34, -0.65).normalize();
    const halfVec = new THREE.Vector3(0.32, 0.36, 0.87).normalize();

    let rafId = 0;

    const renderFrame = () => {
      const parent = canvas.parentElement;
      const w = parent ? parent.clientWidth : 405;
      const h = parent ? parent.clientHeight : 720;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = Math.max(1, Math.floor(w * dpr));
      const ph = Math.max(1, Math.floor(h * dpr));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const t = currentTimeRef.current;
      const c = computeScapulaChoreography(t);

      // 1. Render subtle studio bokeh motes (organic R2 dispersion)
      if (c.particleOpacity > 0.02) {
        for (let i = 0; i < 68; i++) {
          const phase = (i % 7) * 0.45 + 0.3;
          const speed = 0.08 + ((i * 13) % 10) * 0.014;
          const bx = ((i * 0.7548776662 + 0.17) % 1) * w;
          const by = (((((i * 0.5698402910 + 0.31) % 1) - t * speed * 0.14) % 1) + 1) % 1;
          const px = bx + Math.sin(t * 0.6 + phase) * 12;
          const py = by * h;
          const r = 1.2 + (i % 4) * 0.7;
          const alpha = c.particleOpacity * (0.24 + (i % 4) * 0.15);
          const grad = ctx.createRadialGradient(px, py, 0, px, py, r * 3.0);
          grad.addColorStop(0, `rgba(248, 236, 200, ${alpha.toFixed(3)})`);
          grad.addColorStop(1, 'rgba(248, 236, 200, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(px, py, r * 3.0, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Compute ModelView & Projection
      cam.aspect = w / Math.max(1, h);
      cam.updateProjectionMatrix();
      cam.position.set(c.camX, c.camY, c.camZ);
      targetVec.set(c.targetX, c.targetY, c.targetZ);
      cam.lookAt(targetVec);
      cam.updateMatrixWorld();
      viewMat.copy(cam.matrixWorldInverse);

      euler.set(c.rotX, c.rotY, 0);
      quat.setFromEuler(euler);
      posVec.set(c.posX, c.posY, 0);
      scaleVec.setScalar(c.boneScale);
      rigMat.compose(posVec, quat, scaleVec);
      mvMat.multiplyMatrices(viewMat, rigMat);

      const m = mvMat.elements;
      const p = cam.projectionMatrix.elements;
      const halfW = w * 0.5;
      const halfH = h * 0.5;

      // Transform all vertices
      for (let i = 0; i < vertCount; i++) {
        const i3 = i * 3;
        const x = posArr[i3];
        const y = posArr[i3 + 1];
        const z = posArr[i3 + 2];

        const vx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const vy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const vz = m[2] * x + m[6] * y + m[10] * z + m[14];

        camSpaceX[i] = vx;
        camSpaceY[i] = vy;
        camSpaceZ[i] = vz;

        const clipW = -(vz);
        if (clipW > 0.05) {
          const ndcX = (p[0] * vx) / clipW;
          const ndcY = (p[5] * vy) / clipW;
          scrX[i] = (ndcX * 0.5 + 0.5) * w;
          scrY[i] = (-ndcY * 0.5 + 0.5) * h;
          scrZ[i] = vz;
        } else {
          scrX[i] = halfW;
          scrY[i] = halfH;
          scrZ[i] = -100;
        }
      }

      // 3. Bucket-sort front-facing triangles
      if (c.boneOpacity > 0.02) {
        bucketHeads.fill(-1);
        const zMin = -8.5;
        const zMax = -1.4;
        const zInvRange = (NUM_BUCKETS - 1) / (zMax - zMin);

        for (let ti = 0; ti < triCount; ti++) {
          const a = idxArr[ti * 3];
          const b = idxArr[ti * 3 + 1];
          const d = idxArr[ti * 3 + 2];

          const ax = scrX[a];
          const ay = scrY[a];
          const bx = scrX[b];
          const by = scrY[b];
          const dx = scrX[d];
          const dy = scrY[d];

          // Screen-space backface cull (negative area in Y-down screen space means CCW front-facing)
          const area2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
          if (area2 >= 0) continue;

          const avgZ = (scrZ[a] + scrZ[b] + scrZ[d]) * 0.333333;
          if (avgZ > -0.2) continue;

          const bucket = clamp(Math.floor((avgZ - zMin) * zInvRange), 0, NUM_BUCKETS - 1);
          triNext[ti] = bucketHeads[bucket];
          bucketHeads[bucket] = ti;
        }

        ctx.save();
        ctx.globalAlpha = c.boneOpacity;
        ctx.lineJoin = 'round';

        // Draw back-to-front (bucket 0 = farthest zMin, NUM_BUCKETS-1 = nearest zMax)
        for (let bIdx = 0; bIdx < NUM_BUCKETS; bIdx++) {
          let ti = bucketHeads[bIdx];
          while (ti !== -1) {
            const i0 = idxArr[ti * 3];
            const i1 = idxArr[ti * 3 + 1];
            const i2 = idxArr[ti * 3 + 2];

            // Average vertex normal transformed by rotation part of MV
            const n0 = i0 * 3;
            const n1 = i1 * 3;
            const n2 = i2 * 3;
            const lnx = (normArr[n0] + normArr[n1] + normArr[n2]) * 0.3333;
            const lny = (normArr[n0 + 1] + normArr[n1 + 1] + normArr[n2 + 1]) * 0.3333;
            const lnz = (normArr[n0 + 2] + normArr[n1 + 2] + normArr[n2 + 2]) * 0.3333;

            let vnx = m[0] * lnx + m[4] * lny + m[8] * lnz;
            let vny = m[1] * lnx + m[5] * lny + m[9] * lnz;
            let vnz = m[2] * lnx + m[6] * lny + m[10] * lnz;
            const nLen = Math.hypot(vnx, vny, vnz) || 1;
            vnx /= nLen;
            vny /= nLen;
            vnz /= nLen;

            // Baked vertex cortical color & AO
            const cr = (colArr[n0] + colArr[n1] + colArr[n2]) * 0.3333;
            const cg = (colArr[n0 + 1] + colArr[n1 + 1] + colArr[n2 + 1]) * 0.3333;
            const cb = (colArr[n0 + 2] + colArr[n1 + 2] + colArr[n2 + 2]) * 0.3333;

            // Studio Key + Cool Rim + Warm Bottom Bounce + Dry-Bone Specular
            const nDotK = Math.max(0, vnx * keyDir.x + vny * keyDir.y + vnz * keyDir.z);
            const nDotR = Math.max(0, vnx * rimDir.x + vny * rimDir.y + vnz * rimDir.z);
            const fresnel = Math.pow(clamp(1 - Math.max(0, vnz), 0, 1), 2.5);
            const spec = Math.pow(
              Math.max(0, vnx * halfVec.x + vny * halfVec.y + vnz * halfVec.z),
              26
            );

            const litR = clamp(
              cr * (0.28 + nDotK * 0.88) + nDotR * 0.14 + fresnel * 0.12 + spec * 0.36,
              0,
              1
            );
            const litG = clamp(
              cg * (0.27 + nDotK * 0.84) + nDotR * 0.25 + fresnel * 0.22 + spec * 0.33,
              0,
              1
            );
            const litB = clamp(
              cb * (0.26 + nDotK * 0.76) + nDotR * 0.38 + fresnel * 0.32 + spec * 0.26,
              0,
              1
            );

            const rByte = Math.round(litR * 255);
            const gByte = Math.round(litG * 255);
            const bByte = Math.round(litB * 255);

            ctx.beginPath();
            ctx.moveTo(scrX[i0], scrY[i0]);
            ctx.lineTo(scrX[i1], scrY[i1]);
            ctx.lineTo(scrX[i2], scrY[i2]);
            ctx.closePath();

            if (c.showWireframe) {
              ctx.fillStyle = `rgba(${rByte},${gByte},${bByte},0.45)`;
              ctx.fill();
              ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
              ctx.lineWidth = 0.6;
              ctx.stroke();
            } else {
              const fill = `rgb(${rByte},${gByte},${bByte})`;
              ctx.fillStyle = fill;
              ctx.fill();
              ctx.strokeStyle = fill;
              ctx.lineWidth = 1.05;
              ctx.stroke();
            }

            ti = triNext[ti];
          }
        }
        ctx.restore();
      }

      // 4. Project 3D Hotspot Pins + Render 3D Surface Pin Heads & Sync HUD
      if (onPinsUpdate) {
        const projected: ProjectedPinState[] = snappedHotspots.map((hs) => {
          const [s, e] = hs.activeWindow;
          const act2Vis =
            smoothstep(s - 0.15, s + 0.35, t) * (1 - smoothstep(e - 0.3, e + 0.15, t));
          const act3Vis =
            smoothstep(17.65, 17.85, t) * (1 - smoothstep(18.35, 18.55, t));
          const intensity = Math.max(act2Vis, act3Vis);

          if (intensity < 0.05) {
            return { id: hs.id, xPercent: 50, yPercent: 50, visible: false, intensity: 0 };
          }

          const { position, normal } = hs.snapped;
          const baseWorld = worldHead
            .set(position[0], position[1], position[2])
            .applyMatrix4(rigMat);
          const bx = baseWorld.x;
          const by = baseWorld.y;
          const bz = baseWorld.z;

          const headLocal = posVec.set(
            position[0] + normal[0] * 0.095,
            position[1] + normal[1] * 0.095,
            position[2] + normal[2] * 0.095
          );
          worldHead.copy(headLocal).applyMatrix4(rigMat);
          worldNrm.set(normal[0], normal[1], normal[2]).transformDirection(rigMat);
          camDir.subVectors(cam.position, worldHead).normalize();
          const facing = worldNrm.dot(camDir);

          // Project base & head to screen pixels
          const baseProj = new THREE.Vector3(bx, by, bz).project(cam);
          const headProj = worldHead.clone().project(cam);

          const bxPx = (baseProj.x * 0.5 + 0.5) * w;
          const byPx = (-baseProj.y * 0.5 + 0.5) * h;
          const hxPx = (headProj.x * 0.5 + 0.5) * w;
          const hyPx = (-headProj.y * 0.5 + 0.5) * h;
          const visible = facing > -0.45 && headProj.z < 1;

          if (visible && c.boneOpacity > 0.25) {
            ctx.save();
            ctx.globalAlpha = intensity * c.boneOpacity;
            // Pin stem
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = 1.6;
            ctx.beginPath();
            ctx.moveTo(bxPx, byPx);
            ctx.lineTo(hxPx, hyPx);
            ctx.stroke();
            // Surface collar
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(bxPx, byPx, 3.2, 0, Math.PI * 2);
            ctx.fill();
            // Glowing head
            ctx.fillStyle = hs.accentColor;
            ctx.shadowColor = hs.accentColor;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(hxPx, hyPx, 4.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          return {
            id: hs.id,
            xPercent: (headProj.x * 0.5 + 0.5) * 100,
            yPercent: (-headProj.y * 0.5 + 0.5) * 100,
            visible,
            intensity,
          };
        });

        onPinsUpdate(projected);
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [scapulaGeo, snappedHotspots, currentTimeRef, onPinsUpdate]);

  return <canvas ref={canvasRef} className="w-full h-full block" />;
}

// ---------------------------------------------------------------------------
// Exported Stage with Automatic WebGL Detection & Seamless Fallback
// ---------------------------------------------------------------------------

export function Scapula3DStage({
  currentTimeRef,
  onPinsUpdate,
}: Scapula3DStageProps) {
  const [webglMode, setWebglMode] = useState<'checking' | 'webgl' | 'software'>(
    'checking'
  );

  useEffect(() => {
    setWebglMode(checkWebGLSupport() ? 'webgl' : 'software');
  }, []);

  const softwareFallback = (
    <ScapulaSoftwareStage
      currentTimeRef={currentTimeRef}
      onPinsUpdate={onPinsUpdate}
    />
  );

  if (webglMode === 'checking') {
    return null;
  }

  if (webglMode === 'software') {
    return softwareFallback;
  }

  return (
    <WebGLErrorBoundary fallback={softwareFallback}>
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.08,
        }}
        camera={{ position: [0, 0.15, 6.2], fov: 40, near: 0.1, far: 30 }}
        className="w-full h-full block"
      >
        <fog attach="fog" args={['#05070c', 6.5, 16]} />

        <ambientLight intensity={0.28} color="#cbd5e1" />
        <directionalLight
          position={[3.4, 4.2, 4.2]}
          intensity={2.45}
          color="#fff3dc"
        />
        <directionalLight
          position={[-3.6, 1.8, -3.2]}
          intensity={2.0}
          color="#38bdf8"
        />
        <pointLight position={[-2.2, -2.6, 2.4]} intensity={1.1} color="#d4af37" />
        <pointLight position={[2.2, -1.2, -2.2]} intensity={0.85} color="#0d9488" />

        <Environment resolution={128} frames={1}>
          <Lightformer
            form="rect"
            intensity={2.2}
            color="#fff7e6"
            position={[0, 4, 2]}
            rotation={[Math.PI / 3, 0, 0]}
            scale={[6, 2, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.6}
            color="#fef3c7"
            position={[4, 1, 2]}
            rotation={[0, -Math.PI / 2.5, 0]}
            scale={[4, 5, 1]}
          />
          <Lightformer
            form="rect"
            intensity={1.9}
            color="#38bdf8"
            position={[-4, 1, -2]}
            rotation={[0, Math.PI / 2.2, 0]}
            scale={[4, 5, 1]}
          />
          <Lightformer
            form="ring"
            intensity={0.9}
            color="#d4af37"
            position={[0, -4, 1]}
            rotation={[-Math.PI / 2, 0, 0]}
            scale={[5, 5, 1]}
          />
        </Environment>

        <StudioParticles currentTimeRef={currentTimeRef} />
        <ChoreographedScapulaRig
          currentTimeRef={currentTimeRef}
          onPinsUpdate={onPinsUpdate}
        />
      </Canvas>
    </WebGLErrorBoundary>
  );
}

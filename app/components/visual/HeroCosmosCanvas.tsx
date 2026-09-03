'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import type { MotionValue } from 'motion/react';
import * as THREE from 'three';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getHeroFormationTimeline, getHeroTimeline } from '../site/hero-timeline';

export type HeroCosmosTier = 'pc' | 'tablet' | 'mobile' | 'static';

type TierConfig = {
  detail: number;
  points: number;
  coreStars: number;
  satellites: number;
  orbits: number;
  dpr: number;
  xFactor: number;
  sphereScale: number;
  yOffset: number;
};

const TIER_CONFIG: Record<HeroCosmosTier, TierConfig> = {
  pc: { detail: 5, points: 3000, coreStars: 260, satellites: 28, orbits: 7, dpr: 1.6, xFactor: 2.45, sphereScale: 1.2, yOffset: 0 },
  tablet: { detail: 4, points: 1700, coreStars: 160, satellites: 18, orbits: 6, dpr: 1.3, xFactor: 0.95, sphereScale: 0.78, yOffset: -0.04 },
  mobile: { detail: 3, points: 900, coreStars: 90, satellites: 11, orbits: 5, dpr: 1, xFactor: 0.4, sphereScale: 0.55, yOffset: -0.22 },
  static: { detail: 0, points: 180, coreStars: 0, satellites: 0, orbits: 0, dpr: 1, xFactor: 0.4, sphereScale: 0.55, yOffset: -0.1 },
};

const SATELLITE_PALETTE = [
  0xffd84a,
  0xffaa24,
  0xfff2a8,
  0xe8ff78,
  0xff7a1a,
  0xffc4df,
  0xfff7db,
] as const;

const STATIC_CRYSTAL_FACETS = [
  { points: [[-0.92, -0.08], [-0.28, -0.92], [-0.12, -0.06]], fill: 'rgba(91, 224, 255, 0.16)', stroke: 'rgba(172, 246, 255, 0.46)' },
  { points: [[-0.28, -0.92], [0.46, -0.76], [-0.12, -0.06]], fill: 'rgba(198, 116, 255, 0.13)', stroke: 'rgba(230, 192, 255, 0.42)' },
  { points: [[0.46, -0.76], [0.92, -0.08], [-0.12, -0.06]], fill: 'rgba(255, 222, 126, 0.15)', stroke: 'rgba(255, 240, 188, 0.5)' },
  { points: [[-0.92, -0.08], [-0.12, -0.06], [-0.68, 0.62]], fill: 'rgba(82, 166, 255, 0.13)', stroke: 'rgba(118, 217, 255, 0.38)' },
  { points: [[-0.12, -0.06], [0.92, -0.08], [0.54, 0.7]], fill: 'rgba(255, 151, 226, 0.12)', stroke: 'rgba(255, 196, 238, 0.4)' },
  { points: [[-0.68, 0.62], [-0.12, -0.06], [0.54, 0.7]], fill: 'rgba(104, 255, 218, 0.12)', stroke: 'rgba(180, 255, 234, 0.42)' },
] as const;

type HeroCosmosCanvasProps = {
  progress: MotionValue<number>;
  formationProgress: MotionValue<number>;
  forceStatic: boolean;
  onStaticChange: (staticMode: boolean) => void;
};

type HeroCosmosR3FProps = {
  config: TierConfig;
  progress: MotionValue<number>;
  formationProgress: MotionValue<number>;
  paused: boolean;
  onContextLost: () => void;
};

function chooseTier(width: number, reducedMotion: boolean, saveData: boolean): HeroCosmosTier {
  if (reducedMotion || saveData) return 'static';
  if (width >= 1180) return 'pc';
  if (width >= 640) return 'tablet';
  return 'mobile';
}

function probeWebgl2(): boolean {
  const canvas = document.createElement('canvas');
  // R3F/Three is deliberately restricted to WebGL2. WebGL1-only devices use
  // the deterministic 2D fallback instead of entering an unsafe detail tier.
  const context = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power' });
  const supported = Boolean(context);
  context?.getExtension('WEBGL_lose_context')?.loseContext();
  return supported;
}

function seededPoints(count: number): Float32Array {
  let seed = 131;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = 1.25 + random() * 2.1;
    const angle = random() * Math.PI * 2;
    const elevation = (random() - 0.5) * 1.6;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = Math.sin(angle) * radius * 0.78 + elevation;
    positions[index * 3 + 2] = (random() - 0.5) * 1.5;
  }
  return positions;
}

function seededCoreStars(count: number): Float32Array {
  let seed = 947;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const radius = Math.cbrt(random()) * 0.92;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[index * 3 + 1] = Math.cos(phi) * radius;
    positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  return positions;
}

function seededUnit(index: number): number {
  const value = Math.sin((index + 1) * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function satelliteScale(index: number): number {
  const base = 0.46 + seededUnit(index) * 1.08;
  return index % 11 === 0 ? base + 0.66 : base;
}

function smoothReveal(value: number): number {
  const clamped = THREE.MathUtils.clamp(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function satelliteRevealAt(reveal: number, index: number): number {
  const delay = (index % 7) * 0.045 + seededUnit(index + 191) * 0.08;
  return smoothReveal((reveal - delay) / Math.max(1 - delay, 0.001));
}

function drawStaticCosmos(context: CanvasRenderingContext2D, width: number, height: number, progress: number, points: Float32Array, dpr: number) {
  const state = getHeroTimeline(progress);
  const centerX = width * (0.5 + state.sphereX * 0.18);
  const centerY = height * (0.5 - state.sphereY * 0.14);
  const radius = Math.min(width, height) * 0.16 * state.sphereScale;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 3.2);
  glow.addColorStop(0, 'rgba(255, 214, 80, 0.2)');
  glow.addColorStop(0.18, 'rgba(126, 78, 255, 0.22)');
  glow.addColorStop(0.48, 'rgba(54, 225, 255, 0.12)');
  glow.addColorStop(1, 'rgba(5, 15, 18, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  context.save();
  context.translate(centerX, centerY);
  context.rotate(state.sphereRotationZ);
  context.globalCompositeOperation = 'lighter';
  const core = context.createRadialGradient(-radius * 0.28, -radius * 0.32, radius * 0.04, 0, 0, radius * 1.08);
  core.addColorStop(0, 'rgba(255, 246, 192, 0.88)');
  core.addColorStop(0.18, 'rgba(255, 184, 47, 0.46)');
  core.addColorStop(0.44, 'rgba(119, 62, 255, 0.46)');
  core.addColorStop(0.72, 'rgba(31, 223, 255, 0.32)');
  core.addColorStop(1, 'rgba(3, 8, 24, 0.08)');
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();

  context.save();
  context.beginPath();
  context.arc(0, 0, radius * 0.99, 0, Math.PI * 2);
  context.clip();
  STATIC_CRYSTAL_FACETS.forEach(({ points: facetPoints, fill, stroke }) => {
    context.beginPath();
    context.moveTo(facetPoints[0][0] * radius, facetPoints[0][1] * radius);
    for (let pointIndex = 1; pointIndex < facetPoints.length; pointIndex += 1) {
      context.lineTo(facetPoints[pointIndex][0] * radius, facetPoints[pointIndex][1] * radius);
    }
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = stroke;
    context.lineWidth = 0.72;
    context.stroke();
  });
  const crystalSweep = context.createLinearGradient(-radius, -radius, radius, radius);
  crystalSweep.addColorStop(0.28, 'rgba(255, 255, 255, 0)');
  crystalSweep.addColorStop(0.48, 'rgba(212, 249, 255, 0.28)');
  crystalSweep.addColorStop(0.54, 'rgba(255, 224, 142, 0.16)');
  crystalSweep.addColorStop(0.7, 'rgba(255, 255, 255, 0)');
  context.fillStyle = crystalSweep;
  context.fillRect(-radius, -radius, radius * 2, radius * 2);
  context.restore();

  context.strokeStyle = 'rgba(166, 255, 219, 0.48)';
  context.lineWidth = 1;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.stroke();
  const shellColors = ['rgba(110, 226, 255, 0.42)', 'rgba(155, 102, 255, 0.34)', 'rgba(255, 205, 73, 0.42)'];
  shellColors.forEach((color, index) => {
    context.strokeStyle = color;
    context.lineWidth = index === 2 ? 1.25 : 0.8;
    context.beginPath();
    context.ellipse(0, 0, radius * (1.1 + index * 0.16), radius * (0.28 + index * 0.13), 0.42 + state.cameraYaw + index * 0.72, 0, Math.PI * 2);
    context.stroke();
  });
  context.restore();

  context.fillStyle = 'rgba(166, 255, 219, 0.5)';
  for (let index = 0; index < points.length; index += 3) {
    const x = centerX + points[index] * radius * 0.72;
    const y = centerY + points[index + 1] * radius * 0.72;
    const alpha = 0.22 + ((index / 3) % 7) * 0.025;
    context.globalAlpha = alpha;
    context.fillRect(x, y, 1, 1);
  }
  context.globalAlpha = 1;

  context.save();
  context.globalCompositeOperation = 'lighter';
  for (let index = 0; index < 16; index += 1) {
    const angle = state.sphereRotationY + index * 2.39996;
    const orbitRadius = radius * (1.42 + (index % 4) * 0.28);
    const x = centerX + Math.cos(angle) * orbitRadius;
    const y = centerY + Math.sin(angle * 1.17) * orbitRadius * 0.48;
    const satelliteRadius = Math.max(1.5, radius * (0.018 + (index % 5) * 0.008));
    const satelliteGlow = context.createRadialGradient(x, y, 0, x, y, satelliteRadius * 3.4);
    satelliteGlow.addColorStop(0, index % 4 === 0 ? 'rgba(255, 248, 220, 0.98)' : 'rgba(255, 214, 74, 0.94)');
    satelliteGlow.addColorStop(0.3, index % 3 === 0 ? 'rgba(255, 126, 27, 0.62)' : 'rgba(255, 188, 45, 0.52)');
    satelliteGlow.addColorStop(1, 'rgba(255, 190, 45, 0)');
    context.fillStyle = satelliteGlow;
    context.beginPath();
    context.arc(x, y, satelliteRadius * 3.4, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function StaticCosmos({ progress, config }: { progress: MotionValue<number>; config: TierConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const points = useMemo(() => seededPoints(config.points), [config.points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    let frame: number | null = null;
    const draw = (value = progress.get()) => {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        frame = null;
        const dpr = Math.min(window.devicePixelRatio || 1, config.dpr);
        const width = window.innerWidth;
        const height = window.innerHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        drawStaticCosmos(context, width, height, value, points, dpr);
      });
    };
    draw();
    const unsubscribe = progress.on('change', draw);
    const resize = () => draw();
    window.addEventListener('resize', resize, { passive: true });
    return () => {
      unsubscribe();
      window.removeEventListener('resize', resize);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [config.dpr, points, progress]);

  return <canvas ref={canvasRef} className="hero-cosmos__static" aria-hidden="true" />;
}

function createOrbitGroup(orbitCount: number): THREE.Group {
  const group = new THREE.Group();
  const curves = [
    { radius: 1.42, scaleY: 0.34, rotation: 0.28, color: 0x6ee2ff, opacity: 0.46, dashed: false },
    { radius: 1.68, scaleY: 0.18, rotation: -0.5, color: 0xffd24a, opacity: 0.42, dashed: true },
    { radius: 1.9, scaleY: 0.52, rotation: 1.08, color: 0x9e72ff, opacity: 0.34, dashed: false },
    { radius: 2.14, scaleY: 0.26, rotation: 1.74, color: 0xffa82c, opacity: 0.32, dashed: true },
    { radius: 2.34, scaleY: 0.58, rotation: -1.1, color: 0x75ffd5, opacity: 0.28, dashed: false },
    { radius: 2.52, scaleY: 0.4, rotation: 0.72, color: 0xffeea8, opacity: 0.24, dashed: true },
    { radius: 2.7, scaleY: 0.2, rotation: 2.28, color: 0x51bfff, opacity: 0.2, dashed: false },
  ].slice(0, orbitCount);
  curves.forEach(({ radius, scaleY, rotation, color, opacity, dashed }) => {
    const points: THREE.Vector3[] = [];
    for (let index = 0; index <= 128; index += 1) {
      const angle = (index / 128) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * scaleY;
      points.push(new THREE.Vector3(x * Math.cos(rotation) - y * Math.sin(rotation), x * Math.sin(rotation) + y * Math.cos(rotation), Math.sin(angle * 2.5 + rotation) * 0.12));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = dashed
      ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0, dashSize: 0.09, gapSize: 0.065, blending: THREE.AdditiveBlending, depthWrite: false })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    material.userData.baseOpacity = opacity;
    const line = new THREE.Line(geometry, material);
    if (dashed) line.computeLineDistances();
    group.add(line);
  });
  return group;
}

function CosmosScene({ config, progress, formationProgress }: { config: TierConfig; progress: MotionValue<number>; formationProgress: MotionValue<number> }) {
  const rootRef = useRef<THREE.Group>(null);
  const satellitesRef = useRef<THREE.InstancedMesh>(null);
  const satelliteGlowsRef = useRef<THREE.InstancedMesh>(null);
  const goldWireRef = useRef<THREE.Mesh>(null);
  const coreStarsRef = useRef<THREE.Points>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cameraLookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const orbitGroup = useMemo(() => createOrbitGroup(config.orbits), [config.orbits]);
  const orbitGroupRef = useRef(orbitGroup);
  const crystalShellRef = useRef<THREE.Group>(null);
  // `detail` is an explicit product budget: do not silently lower the
  // requested PC/tablet/mobile geometry tier.
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, config.detail), [config.detail]);
  const crystalGeometry = useMemo(() => {
    const baseGeometry = new THREE.IcosahedronGeometry(1.012, config.detail >= 4 ? 2 : 1);
    const facetedGeometry = baseGeometry.index ? baseGeometry.toNonIndexed() : baseGeometry;
    if (facetedGeometry !== baseGeometry) baseGeometry.dispose();
    facetedGeometry.computeVertexNormals();
    return facetedGeometry;
  }, [config.detail]);
  const orbMaterial = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDissolve: { value: 0 }, uReveal: { value: 0 }, uFormation: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      uniform float uDissolve;
      uniform float uReveal;
      uniform float uFormation;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;
      float fieldNoise(vec3 p) {
        return sin(p.x * 4.2 + uTime * 0.32) * sin(p.y * 3.7 - uTime * 0.21) * sin(p.z * 5.1 + uTime * 0.16);
      }
      void main() {
        vec3 displaced = position + normal * fieldNoise(position * 1.7) * 0.055;
        float assemblyNoise = fieldNoise(position * 6.4 + vec3(uTime * 0.12));
        displaced += normal * (1.0 - uReveal) * assemblyNoise * 0.24;
        displaced += normal * uFormation * sin(position.y * 18.0 - uTime * 2.1) * 0.035;
        displaced += normal * uDissolve * fieldNoise(position * 7.0 + 2.0) * 0.22;
        vNormal = normalize(normalMatrix * normal);
        vObjectPosition = displaced;
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDissolve;
      uniform float uReveal;
      uniform float uFormation;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;
      void main() {
        vec3 p = vObjectPosition;
        vec3 viewDirection = normalize(-vViewPosition);
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 2.35);
        float cloudA = sin(p.x * 7.0 + uTime * 0.2) * sin(p.y * 5.0 - uTime * 0.13) * sin(p.z * 8.0 + uTime * 0.17);
        float cloudB = sin((p.x + p.z) * 11.0 - uTime * 0.11) * cos((p.y - p.x) * 8.0 + uTime * 0.08);
        float cloud = smoothstep(-0.52, 0.88, cloudA * 0.72 + cloudB * 0.28);
        float polarAngle = atan(p.z, p.x);
        float spiralRaw = sin(polarAngle * 5.0 + length(p.xz) * 14.0 - uTime * 0.34 + p.y * 3.0);
        float spiral = smoothstep(0.34, 0.94, spiralRaw * 0.5 + 0.5);
        float scanline = pow(0.5 + 0.5 * sin(p.y * 42.0 - uTime * 1.45 + sin(p.x * 4.0)), 18.0);
        float meridian = pow(0.5 + 0.5 * cos(polarAngle * 18.0 + uTime * 0.09), 24.0);
        float cyberGrid = max(scanline, meridian) * (0.34 + fresnel * 0.66);
        float starHash = fract(sin(dot(floor(p * 34.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float starNoise = smoothstep(0.965, 0.998, starHash);
        vec3 deepSpace = vec3(0.002, 0.006, 0.022);
        vec3 cyan = vec3(0.08, 0.74, 1.0);
        vec3 violet = vec3(0.54, 0.14, 1.0);
        vec3 magenta = vec3(0.95, 0.18, 0.72);
        vec3 gold = vec3(1.0, 0.58, 0.08);
        vec3 hotWhite = vec3(1.0, 0.94, 0.72);
        vec3 nebula = mix(cyan, violet, smoothstep(-0.55, 0.68, sin(p.y * 3.2 + p.x * 2.1)));
        nebula = mix(nebula, magenta, cloud * 0.28);
        nebula = mix(nebula, gold, spiral * (0.18 + cloud * 0.2));
        vec3 color = mix(deepSpace, nebula, min(1.0, fresnel * 0.88 + cloud * 0.34 + spiral * 0.16));
        color += mix(cyan, gold, spiral) * cyberGrid * 0.22;
        color += hotWhite * starNoise * 0.72;
        color += mix(hotWhite, gold, spiral) * uFormation * (0.08 + fresnel * 0.34);
        float alpha = (0.1 + fresnel * 0.58 + cloud * 0.22 + spiral * 0.1 + cyberGrid * 0.16 + starNoise * 0.3) * uReveal * (1.0 - uDissolve * 0.94);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  }), []);
  const coreMaterial = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDissolve: { value: 0 }, uReveal: { value: 0 }, uFormation: { value: 0 } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vObjectPosition = position;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDissolve;
      uniform float uReveal;
      uniform float uFormation;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;
      void main() {
        vec3 p = vObjectPosition;
        vec3 viewDirection = normalize(-vViewPosition);
        float center = pow(max(dot(normalize(vNormal), viewDirection), 0.0), 0.55);
        float cloud = sin(p.x * 8.0 + uTime * 0.16) * sin(p.y * 6.0 - uTime * 0.12) * cos(p.z * 9.0 + uTime * 0.1);
        cloud = smoothstep(-0.58, 0.82, cloud);
        float pulse = 0.5 + 0.5 * sin(uTime * 0.72 + length(p.xy) * 12.0);
        vec3 violet = vec3(0.38, 0.06, 0.88);
        vec3 cyan = vec3(0.02, 0.58, 0.92);
        vec3 gold = vec3(1.0, 0.46, 0.04);
        vec3 color = mix(violet, cyan, cloud);
        color = mix(color, gold, pulse * cloud * 0.28);
        color += vec3(1.0, 0.88, 0.58) * (pow(pulse, 7.0) * 0.18 + uFormation * center * 0.24);
        float alpha = (0.1 + center * 0.22 + cloud * 0.18) * uReveal * (1.0 - uDissolve * 0.96);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  }), []);
  const auraMaterial = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDissolve: { value: 0 }, uReveal: { value: 0 }, uFormation: { value: 0 } },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vObjectPosition = position;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDissolve;
      uniform float uReveal;
      uniform float uFormation;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;
      void main() {
        vec3 viewDirection = normalize(-vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), viewDirection)), 2.1);
        float wave = 0.5 + 0.5 * sin(vObjectPosition.y * 9.0 + uTime * 0.42 + vObjectPosition.x * 3.0);
        vec3 cyan = vec3(0.02, 0.72, 1.0);
        vec3 violet = vec3(0.5, 0.1, 1.0);
        vec3 gold = vec3(1.0, 0.56, 0.08);
        vec3 color = mix(cyan, violet, wave);
        color = mix(color, gold, smoothstep(0.84, 1.0, wave) * 0.34);
        color += vec3(1.0, 0.88, 0.56) * uFormation * fresnel * 0.28;
        float alpha = fresnel * (0.1 + wave * 0.12 + uFormation * 0.08) * uReveal * (1.0 - uDissolve * 0.96);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  }), []);
  const crystalMaterial = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: { uTime: { value: 0 }, uDissolve: { value: 0 }, uReveal: { value: 0 }, uFormation: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      uniform float uDissolve;
      uniform float uReveal;
      uniform float uFormation;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;
      void main() {
        float crystalPulse = sin(position.y * 7.0 + position.x * 5.0 - uTime * 0.22) * 0.008;
        float assembling = (1.0 - uReveal) * sin(position.x * 17.0 + position.z * 13.0 + uTime) * 0.14;
        vec3 displaced = position + normal * (crystalPulse + assembling + uFormation * 0.012);
        displaced += normal * uDissolve * sin(position.y * 12.0 + uTime) * 0.12;
        vNormal = normalize(normalMatrix * normal);
        vObjectPosition = displaced;
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vViewPosition = viewPosition.xyz;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDissolve;
      uniform float uReveal;
      uniform float uFormation;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;
      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDirection = normalize(-vViewPosition);
        vec3 keyLight = normalize(vec3(-0.44, 0.72, 0.58));
        vec3 rimLight = normalize(vec3(0.62, -0.2, 0.76));
        float fresnel = pow(1.0 - abs(dot(normal, viewDirection)), 1.62);
        float facetLight = pow(max(dot(normal, keyLight), 0.0), 2.0);
        float reverseFacet = pow(max(dot(normal, rimLight), 0.0), 3.0);
        float prismShift = 0.5 + 0.5 * sin(
          dot(normal, vec3(8.0, 11.0, 6.0)) +
          dot(vObjectPosition, vec3(7.0, -5.0, 9.0)) -
          uTime * 0.32
        );
        float internalRay = pow(
          0.5 + 0.5 * sin(dot(vObjectPosition, vec3(15.0, 9.0, -12.0)) - uTime * 0.55),
          15.0
        );
        float caustic = pow(
          0.5 + 0.5 * cos(vObjectPosition.y * 18.0 + normal.x * 8.0 + uTime * 0.38),
          10.0
        );
        vec3 ice = vec3(0.18, 0.86, 1.0);
        vec3 violet = vec3(0.58, 0.22, 1.0);
        vec3 rose = vec3(1.0, 0.28, 0.72);
        vec3 gold = vec3(1.0, 0.72, 0.2);
        vec3 crystalColor = mix(ice, violet, prismShift);
        crystalColor = mix(crystalColor, rose, smoothstep(0.7, 1.0, prismShift) * 0.34);
        crystalColor = mix(crystalColor, gold, reverseFacet * 0.62 + internalRay * 0.18);
        crystalColor += vec3(0.82, 0.97, 1.0) * facetLight * 0.52;
        crystalColor += mix(ice, gold, prismShift) * fresnel * (0.72 + uFormation * 0.3);
        crystalColor += vec3(1.0, 0.92, 0.72) * (internalRay * 0.26 + caustic * 0.12);
        float alpha = (
          0.045 + facetLight * 0.12 + reverseFacet * 0.08 +
          fresnel * 0.62 + internalRay * 0.12 + caustic * 0.06
        ) * uReveal * (1.0 - uDissolve * 0.96);
        gl_FragColor = vec4(crystalColor, alpha);
      }
    `,
  }), []);
  const crystalWireMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: 0xc9f7ff,
    transparent: true,
    opacity: 0,
    wireframe: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }), []);
  const wireMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x70e7ff, transparent: true, opacity: 0, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  const goldWireMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffc84a, transparent: true, opacity: 0, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  const pointData = useMemo(() => {
    const positions = seededPoints(config.points);
    const geometryPoints = new THREE.BufferGeometry();
    geometryPoints.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sizes = new Float32Array(config.points);
    const alphas = new Float32Array(config.points);
    for (let index = 0; index < config.points; index += 1) {
      sizes[index] = 0.7 + (index % 13 === 0 ? 1.6 : (index % 5) * 0.12);
      alphas[index] = 0.18 + (index % 9) * 0.055;
    }
    geometryPoints.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geometryPoints.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uDissolve: { value: 0 }, uReveal: { value: 0 }, uFormation: { value: 0 } },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        varying float vAlpha;
        varying vec3 vColor;
        uniform float uTime;
        uniform float uDissolve;
        uniform float uReveal;
        uniform float uFormation;
        void main() {
          vec3 moved = position;
          moved.x += sin(uTime * 0.18 + position.y * 4.0) * 0.04;
          moved.y += cos(uTime * 0.14 + position.x * 3.0) * 0.04;
          float scatter = 1.0 - uReveal;
          float formationAngle = scatter * (1.35 + position.y * 0.3) + uTime * scatter * 0.08;
          mat2 formationSpin = mat2(cos(formationAngle), -sin(formationAngle), sin(formationAngle), cos(formationAngle));
          moved.xy = formationSpin * moved.xy;
          moved *= 1.0 + scatter * 0.78;
          moved.z += sin(position.x * 3.4 + uTime * 0.4) * scatter * 0.24;
          moved *= 1.0 + uDissolve * 0.9;
          vAlpha = aAlpha * uReveal * (1.0 + uFormation * 0.34);
          float hue = sin(position.x * 2.4 + position.z * 4.1) * 0.5 + 0.5;
          float warm = smoothstep(0.56, 0.96, hue);
          vColor = mix(vec3(0.12, 0.74, 1.0), vec3(0.5, 0.18, 1.0), hue);
          vColor = mix(vColor, vec3(1.0, 0.56, 0.06), warm * 0.58);
          vColor = mix(vColor, vec3(1.0, 0.94, 0.72), smoothstep(0.92, 1.0, hue) * 0.52);
          vec4 viewPosition = modelViewMatrix * vec4(moved, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = aSize * (36.0 / max(1.0, -viewPosition.z));
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float radius = length(gl_PointCoord - vec2(0.5));
          float glow = smoothstep(0.5, 0.02, radius);
          gl_FragColor = vec4(vColor, glow * vAlpha);
        }
      `,
    });
    return { geometry: geometryPoints, material };
  }, [config.points]);
  const coreStarData = useMemo(() => {
    const positions = seededCoreStars(config.coreStars);
    const geometryPoints = new THREE.BufferGeometry();
    geometryPoints.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const pulses = new Float32Array(config.coreStars);
    for (let index = 0; index < config.coreStars; index += 1) pulses[index] = 0.35 + seededUnit(index + 311) * 0.65;
    geometryPoints.setAttribute('aPulse', new THREE.BufferAttribute(pulses, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uDissolve: { value: 0 }, uReveal: { value: 0 }, uFormation: { value: 0 } },
      vertexShader: `
        attribute float aPulse;
        varying float vAlpha;
        varying vec3 vColor;
        uniform float uTime;
        uniform float uDissolve;
        uniform float uReveal;
        uniform float uFormation;
        void main() {
          float flicker = 0.72 + 0.28 * sin(uTime * (0.8 + aPulse) + position.x * 19.0);
          vec3 moved = position * (1.34 - uReveal * 0.34 + uDissolve * 0.34);
          vec4 viewPosition = modelViewMatrix * vec4(moved, 1.0);
          gl_Position = projectionMatrix * viewPosition;
          gl_PointSize = (1.1 + aPulse * 2.15) * flicker * (34.0 / max(1.0, -viewPosition.z));
          vAlpha = flicker * (0.38 + aPulse * 0.46) * uReveal * (1.0 + uFormation * 0.28) * (1.0 - uDissolve * 0.96);
          vColor = mix(vec3(0.24, 0.82, 1.0), vec3(1.0, 0.78, 0.24), aPulse);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float radius = length(gl_PointCoord - vec2(0.5));
          float glow = smoothstep(0.5, 0.0, radius);
          gl_FragColor = vec4(vColor, glow * vAlpha);
        }
      `,
    });
    return { geometry: geometryPoints, material };
  }, [config.coreStars]);
  const orbMaterialRef = useRef(orbMaterial);
  const coreMaterialRef = useRef(coreMaterial);
  const auraMaterialRef = useRef(auraMaterial);
  const crystalMaterialRef = useRef(crystalMaterial);
  const crystalWireMaterialRef = useRef(crystalWireMaterial);
  const pointMaterialRef = useRef(pointData.material);
  const wireMaterialRef = useRef(wireMaterial);
  const goldWireMaterialRef = useRef(goldWireMaterial);
  const coreStarMaterialRef = useRef(coreStarData.material);
  const satelliteGeometry = useMemo(() => new THREE.SphereGeometry(0.045, 12, 10), []);
  const satelliteMaterial = useMemo(() => new THREE.MeshPhongMaterial({ color: 0xffffff, emissive: 0x3a2105, emissiveIntensity: 1.35, specular: 0xfff4ce, shininess: 92, transparent: true, opacity: 0, blending: THREE.NormalBlending, depthWrite: false, toneMapped: false }), []);
  const satelliteGlowMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), []);
  const satelliteMaterialRef = useRef(satelliteMaterial);
  const satelliteGlowMaterialRef = useRef(satelliteGlowMaterial);
  const satelliteColors = useMemo(() => Array.from({ length: config.satellites }, (_, index) => new THREE.Color(SATELLITE_PALETTE[index % SATELLITE_PALETTE.length])), [config.satellites]);

  useEffect(() => {
    const satellites = satellitesRef.current;
    const glows = satelliteGlowsRef.current;
    if (!satellites || !glows) return;
    satelliteColors.forEach((color, index) => {
      satellites.setColorAt(index, color);
      glows.setColorAt(index, color);
    });
    if (satellites.instanceColor) satellites.instanceColor.needsUpdate = true;
    if (glows.instanceColor) glows.instanceColor.needsUpdate = true;
    satelliteMaterialRef.current.needsUpdate = true;
    satelliteGlowMaterialRef.current.needsUpdate = true;
  }, [satelliteColors]);

  useEffect(() => () => {
    geometry.dispose();
    crystalGeometry.dispose();
    orbMaterial.dispose();
    coreMaterial.dispose();
    auraMaterial.dispose();
    crystalMaterial.dispose();
    crystalWireMaterial.dispose();
    wireMaterial.dispose();
    goldWireMaterial.dispose();
    pointData.geometry.dispose();
    pointData.material.dispose();
    coreStarData.geometry.dispose();
    coreStarData.material.dispose();
    satelliteGeometry.dispose();
    satelliteMaterial.dispose();
    satelliteGlowMaterial.dispose();
    orbitGroup.traverse((object) => {
      if (object instanceof THREE.Line) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }, [auraMaterial, coreMaterial, coreStarData, crystalGeometry, crystalMaterial, crystalWireMaterial, geometry, goldWireMaterial, orbMaterial, orbitGroup, pointData, satelliteGeometry, satelliteGlowMaterial, satelliteMaterial, wireMaterial]);

  useFrame(({ clock, camera }, delta) => {
    const root = rootRef.current;
    const satellites = satellitesRef.current;
    const satelliteGlows = satelliteGlowsRef.current;
    const state = getHeroTimeline(progress.get());
    const formation = getHeroFormationTimeline(formationProgress.get());
    if (!root) return;
    const time = clock.elapsedTime;
    root.visible = formation.particleReveal > 0.001 || formation.sphereReveal > 0.001;
    const targetX = state.sphereX * config.xFactor;
    const targetY = state.sphereY + config.yOffset;
    const entranceScale = 0.78 + formation.sphereReveal * 0.22 + formation.formationGlow * 0.035;
    const targetScale = state.sphereScale * config.sphereScale * entranceScale;
    root.position.x = THREE.MathUtils.damp(root.position.x, targetX, 8, delta);
    root.position.y = THREE.MathUtils.damp(root.position.y, targetY, 8, delta);
    root.position.z = THREE.MathUtils.damp(root.position.z, 0, 8, delta);
    root.rotation.x = THREE.MathUtils.damp(root.rotation.x, state.sphereRotationX + (1 - formation.sphereReveal) * 0.42, 8, delta);
    root.rotation.y = THREE.MathUtils.damp(root.rotation.y, state.sphereRotationY + (1 - formation.sphereReveal) * 1.08, 8, delta);
    root.rotation.z = THREE.MathUtils.damp(root.rotation.z, state.sphereRotationZ - (1 - formation.sphereReveal) * 0.34, 8, delta);
    const nextScale = THREE.MathUtils.damp(root.scale.x, targetScale, 8, delta);
    root.scale.setScalar(nextScale);
    orbMaterialRef.current.uniforms.uTime.value = time;
    orbMaterialRef.current.uniforms.uDissolve.value = state.dissolve;
    orbMaterialRef.current.uniforms.uReveal.value = formation.sphereReveal;
    orbMaterialRef.current.uniforms.uFormation.value = formation.formationGlow;
    coreMaterialRef.current.uniforms.uTime.value = time;
    coreMaterialRef.current.uniforms.uDissolve.value = state.dissolve;
    coreMaterialRef.current.uniforms.uReveal.value = formation.sphereReveal;
    coreMaterialRef.current.uniforms.uFormation.value = formation.formationGlow;
    auraMaterialRef.current.uniforms.uTime.value = time;
    auraMaterialRef.current.uniforms.uDissolve.value = state.dissolve;
    auraMaterialRef.current.uniforms.uReveal.value = formation.sphereReveal;
    auraMaterialRef.current.uniforms.uFormation.value = formation.formationGlow;
    crystalMaterialRef.current.uniforms.uTime.value = time;
    crystalMaterialRef.current.uniforms.uDissolve.value = state.dissolve;
    crystalMaterialRef.current.uniforms.uReveal.value = formation.sphereReveal;
    crystalMaterialRef.current.uniforms.uFormation.value = formation.formationGlow;
    pointMaterialRef.current.uniforms.uTime.value = time;
    pointMaterialRef.current.uniforms.uDissolve.value = state.dissolve;
    pointMaterialRef.current.uniforms.uReveal.value = formation.particleReveal;
    pointMaterialRef.current.uniforms.uFormation.value = formation.formationGlow;
    coreStarMaterialRef.current.uniforms.uTime.value = time;
    coreStarMaterialRef.current.uniforms.uDissolve.value = state.dissolve;
    coreStarMaterialRef.current.uniforms.uReveal.value = formation.sphereReveal;
    coreStarMaterialRef.current.uniforms.uFormation.value = formation.formationGlow;
    crystalWireMaterialRef.current.opacity = 0.22 * formation.sphereReveal * (1 - state.dissolve * 0.96);
    wireMaterialRef.current.opacity = 0.09 * formation.orbitReveal * (1 - state.dissolve * 0.94);
    goldWireMaterialRef.current.opacity = 0.05 * formation.orbitReveal * (1 - state.dissolve * 0.94);
    satelliteMaterialRef.current.opacity = 0.92 * formation.satelliteReveal * (1 - state.dissolve * 0.94);
    satelliteGlowMaterialRef.current.opacity = 0.055 * formation.satelliteReveal * (1 - state.dissolve * 0.96);
    orbitGroupRef.current.visible = formation.orbitReveal > 0.001;
    orbitGroupRef.current.scale.setScalar(0.72 + formation.orbitReveal * 0.28);
    orbitGroupRef.current.rotation.x = time * 0.035;
    orbitGroupRef.current.rotation.y = -time * 0.028;
    orbitGroupRef.current.rotation.z = time * 0.045;
    orbitGroupRef.current.traverse((object) => {
      if (object instanceof THREE.Line) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => {
          material.opacity = Number(material.userData.baseOpacity ?? 0.25) * formation.orbitReveal * (1 - state.dissolve * 0.96);
        });
      }
    });
    if (goldWireRef.current) {
      goldWireRef.current.rotation.x = time * 0.065;
      goldWireRef.current.rotation.y = -time * 0.085;
      goldWireRef.current.rotation.z = time * 0.042;
    }
    if (crystalShellRef.current) {
      crystalShellRef.current.rotation.x = time * 0.028 - state.cameraPitch * 0.12;
      crystalShellRef.current.rotation.y = -time * 0.042 + state.cameraYaw * 0.16;
      crystalShellRef.current.rotation.z = time * 0.018;
    }
    if (coreStarsRef.current) {
      coreStarsRef.current.rotation.y = time * 0.052;
      coreStarsRef.current.rotation.z = -time * 0.028;
    }
    if (satellites && satelliteGlows) {
      for (let index = 0; index < config.satellites; index += 1) {
        const localReveal = satelliteRevealAt(formation.satelliteReveal, index);
        const phase = seededUnit(index + 71) * Math.PI * 2;
        const angle = time * (0.13 + (index % 6) * 0.017) + (index / Math.max(1, config.satellites)) * Math.PI * 2 + phase;
        const targetRadius = 1.16 + (index % 6) * 0.27 + (index % 13 === 0 ? 0.22 : 0);
        const radius = targetRadius * (0.24 + localReveal * 0.76);
        const inclination = 0.3 + (index % 5) * 0.1;
        dummy.position.set(
          Math.cos(angle) * radius,
          Math.sin(angle * (1.07 + (index % 4) * 0.08) + phase) * radius * inclination,
          Math.sin(angle + phase * 0.32) * radius * (0.3 + (index % 3) * 0.09),
        );
        dummy.rotation.set(angle * 0.18, -angle * 0.24, angle * 0.12);
        const size = satelliteScale(index) * localReveal * (1 - state.dissolve * 0.38);
        dummy.scale.setScalar(size);
        dummy.updateMatrix();
        satellites.setMatrixAt(index, dummy.matrix);
        dummy.scale.setScalar(size * (1.38 + (index % 4) * 0.08));
        dummy.updateMatrix();
        satelliteGlows.setMatrixAt(index, dummy.matrix);
      }
      satellites.instanceMatrix.needsUpdate = true;
      satelliteGlows.instanceMatrix.needsUpdate = true;
    }
    const perspectiveCamera = camera as THREE.PerspectiveCamera;
    if (perspectiveCamera) {
      const yaw = state.cameraYaw;
      const cameraX = Math.sin(yaw) * 0.62;
      const cameraY = state.cameraPitch * 0.7;
      const cameraZ = 5.35 - Math.abs(yaw) * 0.2;
      perspectiveCamera.position.x = THREE.MathUtils.damp(perspectiveCamera.position.x, cameraX, 5, delta);
      perspectiveCamera.position.y = THREE.MathUtils.damp(perspectiveCamera.position.y, cameraY, 5, delta);
      perspectiveCamera.position.z = THREE.MathUtils.damp(perspectiveCamera.position.z, cameraZ, 5, delta);
      // Look toward a stable world origin so the object movement remains
      // visible. Apply roll after lookAt because lookAt overwrites Euler z.
      perspectiveCamera.lookAt(cameraLookAt);
      perspectiveCamera.rotation.z = THREE.MathUtils.damp(perspectiveCamera.rotation.z, state.cameraRoll, 5, delta);
    }
  });

  return (
    <>
      <ambientLight color={0x8d95b8} intensity={1.5} />
      <pointLight color={0xffdda0} intensity={36} distance={12} decay={2} position={[4, 3, 5]} />
      <pointLight color={0x56dfff} intensity={18} distance={11} decay={2} position={[-4, -2, 4]} />
      <group ref={rootRef} visible={false}>
        <mesh geometry={geometry} material={coreMaterial} scale={0.9} />
        <points ref={coreStarsRef} geometry={coreStarData.geometry} material={coreStarData.material} scale={0.96} />
        <mesh geometry={geometry} material={orbMaterial} />
        <group ref={crystalShellRef}>
          <mesh geometry={crystalGeometry} material={crystalMaterial} scale={1.028} />
          <mesh geometry={crystalGeometry} material={crystalWireMaterial} scale={1.036} />
        </group>
        <mesh geometry={geometry} material={auraMaterial} scale={1.105} />
        <mesh geometry={geometry} material={wireMaterial} scale={1.018} />
        <mesh ref={goldWireRef} geometry={geometry} material={goldWireMaterial} scale={1.044} />
        <primitive object={orbitGroup} />
        <points geometry={pointData.geometry} material={pointData.material} />
        {config.satellites > 0 ? <instancedMesh ref={satellitesRef} args={[satelliteGeometry, satelliteMaterial, config.satellites]} /> : null}
        {config.satellites > 0 ? <instancedMesh ref={satelliteGlowsRef} args={[satelliteGeometry, satelliteGlowMaterial, config.satellites]} /> : null}
      </group>
    </>
  );
}

function HeroCosmosR3F({ config, progress, formationProgress, paused, onContextLost }: HeroCosmosR3FProps) {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const handleContextLost = useCallback((event: Event) => {
    event.preventDefault();
    onContextLost();
  }, [onContextLost]);

  useEffect(() => () => {
    const element = rendererRef.current?.domElement;
    if (element) element.removeEventListener('webglcontextlost', handleContextLost);
  }, [handleContextLost]);

  return (
    <Canvas
      className="hero-cosmos__webgl"
      camera={{ position: [0, 0, 5.35], fov: 34, near: 0.1, far: 20 }}
      dpr={config.dpr}
      frameloop={paused ? 'never' : 'always'}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        rendererRef.current = gl;
        gl.setClearColor(0x000000, 0);
        gl.domElement.addEventListener('webglcontextlost', handleContextLost, { passive: false });
      }}
    >
      <CosmosScene key={`${config.detail}-${config.points}`} config={config} progress={progress} formationProgress={formationProgress} />
    </Canvas>
  );
}

export default function HeroCosmosCanvas({ progress, formationProgress, forceStatic, onStaticChange }: HeroCosmosCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [tier, setTier] = useState<HeroCosmosTier>('static');
  const [webglAvailable, setWebglAvailable] = useState(false);
  const [capabilityReady, setCapabilityReady] = useState(false);
  // Keep the two pause causes independent. A visibility transition must not
  // accidentally resume a canvas that is still outside the viewport.
  const [offscreen, setOffscreen] = useState(false);
  const [documentHidden, setDocumentHidden] = useState(false);
  const paused = offscreen || documentHidden;
  const handleContextLost = useCallback(() => {
    setWebglAvailable(false);
    setTier('static');
  }, []);
  const isStatic = forceStatic || tier === 'static' || !webglAvailable;
  const config = TIER_CONFIG[tier];
  const renderTier = capabilityReady ? (isStatic ? 'static' : tier) : 'pending';
  const fallbackMode = capabilityReady ? (isStatic ? 'canvas2d' : 'webgl2') : 'pending';

  useEffect(() => {
    // Do not announce the initial SSR-safe static placeholder as a fallback.
    // The parent keeps copy hidden until the real capability probe completes.
    if (capabilityReady) onStaticChange(isStatic);
  }, [capabilityReady, isStatic, onStaticChange]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void } }).connection;
    const updateTier = () => {
      const nextTier = chooseTier(window.innerWidth, forceStatic || motionQuery.matches, Boolean(connection?.saveData));
      setTier(nextTier);
      if (nextTier === 'static') {
        setWebglAvailable(false);
        setCapabilityReady(true);
        return;
      }
      const supported = probeWebgl2();
      setWebglAvailable(supported);
      if (!supported) setTier('static');
      setCapabilityReady(true);
    };
    updateTier();
    const observer = new IntersectionObserver(([entry]) => setOffscreen(!(entry?.isIntersecting ?? true)), { threshold: 0.01 });
    observer.observe(host);
    const onVisibility = () => setDocumentHidden(document.visibilityState !== 'visible');
    setDocumentHidden(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', updateTier, { passive: true });
    motionQuery.addEventListener?.('change', updateTier);
    connection?.addEventListener?.('change', updateTier);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', updateTier);
      motionQuery.removeEventListener?.('change', updateTier);
      connection?.removeEventListener?.('change', updateTier);
    };
  }, [forceStatic]);

  return (
    <div
      ref={hostRef}
      className="hero-cosmos"
      data-render-tier={renderTier}
      data-config-tier={tier}
      data-detail={isStatic ? 0 : config.detail}
      data-points={isStatic ? TIER_CONFIG.static.points : config.points}
      data-core-stars={isStatic ? 0 : config.coreStars}
      data-satellites={isStatic ? 0 : config.satellites}
      data-orbits={isStatic ? 0 : config.orbits}
      data-fallback={fallbackMode}
      data-paused={paused ? 'true' : 'false'}
      aria-hidden="true"
    >
      {!capabilityReady ? null : isStatic ? <StaticCosmos progress={progress} config={TIER_CONFIG.static} /> : <HeroCosmosR3F config={config} progress={progress} formationProgress={formationProgress} paused={paused} onContextLost={handleContextLost} />}
    </div>
  );
}

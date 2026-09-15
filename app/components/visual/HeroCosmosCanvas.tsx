'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import type { MotionValue } from 'motion/react';
import * as THREE from 'three';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getHeroFormationTimeline, getHeroTimeline } from '../site/hero-timeline';
import {
  CIRCUIT_SCAN_PERIOD_SECONDS,
  CORE_BREATH_PERIOD_SECONDS,
  getHeroCircuitReveal,
  HERO_CYBER_PALETTE,
  getHeroRingPhase,
} from './hero-cyber-config';

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
  0xffd24a,
  0xffaa24,
  0xfff2a8,
  0xe8ff78,
  0xff7a1a,
  0xffc4df,
  0xfff7db,
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

function drawStaticCircuitRing(context: CanvasRenderingContext2D, radius: number, scaleY: number, rotation: number, color: string, phase: number): void {
  context.save();
  context.rotate(rotation);
  context.scale(1, scaleY);
  context.strokeStyle = color;
  context.lineWidth = 0.9;
  for (let segment = 0; segment < 48; segment += 1) {
    if (segment % 16 < 3 || segment % 29 === 0) continue;
    const start = (segment / 48) * Math.PI * 2 + phase;
    const end = start + (Math.PI * 2 / 48) * 0.82;
    context.beginPath();
    context.arc(0, 0, radius, start, end);
    context.stroke();
  }
  context.lineWidth = 0.72;
  for (let tick = 0; tick < 12; tick += 1) {
    if (tick % 4 !== 0) continue;
    const angle = (tick / 12) * Math.PI * 2 + phase;
    context.beginPath();
    context.moveTo(Math.cos(angle) * radius * 0.9, Math.sin(angle) * radius * 0.9);
    context.lineTo(Math.cos(angle) * radius * 1.1, Math.sin(angle) * radius * 1.1);
    context.stroke();
  }
  context.restore();
}

function drawStaticCosmos(context: CanvasRenderingContext2D, width: number, height: number, progress: number, points: Float32Array, dpr: number) {
  const state = getHeroTimeline(progress);
  const centerX = width * (0.5 + state.sphereX * 0.18);
  const centerY = height * (0.5 - state.sphereY * 0.14);
  const radius = Math.min(width, height) * 0.16 * state.sphereScale;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 3.2);
  glow.addColorStop(0, 'rgba(112, 233, 255, 0.12)');
  glow.addColorStop(0.2, 'rgba(158, 114, 255, 0.14)');
  glow.addColorStop(0.52, 'rgba(34, 76, 148, 0.08)');
  glow.addColorStop(1, 'rgba(5, 8, 18, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  context.save();
  context.translate(centerX, centerY);
  context.rotate(state.sphereRotationZ);
  context.globalCompositeOperation = 'source-over';
  const core = context.createRadialGradient(-radius * 0.2, -radius * 0.26, radius * 0.04, 0, 0, radius * 1.08);
  core.addColorStop(0, 'rgba(102, 70, 185, 0.44)');
  core.addColorStop(0.22, 'rgba(30, 39, 93, 0.86)');
  core.addColorStop(0.62, 'rgba(5, 8, 18, 0.98)');
  core.addColorStop(1, 'rgba(5, 8, 18, 0.98)');
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();

  context.globalCompositeOperation = 'lighter';
  context.strokeStyle = HERO_CYBER_PALETTE.cyan;
  context.globalAlpha = 0.34;
  context.lineWidth = 1;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.stroke();
  const shellColors = [HERO_CYBER_PALETTE.cyan, HERO_CYBER_PALETTE.violet, HERO_CYBER_PALETTE.gold];
  shellColors.forEach((color, index) => {
    context.strokeStyle = color;
    context.globalAlpha = index === 2 ? 0.4 : 0.28;
    context.lineWidth = index === 2 ? 1.25 : 0.8;
    context.beginPath();
    context.ellipse(0, 0, radius * (1.1 + index * 0.16), radius * (0.28 + index * 0.13), 0.42 + state.cameraYaw + index * 0.72, 0, Math.PI * 2);
    context.stroke();
  });
  context.globalAlpha = 1;
  drawStaticCircuitRing(context, radius * 1.08, 0.3, 0.28 + state.cameraYaw, HERO_CYBER_PALETTE.cyan, 0.08);
  drawStaticCircuitRing(context, radius * 1.24, 0.2, -0.5 + state.cameraPitch, HERO_CYBER_PALETTE.violet, 0.36);
  drawStaticCircuitRing(context, radius * 1.4, 0.48, 1.06 + state.cameraRoll, HERO_CYBER_PALETTE.gold, 0.68);
  context.globalCompositeOperation = 'lighter';
  for (let node = 0; node < 9; node += 1) {
    const angle = node * 0.72 + state.sphereRotationY * 0.2;
    const nodeRadius = radius * (1.02 + (node % 3) * 0.12);
    context.fillStyle = node % 3 === 0 ? HERO_CYBER_PALETTE.violet : HERO_CYBER_PALETTE.cyan;
    context.beginPath();
    context.arc(Math.cos(angle) * nodeRadius, Math.sin(angle) * nodeRadius * 0.72, Math.max(1.25, radius * 0.015), 0, Math.PI * 2);
    context.fill();
  }
  context.globalCompositeOperation = 'source-over';
  context.restore();

  context.fillStyle = HERO_CYBER_PALETTE.cyan;
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
    { radius: 1.32, scaleY: 1, rotation: 0.28, tilt: [0.26, -0.22], color: HERO_CYBER_PALETTE.cyan, opacity: 0.82, phase: 0.08, axis: [0, 1, 0] },
    { radius: 1.5, scaleY: 1, rotation: -0.5, tilt: [-0.3, 0.18], color: HERO_CYBER_PALETTE.violet, opacity: 0.72, phase: 0.36, axis: [1, 0, 0] },
    { radius: 1.68, scaleY: 1, rotation: 1.08, tilt: [0.18, 0.34], color: HERO_CYBER_PALETTE.gold, opacity: 0.62, phase: 0.68, axis: [0, 0, 1] },
    { radius: 2.04, scaleY: 0.72, rotation: 1.74, tilt: [0.38, 0.26], color: HERO_CYBER_PALETTE.cyan, opacity: 0.2, phase: 0.17, axis: [1, 1, 0] },
    { radius: 2.28, scaleY: 0.78, rotation: -1.1, tilt: [-0.26, 0.36], color: HERO_CYBER_PALETTE.violet, opacity: 0.18, phase: 0.53, axis: [0, 1, 1] },
    { radius: 2.5, scaleY: 0.7, rotation: 0.72, tilt: [0.3, -0.32], color: HERO_CYBER_PALETTE.gold, opacity: 0.16, phase: 0.79, axis: [1, 0, 1] },
    { radius: 2.7, scaleY: 0.64, rotation: 2.28, tilt: [-0.22, 0.28], color: HERO_CYBER_PALETTE.cyan, opacity: 0.13, phase: 0.91, axis: [1, 1, 1] },
  ].slice(0, orbitCount);
  curves.forEach(({ radius, scaleY, rotation, tilt, color, opacity, phase, axis }, ringIndex) => {
    const positions: number[] = [];
    const tracks: number[] = [];
    const kinds: number[] = [];
    const strokeOffsets = ringIndex < 3 ? [-0.006, 0, 0.006] : [0];
    const addSegment = (start: THREE.Vector3, end: THREE.Vector3, track: number, kind: number) => {
      strokeOffsets.forEach((offset) => {
        const strokeStart = start.clone().multiplyScalar(1 + offset);
        const strokeEnd = end.clone().multiplyScalar(1 + offset);
        positions.push(strokeStart.x, strokeStart.y, strokeStart.z, strokeEnd.x, strokeEnd.y, strokeEnd.z);
        tracks.push(track, track);
        kinds.push(kind, kind);
      });
    };
    const segments = ringIndex < 3 ? 72 : 48;
    for (let index = 0; index < segments; index += 1) {
      // The three hero rings have visible breaks so their front/back order is
      // readable. The remaining budget is reserved for quieter support arcs.
      if (index % (ringIndex < 3 ? 18 : 21) < (ringIndex < 3 ? 3 : 5)) continue;
      const startAngle = (index / segments) * Math.PI * 2 + phase;
      const endAngle = startAngle + (Math.PI * 2 / segments) * 0.82;
      const start = new THREE.Vector3(Math.cos(startAngle) * radius, Math.sin(startAngle) * radius * scaleY, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), rotation);
      const end = new THREE.Vector3(Math.cos(endAngle) * radius, Math.sin(endAngle) * radius * scaleY, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), rotation);
      addSegment(start, end, index / segments, 0);
    }
    if (ringIndex < 3) {
      for (let tick = 0; tick < segments; tick += 9) {
        if (tick % 18 < 3) continue;
        const angle = (tick / segments) * Math.PI * 2 + phase;
        const inner = new THREE.Vector3(Math.cos(angle) * radius * 0.89, Math.sin(angle) * radius * scaleY * 0.89, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), rotation);
        const outer = new THREE.Vector3(Math.cos(angle) * radius * 1.1, Math.sin(angle) * radius * scaleY * 1.1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), rotation);
        addSegment(inner, outer, tick / segments, 1);
      }
      [0.22, 1.46, 2.76, 4.05, 5.22].forEach((angle, branchIndex) => {
        const inner = new THREE.Vector3(Math.cos(angle + phase) * radius * (0.36 + (branchIndex % 3) * 0.08), Math.sin(angle + phase) * radius * scaleY * 0.36, 0.03 * (branchIndex % 2 === 0 ? 1 : -1)).applyAxisAngle(new THREE.Vector3(0, 0, 1), rotation);
        const outer = new THREE.Vector3(Math.cos(angle + phase) * radius, Math.sin(angle + phase) * radius * scaleY, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), rotation);
        addSegment(inner, outer, (branchIndex + 0.5) / 5, 2);
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aTrack', new THREE.Float32BufferAttribute(tracks, 1));
    geometry.setAttribute('aKind', new THREE.Float32BufferAttribute(kinds, 1));
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
        uScanPeriod: { value: CIRCUIT_SCAN_PERIOD_SECONDS },
        uReveal: { value: 0 },
        uDissolve: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uBaseOpacity: { value: opacity },
      },
      vertexShader: [
        'attribute float aTrack;',
        'attribute float aKind;',
        'varying float vTrack;',
        'varying float vKind;',
        'void main() {',
        '  vTrack = aTrack;',
        '  vKind = aKind;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform float uTime;',
        'uniform float uScanPeriod;',
        'uniform float uReveal;',
        'uniform float uDissolve;',
        'uniform vec3 uColor;',
        'uniform float uBaseOpacity;',
        'varying float vTrack;',
        'varying float vKind;',
        'void main() {',
        '  float scanPosition = fract(uTime / uScanPeriod);',
        '  float scanDistance = abs(scanPosition - vTrack);',
        '  scanDistance = min(scanDistance, 1.0 - scanDistance);',
        '  float scan = 1.0 - smoothstep(0.0, 0.16, scanDistance);',
        '  vec3 color = mix(uColor, vec3(1.0, 0.8235, 0.2902), step(0.5, vKind) * 0.24);',
        '  float alpha = uBaseOpacity * (0.7 + scan * 1.4) * uReveal * (1.0 - uDissolve * 0.95);',
        '  gl_FragColor = vec4(color, alpha);',
        '}',
      ].join('\n'),
    });
    material.userData.baseOpacity = opacity;
    const line = new THREE.LineSegments(geometry, material);
    line.userData.ringIndex = ringIndex;
    line.userData.isHeroRing = ringIndex < 3;
    line.renderOrder = 3;
    line.userData.baseQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt[0], tilt[1], rotation));
    line.userData.spinAxis = new THREE.Vector3(axis[0], axis[1], axis[2]).normalize();
    group.add(line);
  });
  return group;
}

function CosmosScene({ config, progress, formationProgress }: { config: TierConfig; progress: MotionValue<number>; formationProgress: MotionValue<number> }) {
  const rootRef = useRef<THREE.Group>(null);
  const satellitesRef = useRef<THREE.InstancedMesh>(null);
  const satelliteGlowsRef = useRef<THREE.InstancedMesh>(null);
  const coreStarsRef = useRef<THREE.Points>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cameraLookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const animationTimeRef = useRef(0);
  const ringSpinQuaternion = useMemo(() => new THREE.Quaternion(), []);
  const orbitGroup = useMemo(() => createOrbitGroup(config.orbits), [config.orbits]);
  const orbitGroupRef = useRef(orbitGroup);
  const shellRef = useRef<THREE.Group>(null);
  // `detail` is an explicit product budget: do not silently lower the
  // requested PC/tablet/mobile geometry tier.
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, config.detail), [config.detail]);
  // The semi-transparent skin deliberately reuses the core geometry so the
  // replacement does not add another high-resolution surface mesh.
  const shellGeometry = geometry;
  const coreMaterial = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: true,
    blending: THREE.NormalBlending,
    uniforms: {
      uTime: { value: 0 },
      uDissolve: { value: 0 },
      uReveal: { value: 0 },
      uFormation: { value: 0 },
      uBreathPeriod: { value: CORE_BREATH_PERIOD_SECONDS },
      uDark: { value: new THREE.Color(HERO_CYBER_PALETTE.dark) },
      uCyan: { value: new THREE.Color(HERO_CYBER_PALETTE.cyan) },
      uViolet: { value: new THREE.Color(HERO_CYBER_PALETTE.violet) },
    },
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
      uniform float uBreathPeriod;
      uniform vec3 uDark;
      uniform vec3 uCyan;
      uniform vec3 uViolet;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;
      void main() {
        vec3 p = vObjectPosition;
        vec3 viewDirection = normalize(-vViewPosition);
        float center = pow(max(dot(normalize(vNormal), viewDirection), 0.0), 0.55);
        float cloud = sin(p.x * 8.0 + uTime * 0.16) * sin(p.y * 6.0 - uTime * 0.12) * cos(p.z * 9.0 + uTime * 0.1);
        cloud = smoothstep(-0.58, 0.82, cloud);
        float pulse = 0.5 + 0.5 * sin(uTime * 6.2831853 / uBreathPeriod + length(p.xy) * 12.0);
        float vortex = smoothstep(0.28, 0.92, 0.5 + 0.5 * sin(atan(p.z, p.x) * 5.0 + length(p.xz) * 15.0 - uTime * 0.22 + p.y * 3.0));
        vec3 color = mix(uDark, mix(uViolet, uCyan, vortex), 0.08 + cloud * 0.1 + pulse * 0.07 + center * 0.05);
        color += mix(uViolet, uCyan, pulse) * vortex * 0.16;
        float alpha = (0.96 + center * 0.04) * uReveal * (1.0 - uDissolve * 0.96);
        if (uReveal < 0.001) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
  }), []);
  const shellMaterial = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uDissolve: { value: 0 },
      uReveal: { value: 0 },
      uFormation: { value: 0 },
      uScanPeriod: { value: CIRCUIT_SCAN_PERIOD_SECONDS },
      uCircuitDensity: { value: config.detail >= 5 ? 1 : config.detail >= 4 ? 0.82 : 0.62 },
      uCyan: { value: new THREE.Color(HERO_CYBER_PALETTE.cyan) },
      uViolet: { value: new THREE.Color(HERO_CYBER_PALETTE.violet) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uDissolve;
      uniform float uReveal;
      uniform float uFormation;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;
      void main() {
        float shellPulse = sin(position.y * 7.0 + position.x * 5.0 - uTime * 0.22) * 0.008;
        float assembling = (1.0 - uReveal) * sin(position.x * 17.0 + position.z * 13.0 + uTime) * 0.14;
        vec3 displaced = position + normal * (shellPulse + assembling + uFormation * 0.012);
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
      uniform float uScanPeriod;
      uniform float uCircuitDensity;
      uniform vec3 uCyan;
      uniform vec3 uViolet;
      varying vec3 vNormal;
      varying vec3 vViewPosition;
      varying vec3 vObjectPosition;

      float hash21(vec2 value) {
        value = fract(value * vec2(123.34, 456.21));
        value += dot(value, value + 45.32);
        return fract(value.x * value.y);
      }

      float segmentDistance(vec2 point, vec2 startPoint, vec2 endPoint) {
        vec2 along = endPoint - startPoint;
        float amount = clamp(dot(point - startPoint, along) / max(dot(along, along), 0.0001), 0.0, 1.0);
        return length(point - (startPoint + along * amount));
      }

      void main() {
        vec3 normal = normalize(vNormal);
        vec3 viewDirection = normalize(-vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normal, viewDirection)), 2.2);
        vec3 spherePosition = normalize(vObjectPosition);
        float longitude = atan(spherePosition.z, spherePosition.x);
        float latitude = asin(clamp(spherePosition.y, -1.0, 1.0));
        float columns = mix(13.0, 22.0, uCircuitDensity);
        float rows = mix(8.0, 14.0, uCircuitDensity);
        vec2 gridPosition = vec2(
          (longitude / 6.2831853 + 0.5) * columns,
          (latitude / 3.1415926 + 0.5) * rows
        );
        vec2 cell = floor(gridPosition);
        vec2 local = fract(gridPosition);
        float cellSeed = hash21(cell);
        float activeCell = step(0.38, cellSeed);
        float style = fract(cellSeed * 7.17);
        float routeDistance = 10.0;
        vec2 junctionPosition = vec2(0.5);
        vec2 terminalPosition = vec2(0.5);
        if (style < 0.28) {
          routeDistance = min(
            segmentDistance(local, vec2(0.04, 0.3), vec2(0.56, 0.3)),
            segmentDistance(local, vec2(0.56, 0.3), vec2(0.56, 0.9))
          );
          junctionPosition = vec2(0.56, 0.3);
          terminalPosition = vec2(0.56, 0.9);
        } else if (style < 0.56) {
          routeDistance = min(
            segmentDistance(local, vec2(0.44, 0.08), vec2(0.44, 0.58)),
            segmentDistance(local, vec2(0.44, 0.58), vec2(0.95, 0.58))
          );
          junctionPosition = vec2(0.44, 0.58);
          terminalPosition = vec2(0.95, 0.58);
        } else if (style < 0.78) {
          routeDistance = segmentDistance(local, vec2(0.06, 0.84), vec2(0.84, 0.16));
          junctionPosition = vec2(0.84, 0.16);
          terminalPosition = vec2(0.06, 0.84);
        } else {
          routeDistance = min(
            segmentDistance(local, vec2(0.08, 0.48), vec2(0.5, 0.48)),
            segmentDistance(local, vec2(0.5, 0.48), vec2(0.5, 0.92))
          );
          junctionPosition = vec2(0.5, 0.48);
          terminalPosition = vec2(0.5, 0.92);
        }
        float routeEdge = max(fwidth(routeDistance), 0.0012);
        float localTrace = activeCell * (1.0 - smoothstep(max(0.0, 0.018 - routeEdge), 0.018 + routeEdge, routeDistance));
        float localHalo = activeCell * (1.0 - smoothstep(max(0.0, 0.052 - routeEdge * 1.5), 0.052 + routeEdge * 1.5, routeDistance));
        float trunkRow = 1.0 - step(0.14, abs(fract(cell.y / 5.0) - 0.2));
        float trunkColumn = 1.0 - step(0.14, abs(fract(cell.x / 7.0) - 0.28));
        float horizontalDistance = abs(local.y - 0.5);
        float verticalDistance = abs(local.x - 0.5);
        float horizontalEdge = max(fwidth(horizontalDistance), 0.0012);
        float verticalEdge = max(fwidth(verticalDistance), 0.0012);
        float horizontalTrunk = trunkRow * (1.0 - smoothstep(max(0.0, 0.016 - horizontalEdge), 0.016 + horizontalEdge, horizontalDistance));
        float verticalTrunk = trunkColumn * (1.0 - smoothstep(max(0.0, 0.016 - verticalEdge), 0.016 + verticalEdge, verticalDistance));
        float trunkTrace = max(horizontalTrunk, verticalTrunk);
        float trace = max(localTrace, trunkTrace);
        float traceHalo = max(localHalo * (1.0 - localTrace) * 0.28, trunkTrace * 0.22);
        float junctionDistance = length(local - junctionPosition);
        float junction = activeCell * step(0.46, fract(cellSeed * 11.73));
        float junctionEdge = max(fwidth(junctionDistance), 0.0012);
        junction *= 1.0 - smoothstep(max(0.0, 0.034 - junctionEdge), 0.034 + junctionEdge, junctionDistance);
        float terminalDistance = length(local - terminalPosition);
        float terminal = activeCell * step(0.64, fract(cellSeed * 5.37));
        float terminalEdge = max(fwidth(terminalDistance), 0.0012);
        terminal *= 1.0 - smoothstep(max(0.0, 0.032 - terminalEdge), 0.032 + terminalEdge, terminalDistance);
        float trunkNodeDistance = length(local - vec2(0.5));
        float trunkNode = step(0.55, trunkRow + trunkColumn) * (1.0 - smoothstep(0.0, 0.04, trunkNodeDistance));
        float scanPosition = fract(uTime / uScanPeriod);
        float scanCoordinate = fract((gridPosition.x / max(columns, 1.0)) * 0.86 + (gridPosition.y / max(rows, 1.0)) * 0.24);
        float scanDistance = abs(scanCoordinate - scanPosition);
        scanDistance = min(scanDistance, 1.0 - scanDistance);
        float scan = (1.0 - smoothstep(0.0, 0.095, scanDistance)) * trace;
        vec3 traceColor = mix(uCyan, uViolet, 0.2 + 0.35 * fract(cellSeed * 2.1 + latitude * 0.38));
        vec3 shellColor = uCyan * (trace * 0.92 + junction * 0.66 + scan * 1.18 + trunkNode * 0.42);
        shellColor += traceColor * traceHalo;
        shellColor += uViolet * terminal * 0.82;
        shellColor += uViolet * fresnel * 0.012;
        float alpha = (
          fresnel * 0.008 + traceHalo * 0.04 + trace * 0.34 + junction * 0.26 + terminal * 0.3 + scan * 0.52
        ) * uReveal * (1.0 - uDissolve * 0.96);
        if (uReveal < 0.001) discard;
        gl_FragColor = vec4(shellColor, alpha);
      }
    `,
  }), [config.detail]);
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
          vColor = mix(vec3(0.4392, 0.9137, 1.0), vec3(0.6196, 0.4471, 1.0), hue);
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
          float glow = 1.0 - smoothstep(0.02, 0.5, radius);
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
      depthTest: false,
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
          vAlpha = flicker * (0.14 + aPulse * 0.22) * uReveal * (1.0 + uFormation * 0.28) * (1.0 - uDissolve * 0.96);
          vColor = mix(vec3(0.4392, 0.9137, 1.0), vec3(0.6196, 0.4471, 1.0), aPulse);
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        varying vec3 vColor;
        void main() {
          float radius = length(gl_PointCoord - vec2(0.5));
          float glow = 1.0 - smoothstep(0.0, 0.5, radius);
          gl_FragColor = vec4(vColor, glow * vAlpha);
        }
      `,
    });
    return { geometry: geometryPoints, material };
  }, [config.coreStars]);
  const coreMaterialRef = useRef(coreMaterial);
  const shellMaterialRef = useRef(shellMaterial);
  const pointMaterialRef = useRef(pointData.material);
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
    coreMaterial.dispose();
    shellMaterial.dispose();
    pointData.geometry.dispose();
    pointData.material.dispose();
    coreStarData.geometry.dispose();
    coreStarData.material.dispose();
    satelliteGeometry.dispose();
    satelliteMaterial.dispose();
    satelliteGlowMaterial.dispose();
    orbitGroup.traverse((object) => {
      if (object instanceof THREE.Line || object instanceof THREE.LineSegments) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
  }, [coreMaterial, coreStarData, geometry, orbitGroup, pointData, satelliteGeometry, satelliteGlowMaterial, satelliteMaterial, shellMaterial]);

  useFrame(({ camera }, delta) => {
    const root = rootRef.current;
    const satellites = satellitesRef.current;
    const satelliteGlows = satelliteGlowsRef.current;
    const state = getHeroTimeline(progress.get());
    const formation = getHeroFormationTimeline(formationProgress.get());
    if (!root) return;
    // R3F clocks can advance while a tab is hidden. Bounded accumulation
    // preserves phase continuity on resume instead of jumping the rings.
    const safeDelta = Math.min(Math.max(delta, 0), 0.05);
    animationTimeRef.current += safeDelta;
    const time = animationTimeRef.current;
    root.visible = formation.particleReveal > 0.001 || formation.sphereReveal > 0.001;
    const targetX = state.sphereX * config.xFactor;
    const targetY = state.sphereY + config.yOffset;
    const entranceScale = 0.78 + formation.sphereReveal * 0.22 + formation.formationGlow * 0.035;
    const targetScale = state.sphereScale * config.sphereScale * entranceScale;
    root.position.x = THREE.MathUtils.damp(root.position.x, targetX, 8, safeDelta);
    root.position.y = THREE.MathUtils.damp(root.position.y, targetY, 8, safeDelta);
    root.position.z = THREE.MathUtils.damp(root.position.z, 0, 8, safeDelta);
    root.rotation.x = THREE.MathUtils.damp(root.rotation.x, state.sphereRotationX + (1 - formation.sphereReveal) * 0.42, 8, safeDelta);
    root.rotation.y = THREE.MathUtils.damp(root.rotation.y, state.sphereRotationY + (1 - formation.sphereReveal) * 1.08, 8, safeDelta);
    root.rotation.z = THREE.MathUtils.damp(root.rotation.z, state.sphereRotationZ - (1 - formation.sphereReveal) * 0.34, 8, safeDelta);
    const nextScale = THREE.MathUtils.damp(root.scale.x, targetScale, 8, safeDelta);
    root.scale.setScalar(nextScale);
    coreMaterialRef.current.uniforms.uTime.value = time;
    coreMaterialRef.current.uniforms.uDissolve.value = state.dissolve;
    coreMaterialRef.current.uniforms.uReveal.value = formation.sphereReveal;
    coreMaterialRef.current.uniforms.uFormation.value = formation.formationGlow;
    shellMaterialRef.current.uniforms.uTime.value = time;
    shellMaterialRef.current.uniforms.uDissolve.value = state.dissolve;
    shellMaterialRef.current.uniforms.uReveal.value = getHeroCircuitReveal(formation.sphereReveal);
    shellMaterialRef.current.uniforms.uFormation.value = formation.formationGlow;
    pointMaterialRef.current.uniforms.uTime.value = time;
    pointMaterialRef.current.uniforms.uDissolve.value = state.dissolve;
    pointMaterialRef.current.uniforms.uReveal.value = formation.particleReveal;
    pointMaterialRef.current.uniforms.uFormation.value = formation.formationGlow;
    coreStarMaterialRef.current.uniforms.uTime.value = time;
    coreStarMaterialRef.current.uniforms.uDissolve.value = state.dissolve;
    coreStarMaterialRef.current.uniforms.uReveal.value = formation.sphereReveal;
    coreStarMaterialRef.current.uniforms.uFormation.value = formation.formationGlow;
    satelliteMaterialRef.current.opacity = 0.92 * formation.satelliteReveal * (1 - state.dissolve * 0.94);
    satelliteGlowMaterialRef.current.opacity = 0.055 * formation.satelliteReveal * (1 - state.dissolve * 0.96);
    orbitGroupRef.current.visible = formation.orbitReveal > 0.001;
    orbitGroupRef.current.scale.setScalar(0.72 + formation.orbitReveal * 0.28);
    orbitGroupRef.current.children.forEach((object, index) => {
      const angle = getHeroRingPhase(time, index, 110 + index * 12);
      const baseQuaternion = object.userData.baseQuaternion as THREE.Quaternion | undefined;
      const spinAxis = object.userData.spinAxis as THREE.Vector3 | undefined;
      if (baseQuaternion && spinAxis) {
        ringSpinQuaternion.setFromAxisAngle(spinAxis, angle);
        object.quaternion.copy(baseQuaternion).multiply(ringSpinQuaternion);
      }
    });
    orbitGroupRef.current.traverse((object) => {
      if (object instanceof THREE.LineSegments) {
        const material = object.material as THREE.ShaderMaterial;
        material.uniforms.uTime.value = time;
        material.uniforms.uReveal.value = formation.orbitReveal;
        material.uniforms.uDissolve.value = state.dissolve;
      }
    });
    if (shellRef.current) {
      shellRef.current.rotation.x = time * 0.028 - state.cameraPitch * 0.12;
      shellRef.current.rotation.y = -time * 0.042 + state.cameraYaw * 0.16;
      shellRef.current.rotation.z = time * 0.018;
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
      perspectiveCamera.position.x = THREE.MathUtils.damp(perspectiveCamera.position.x, cameraX, 5, safeDelta);
      perspectiveCamera.position.y = THREE.MathUtils.damp(perspectiveCamera.position.y, cameraY, 5, safeDelta);
      perspectiveCamera.position.z = THREE.MathUtils.damp(perspectiveCamera.position.z, cameraZ, 5, safeDelta);
      // Look toward a stable world origin so the object movement remains
      // visible. Apply roll after lookAt because lookAt overwrites Euler z.
      perspectiveCamera.lookAt(cameraLookAt);
      perspectiveCamera.rotation.z = THREE.MathUtils.damp(perspectiveCamera.rotation.z, state.cameraRoll, 5, safeDelta);
    }
  });

  return (
    <>
      <ambientLight color={0x8d95b8} intensity={1.5} />
      <pointLight color={0xffdda0} intensity={36} distance={12} decay={2} position={[4, 3, 5]} />
      <pointLight color={0x56dfff} intensity={18} distance={11} decay={2} position={[-4, -2, 4]} />
      <group ref={rootRef} visible={false}>
        <mesh geometry={geometry} material={coreMaterial} scale={0.9} renderOrder={1} />
        <points ref={coreStarsRef} geometry={coreStarData.geometry} material={coreStarData.material} scale={0.96} renderOrder={1.5} />
        <group ref={shellRef}>
          <mesh geometry={shellGeometry} material={shellMaterial} scale={1.028} renderOrder={2} />
        </group>
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

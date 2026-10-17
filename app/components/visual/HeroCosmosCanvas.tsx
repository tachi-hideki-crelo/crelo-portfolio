'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import type { MotionValue } from 'motion/react';
import * as THREE from 'three';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { getHeroFormationTimeline, getHeroTimeline } from '../site/hero-timeline';
import {
  FIELD_AMPLITUDE,
  FIELD_ORDER_STAGGER,
  FIELD_ORDER_WINDOW,
  FIELD_SPAN_X,
  FIELD_SPAN_Z,
  FIELD_TERRACE_STEP,
  FIELD_TIERS,
  type FieldGridConfig,
  fieldCellSeed,
  fieldGridCoordinate,
  fieldScanAt,
  fieldViewFor,
  type FieldTierConfig,
  HERO_FIELD_PALETTE,
  type HeroFieldTier,
  STATIC_FIELD_GRID,
} from './hero-field';
import { drawFieldAnnotations, drawStaticField, type StaticCopyBounds } from './hero-field-draw';

export type HeroCosmosTier = HeroFieldTier;

type HeroCosmosCanvasProps = {
  progress: MotionValue<number>;
  formationProgress: MotionValue<number>;
  forceStatic: boolean;
  onStaticChange: (staticMode: boolean) => void;
};

type HeroCosmosR3FProps = {
  config: FieldTierConfig;
  progress: MotionValue<number>;
  formationProgress: MotionValue<number>;
  paused: boolean;
  onContextLost: () => void;
};

function chooseTier(width: number, reducedMotion: boolean, saveData: boolean): HeroCosmosTier {
  if (reducedMotion || saveData) return 'static';
  if (width >= 1180) return 'pc';
  // Match the CSS breakpoint where the Hero copy switches to its phone layout.
  if (width > 720) return 'tablet';
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

function readMonoFont(): string {
  // next/font defines --font-geist-mono on <body>, so the :root --font-mono
  // token that references it does not resolve. Read the body's own values.
  const styles = getComputedStyle(document.body);
  return styles.getPropertyValue('--font-mono').trim() || styles.getPropertyValue('--font-geist-mono').trim() || 'monospace';
}

function glsl(value: number): string {
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

function readStaticCopyBounds(canvas: HTMLCanvasElement): StaticCopyBounds | null {
  const hero = canvas.closest('.hero-story');
  const statement = hero?.querySelector('.hero-story__statement');
  const cta = hero?.querySelector('.hero-story__cta');
  if (!statement || !cta) return null;
  const origin = canvas.getBoundingClientRect();
  const statementRect = statement.getBoundingClientRect();
  const ctaRect = cta.getBoundingClientRect();
  return {
    statementBottom: statementRect.bottom - origin.top,
    ctaTop: ctaRect.top - origin.top,
    ctaRight: ctaRect.right - origin.left,
  };
}

function StaticCosmos({ config }: { config: FieldGridConfig }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const fontFamily = readMonoFont();
    let frame: number | null = null;
    let disposed = false;
    // The condensed Hero does not scroll, so the poster frame only needs to
    // follow the viewport size and late font metrics.
    const draw = () => {
      if (disposed) return;
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
        // Place the field from where the condensed copy actually sits, so CSS
        // breakpoints and font metrics cannot push it under the text.
        drawStaticField(context, width, height, dpr, fontFamily, readStaticCopyBounds(canvas), config);
      });
    };
    draw();
    void document.fonts?.ready.then(draw);
    window.addEventListener('resize', draw, { passive: true });
    return () => {
      disposed = true;
      window.removeEventListener('resize', draw);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [config]);

  return <canvas ref={canvasRef} className="hero-cosmos__static" aria-hidden="true" />;
}

function createFieldGeometry(columns: number, rows: number): THREE.BufferGeometry {
  const positions = new Float32Array(columns * rows * 3);
  const seeds = new Float32Array(columns * rows);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = row * columns + column;
      // The vertex shader reads the grid coordinate from position.xz and
      // computes height and projection itself.
      positions[index * 3] = fieldGridCoordinate(column, columns);
      positions[index * 3 + 2] = fieldGridCoordinate(row, rows);
      seeds[index] = fieldCellSeed(column, row);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  return geometry;
}

// Mirrors fieldSurfaceHeight, fieldPointHeight and projectFieldPoint in
// hero-field.ts so the Canvas2D annotations land exactly on the points.
const FIELD_VERTEX_SHADER = `
  attribute float aSeed;
  uniform float uTime;
  uniform float uOrder;
  uniform float uDissolve;
  uniform float uRowReveal;
  uniform float uLight;
  uniform float uScan;
  uniform float uDpr;
  uniform vec2 uResolution;
  uniform vec4 uView;
  uniform vec3 uCamera;
  varying float vAlpha;
  varying float vMint;

  float expoOut(float value) {
    float t = clamp(value, 0.0, 1.0);
    return t >= 1.0 ? 1.0 : 1.0 - pow(2.0, -10.0 * t);
  }

  float surface(float x, float z, float t) {
    return sin(x * 3.1 + t * 0.15) * 0.5 + sin(z * 4.3 - t * 0.11 + x * 1.7) * 0.35 + sin((x + z) * 7.2 + t * 0.2) * 0.15;
  }

  void main() {
    float x = position.x;
    float z = position.z;
    float local = uOrder >= 1.0 ? 1.0 : expoOut((uOrder - (x + 1.0) * 0.5 * ${glsl(FIELD_ORDER_STAGGER)}) / ${glsl(FIELD_ORDER_WINDOW)});
    float raw = surface(x, z, uTime) * ${glsl(FIELD_AMPLITUDE)} * (1.0 - uDissolve * 0.5);
    float terrace = floor(raw / ${glsl(FIELD_TERRACE_STEP)} + 0.5) * ${glsl(FIELD_TERRACE_STEP)};
    float y = mix(raw, terrace, clamp(local * 2.0, 0.0, 1.0)) * (1.0 - local) - uDissolve * (0.4 + aSeed * 0.8);

    float worldX = x * ${glsl(FIELD_SPAN_X)};
    float worldZ = z * ${glsl(FIELD_SPAN_Z)};
    float cosYaw = cos(uCamera.y);
    float sinYaw = sin(uCamera.y);
    float x1 = worldX * cosYaw - worldZ * sinYaw;
    float z1 = worldX * sinYaw + worldZ * cosYaw;
    float cosPitch = cos(uCamera.x);
    float sinPitch = sin(uCamera.x);
    float y2 = y * cosPitch + z1 * sinPitch;
    float depth = z1 * cosPitch - y * sinPitch + uCamera.z;
    if (depth < 0.1) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      vMint = 0.0;
      return;
    }
    float focal = uView.x / depth;
    vec2 screen = vec2(uResolution.x * (0.5 + uView.y) + x1 * focal, uResolution.y * uView.z - y2 * focal);
    gl_Position = vec4(screen.x / uResolution.x * 2.0 - 1.0, 1.0 - screen.y / uResolution.y * 2.0, 0.0, 1.0);

    float depthFade = clamp(1.4 - depth * 0.3, 0.0, 1.0);
    float scan = max(0.0, 1.0 - abs(x - uScan) / 0.12) * (1.0 - local);
    // Far rows (z = 1) are laid in first, so the field arrives from the horizon.
    float rowKey = 1.0 - (z + 1.0) * 0.5;
    float rows = smoothstep(rowKey, rowKey + 0.15, uRowReveal * 1.15);
    vAlpha = ((0.16 + depthFade * 0.36) * (1.0 - uDissolve) + scan * 0.55 * uLight) * rows * mix(0.35, 1.0, uLight);
    vMint = max(smoothstep(0.02, 0.1, scan), smoothstep(0.4, 0.6, local) * 0.85);
    gl_PointSize = max(0.8, 3.04 / depth * uView.w) * uDpr;
  }
`;

const FIELD_FRAGMENT_SHADER = `
  uniform vec3 uInk;
  uniform vec3 uMint;
  varying float vAlpha;
  varying float vMint;
  void main() {
    if (vAlpha < 0.002) discard;
    gl_FragColor = vec4(mix(uInk, uMint, vMint), vAlpha);
  }
`;

function FieldScene({ config, progress, formationProgress, annotationsRef }: { config: FieldTierConfig; progress: MotionValue<number>; formationProgress: MotionValue<number>; annotationsRef: RefObject<HTMLCanvasElement | null> }) {
  const pointsRef = useRef<THREE.Points>(null);
  const animationTimeRef = useRef(0);
  const fontFamilyRef = useRef('monospace');
  const geometry = useMemo(() => createFieldGeometry(config.columns, config.rows), [config.columns, config.rows]);
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uOrder: { value: 0 },
      uDissolve: { value: 0 },
      uRowReveal: { value: 0 },
      uLight: { value: 0 },
      uScan: { value: -2 },
      uDpr: { value: 1 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uView: { value: new THREE.Vector4(1, 0, 0.62, 1) },
      uCamera: { value: new THREE.Vector3(0.32, 0, 3.1) },
      uInk: { value: new THREE.Color(HERO_FIELD_PALETTE.ink) },
      uMint: { value: new THREE.Color(HERO_FIELD_PALETTE.mint) },
    },
    vertexShader: FIELD_VERTEX_SHADER,
    fragmentShader: FIELD_FRAGMENT_SHADER,
  }), []);

  useEffect(() => {
    fontFamilyRef.current = readMonoFont();
  }, []);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  useFrame(({ size, viewport }, delta) => {
    const points = pointsRef.current;
    if (!points) return;
    // R3F clocks can advance while a tab is hidden. Bounded accumulation
    // keeps the terrain and scan continuous on resume.
    const safeDelta = Math.min(Math.max(delta, 0), 0.05);
    animationTimeRef.current += safeDelta;
    const time = animationTimeRef.current;
    const state = getHeroTimeline(progress.get());
    const formation = getHeroFormationTimeline(formationProgress.get());
    const view = fieldViewFor(size.width, size.height, config, state);
    points.visible = formation.rowReveal > 0.001;

    // Write to the material the points actually render, so a recreated
    // material (Fast Refresh, discarded memo) never keeps stale uniforms.
    const uniforms = (points.material as THREE.ShaderMaterial).uniforms;
    uniforms.uTime.value = time;
    uniforms.uOrder.value = state.order;
    uniforms.uDissolve.value = state.dissolve;
    uniforms.uRowReveal.value = formation.rowReveal;
    uniforms.uLight.value = formation.fieldLight;
    uniforms.uScan.value = fieldScanAt(time);
    uniforms.uDpr.value = viewport.dpr;
    (uniforms.uResolution.value as THREE.Vector2).set(size.width, size.height);
    (uniforms.uView.value as THREE.Vector4).set(view.scale, view.offsetX, view.offsetY, Math.min(Math.max(view.scale / 420, 1), 1.8));
    (uniforms.uCamera.value as THREE.Vector3).set(view.pitch, view.yaw, view.distance);

    const annotations = annotationsRef.current;
    const context = annotations?.getContext('2d');
    if (!annotations || !context) return;
    const backingWidth = Math.round(size.width * viewport.dpr);
    const backingHeight = Math.round(size.height * viewport.dpr);
    if (annotations.width !== backingWidth || annotations.height !== backingHeight) {
      annotations.width = backingWidth;
      annotations.height = backingHeight;
    }
    context.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
    context.clearRect(0, 0, size.width, size.height);
    if (!points.visible) return;
    drawFieldAnnotations(context, view, state, { columns: config.columns, rows: config.rows, time, labels: config.labels, fontFamily: fontFamilyRef.current });
  });

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} visible={false} />;
}

function HeroCosmosR3F({ config, progress, formationProgress, paused, onContextLost }: HeroCosmosR3FProps) {
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const annotationsRef = useRef<HTMLCanvasElement>(null);
  const handleContextLost = useCallback((event: Event) => {
    event.preventDefault();
    onContextLost();
  }, [onContextLost]);

  useEffect(() => () => {
    const element = rendererRef.current?.domElement;
    if (element) element.removeEventListener('webglcontextlost', handleContextLost);
  }, [handleContextLost]);

  return (
    <>
      <Canvas
        className="hero-cosmos__webgl"
        dpr={config.dpr}
        frameloop={paused ? 'never' : 'always'}
        gl={{ alpha: true, antialias: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          rendererRef.current = gl;
          gl.setClearColor(0x000000, 0);
          gl.domElement.addEventListener('webglcontextlost', handleContextLost, { passive: false });
        }}
      >
        <FieldScene key={`${config.columns}x${config.rows}`} config={config} progress={progress} formationProgress={formationProgress} annotationsRef={annotationsRef} />
      </Canvas>
      <canvas ref={annotationsRef} className="hero-cosmos__annotations" aria-hidden="true" />
    </>
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
  // WebGL2 support does not change with the viewport, so it is probed once
  // instead of per resize event. A lost context clears it so the next resize
  // probes again rather than trusting a stale result.
  const webgl2SupportRef = useRef<boolean | null>(null);
  const handleContextLost = useCallback(() => {
    webgl2SupportRef.current = null;
    setWebglAvailable(false);
    setTier('static');
  }, []);
  const isStatic = forceStatic || tier === 'static' || !webglAvailable;
  const config = tier === 'static' ? null : FIELD_TIERS[tier];
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
      webgl2SupportRef.current ??= probeWebgl2();
      const supported = webgl2SupportRef.current;
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
      data-points={isStatic || !config ? STATIC_FIELD_GRID.columns * STATIC_FIELD_GRID.rows : config.columns * config.rows}
      data-fallback={fallbackMode}
      data-paused={paused ? 'true' : 'false'}
      aria-hidden="true"
    >
      {!capabilityReady ? null : isStatic || !config ? <StaticCosmos config={STATIC_FIELD_GRID} /> : <HeroCosmosR3F config={config} progress={progress} formationProgress={formationProgress} paused={paused} onContextLost={handleContextLost} />}
    </div>
  );
}

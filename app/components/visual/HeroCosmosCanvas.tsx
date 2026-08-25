'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import type { MotionValue } from 'motion/react';
import * as THREE from 'three';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getHeroTimeline } from '../site/hero-timeline';

export type HeroCosmosTier = 'pc' | 'tablet' | 'mobile' | 'static';

type TierConfig = {
  detail: number;
  points: number;
  satellites: number;
  dpr: number;
  xFactor: number;
  sphereScale: number;
  yOffset: number;
};

const TIER_CONFIG: Record<HeroCosmosTier, TierConfig> = {
  pc: { detail: 5, points: 3000, satellites: 12, dpr: 1.6, xFactor: 2.45, sphereScale: 1.2, yOffset: 0 },
  tablet: { detail: 4, points: 1700, satellites: 8, dpr: 1.3, xFactor: 0.95, sphereScale: 0.78, yOffset: -0.04 },
  mobile: { detail: 3, points: 900, satellites: 6, dpr: 1, xFactor: 0.4, sphereScale: 0.55, yOffset: -0.22 },
  static: { detail: 0, points: 180, satellites: 0, dpr: 1, xFactor: 0.4, sphereScale: 0.55, yOffset: -0.1 },
};

type HeroCosmosCanvasProps = {
  progress: MotionValue<number>;
  forceStatic: boolean;
  onStaticChange: (staticMode: boolean) => void;
};

type HeroCosmosR3FProps = {
  config: TierConfig;
  progress: MotionValue<number>;
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

function drawStaticCosmos(context: CanvasRenderingContext2D, width: number, height: number, progress: number, points: Float32Array, dpr: number) {
  const state = getHeroTimeline(progress);
  const centerX = width * (0.5 + state.sphereX * 0.18);
  const centerY = height * (0.5 - state.sphereY * 0.14);
  const radius = Math.min(width, height) * 0.16 * state.sphereScale;

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  const glow = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius * 2.8);
  glow.addColorStop(0, 'rgba(132, 255, 207, 0.23)');
  glow.addColorStop(0.38, 'rgba(65, 197, 183, 0.1)');
  glow.addColorStop(1, 'rgba(5, 15, 18, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  context.save();
  context.translate(centerX, centerY);
  context.rotate(state.sphereRotationZ);
  context.strokeStyle = 'rgba(166, 255, 219, 0.48)';
  context.lineWidth = 1;
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = 'rgba(110, 226, 255, 0.38)';
  context.beginPath();
  context.ellipse(0, 0, radius * 1.12, radius * 0.38, 0.54 + state.cameraYaw, 0, Math.PI * 2);
  context.stroke();
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

function createOrbitGroup(): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.LineBasicMaterial({ color: 0x76eec4, transparent: true, opacity: 0.44, blending: THREE.AdditiveBlending });
  const cyanMaterial = new THREE.LineBasicMaterial({ color: 0x6ee2ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending });
  const curves = [
    { radius: 1.46, scaleY: 0.34, rotation: 0.28, lineMaterial: material },
    { radius: 1.86, scaleY: 0.18, rotation: -0.5, lineMaterial: cyanMaterial },
    { radius: 2.15, scaleY: 0.52, rotation: 1.08, lineMaterial: material },
  ];
  curves.forEach(({ radius, scaleY, rotation, lineMaterial }) => {
    const points: THREE.Vector3[] = [];
    for (let index = 0; index <= 96; index += 1) {
      const angle = (index / 96) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * scaleY;
      points.push(new THREE.Vector3(x * Math.cos(rotation) - y * Math.sin(rotation), x * Math.sin(rotation) + y * Math.cos(rotation), Math.sin(angle * 2) * 0.08));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    group.add(new THREE.Line(geometry, lineMaterial));
  });
  return group;
}

function CosmosScene({ config, progress }: { config: TierConfig; progress: MotionValue<number> }) {
  const rootRef = useRef<THREE.Group>(null);
  const satellitesRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cameraLookAt = useMemo(() => new THREE.Vector3(0, 0, 0), []);
  const orbitGroup = useMemo(() => createOrbitGroup(), []);
  // `detail` is an explicit product budget: do not silently lower the
  // requested PC/tablet/mobile geometry tier.
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, config.detail), [config.detail]);
  const orbMaterial = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uDissolve: { value: 0 } },
    vertexShader: `
      uniform float uTime;
      uniform float uDissolve;
      varying vec3 vNormal;
      varying vec3 vPosition;
      float fieldNoise(vec3 p) {
        return sin(p.x * 4.2 + uTime * 0.32) * sin(p.y * 3.7 - uTime * 0.21) * sin(p.z * 5.1 + uTime * 0.16);
      }
      void main() {
        vec3 displaced = position + normal * fieldNoise(position * 1.7) * 0.055;
        displaced += normal * uDissolve * fieldNoise(position * 7.0 + 2.0) * 0.22;
        vNormal = normalize(normalMatrix * normal);
        vPosition = displaced;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uDissolve;
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vec3 viewDirection = normalize(-vPosition);
        float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDirection), 0.0), 2.35);
        float cloud = sin(vPosition.x * 7.0 + uTime * 0.2) * sin(vPosition.y * 5.0 - uTime * 0.13) * sin(vPosition.z * 8.0 + uTime * 0.17);
        cloud = smoothstep(-0.62, 0.9, cloud);
        float starNoise = smoothstep(0.82, 0.99, sin(vPosition.x * 31.0 + vPosition.y * 17.0 + uTime * 0.04) * 0.5 + 0.5);
        vec3 core = vec3(0.008, 0.018, 0.032);
        vec3 cyan = vec3(0.08, 0.74, 1.0);
        vec3 violet = vec3(0.46, 0.18, 1.0);
        vec3 mint = vec3(0.22, 1.0, 0.72);
        vec3 nebula = mix(cyan, violet, smoothstep(-0.5, 0.65, sin(vPosition.y * 3.2 + vPosition.x * 2.1)));
        nebula = mix(nebula, mint, cloud * 0.35);
        vec3 color = mix(core, nebula, min(1.0, fresnel * 0.9 + cloud * 0.28));
        color += vec3(0.35, 0.8, 1.0) * starNoise * 0.28;
        float alpha = (0.12 + fresnel * 0.56 + cloud * 0.2 + starNoise * 0.24) * (1.0 - uDissolve * 0.94);
        gl_FragColor = vec4(color, alpha);
      }
    `,
  }), []);
  const wireMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x78dfff, transparent: true, opacity: 0.14, wireframe: true, blending: THREE.AdditiveBlending }), []);
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
      uniforms: { uTime: { value: 0 }, uDissolve: { value: 0 } },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        varying float vAlpha;
        varying vec3 vColor;
        uniform float uTime;
        uniform float uDissolve;
        void main() {
          vec3 moved = position;
          moved.x += sin(uTime * 0.18 + position.y * 4.0) * 0.04;
          moved.y += cos(uTime * 0.14 + position.x * 3.0) * 0.04;
          moved *= 1.0 + uDissolve * 0.9;
          vAlpha = aAlpha;
          float hue = sin(position.x * 2.4 + position.z * 4.1) * 0.5 + 0.5;
          vColor = mix(vec3(0.16, 0.82, 1.0), vec3(0.54, 0.24, 1.0), hue);
          vColor = mix(vColor, vec3(0.28, 1.0, 0.72), smoothstep(0.7, 1.0, hue) * 0.42);
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
  const orbMaterialRef = useRef(orbMaterial);
  const pointMaterialRef = useRef(pointData.material);
  const wireMaterialRef = useRef(wireMaterial);
  const satelliteGeometry = useMemo(() => new THREE.SphereGeometry(0.06, 8, 6), []);
  const satelliteMaterial = useMemo(() => new THREE.MeshBasicMaterial({ color: 0x6ee2ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }), []);

  useEffect(() => () => {
    geometry.dispose();
    orbMaterial.dispose();
    wireMaterial.dispose();
    pointData.geometry.dispose();
    pointData.material.dispose();
    satelliteGeometry.dispose();
    satelliteMaterial.dispose();
    orbitGroup.traverse((object) => {
      if (object instanceof THREE.Line) object.geometry.dispose();
    });
    orbitGroup.children.forEach((object) => {
      if (object instanceof THREE.Line && object.material instanceof THREE.Material) object.material.dispose();
    });
  }, [geometry, orbMaterial, orbitGroup, pointData, satelliteGeometry, satelliteMaterial, wireMaterial]);

  useFrame(({ clock, camera }, delta) => {
    const root = rootRef.current;
    const satellites = satellitesRef.current;
    const state = getHeroTimeline(progress.get());
    if (!root) return;
    const time = clock.elapsedTime;
    const targetX = state.sphereX * config.xFactor;
    const targetY = state.sphereY + config.yOffset;
    const targetScale = state.sphereScale * config.sphereScale;
    root.position.x = THREE.MathUtils.damp(root.position.x, targetX, 8, delta);
    root.position.y = THREE.MathUtils.damp(root.position.y, targetY, 8, delta);
    root.position.z = THREE.MathUtils.damp(root.position.z, 0, 8, delta);
    root.rotation.x = THREE.MathUtils.damp(root.rotation.x, state.sphereRotationX, 8, delta);
    root.rotation.y = THREE.MathUtils.damp(root.rotation.y, state.sphereRotationY, 8, delta);
    root.rotation.z = THREE.MathUtils.damp(root.rotation.z, state.sphereRotationZ, 8, delta);
    const nextScale = THREE.MathUtils.damp(root.scale.x, targetScale, 8, delta);
    root.scale.setScalar(nextScale);
    orbMaterialRef.current.uniforms.uTime.value = time;
    orbMaterialRef.current.uniforms.uDissolve.value = state.dissolve;
    pointMaterialRef.current.uniforms.uTime.value = time;
    pointMaterialRef.current.uniforms.uDissolve.value = state.dissolve;
    wireMaterialRef.current.opacity = 0.14 * (1 - state.dissolve * 0.92);
    if (satellites) {
      for (let index = 0; index < config.satellites; index += 1) {
        const angle = time * (0.18 + index * 0.007) + (index / Math.max(1, config.satellites)) * Math.PI * 2;
        const radius = 1.14 + (index % 3) * 0.24;
        dummy.position.set(Math.cos(angle) * radius, Math.sin(angle * 1.23) * radius * 0.52, Math.sin(angle) * radius * 0.46);
        dummy.scale.setScalar(1 - state.dissolve * 0.2);
        dummy.updateMatrix();
        satellites.setMatrixAt(index, dummy.matrix);
      }
      satellites.instanceMatrix.needsUpdate = true;
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
    <group ref={rootRef}>
      <mesh geometry={geometry} material={orbMaterial} />
      <mesh geometry={geometry} material={wireMaterial} scale={1.018} />
      <primitive object={orbitGroup} />
      <points geometry={pointData.geometry} material={pointData.material} />
      {config.satellites > 0 ? <instancedMesh ref={satellitesRef} args={[satelliteGeometry, satelliteMaterial, config.satellites]} /> : null}
    </group>
  );
}

function HeroCosmosR3F({ config, progress, paused, onContextLost }: HeroCosmosR3FProps) {
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
      <CosmosScene key={`${config.detail}-${config.points}`} config={config} progress={progress} />
    </Canvas>
  );
}

export default function HeroCosmosCanvas({ progress, forceStatic, onStaticChange }: HeroCosmosCanvasProps) {
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
      data-render-tier={isStatic ? 'static' : tier}
      data-config-tier={tier}
      data-detail={isStatic ? 0 : config.detail}
      data-points={isStatic ? TIER_CONFIG.static.points : config.points}
      data-satellites={isStatic ? 0 : config.satellites}
      data-fallback={isStatic ? 'canvas2d' : 'webgl2'}
      data-paused={paused ? 'true' : 'false'}
      aria-hidden="true"
    >
      {isStatic ? <StaticCosmos progress={progress} config={TIER_CONFIG.static} /> : <HeroCosmosR3F config={config} progress={progress} paused={paused} onContextLost={handleContextLost} />}
    </div>
  );
}

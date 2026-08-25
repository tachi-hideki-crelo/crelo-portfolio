'use client';

import { useEffect, useRef, useState } from 'react';

type RenderTier = 'high' | 'balanced' | 'mobile' | 'static';

type Point = { x: number; y: number; size: number; alpha: number; hue: 'mint' | 'cyan' | 'amber' };

function chooseTier(width: number, reducedMotion: boolean, saveData: boolean): RenderTier {
  if (reducedMotion || saveData) return 'static';
  if (width >= 1180) return 'high';
  if (width >= 640) return 'balanced';
  return 'mobile';
}

function makePoints(count: number): Point[] {
  let value = 23;
  const random = () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
  return Array.from({ length: count }, (_, index) => ({ x: random(), y: random(), size: 0.4 + random() * (index % 13 === 0 ? 2.4 : 1.2), alpha: 0.12 + random() * 0.55, hue: index % 11 === 0 ? 'amber' : index % 4 === 0 ? 'cyan' : 'mint' }));
}

function pointCountForTier(tier: RenderTier): number {
  return tier === 'high' ? 160 : tier === 'balanced' ? 112 : 70;
}

function dprForTier(tier: RenderTier): number {
  return tier === 'high' ? 1.6 : tier === 'balanced' ? 1.3 : 1;
}

function colorFor(hue: Point['hue'], alpha: number): string {
  if (hue === 'amber') return `rgba(255, 184, 92, ${alpha})`;
  if (hue === 'cyan') return `rgba(110, 226, 255, ${alpha})`;
  return `rgba(163, 255, 208, ${alpha})`;
}

function drawStaticField(context: CanvasRenderingContext2D, width: number, height: number, points: Point[]) {
  context.clearRect(0, 0, width, height);
  const glow = context.createRadialGradient(width * 0.74, height * 0.28, 0, width * 0.74, height * 0.28, width * 0.76);
  glow.addColorStop(0, 'rgba(37, 128, 106, 0.16)');
  glow.addColorStop(0.46, 'rgba(18, 67, 83, 0.08)');
  glow.addColorStop(1, 'rgba(4, 10, 12, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
  context.lineWidth = 1;
  context.strokeStyle = 'rgba(141, 246, 203, 0.055)';
  const grid = Math.max(48, Math.min(76, width / 18));
  for (let x = 0; x < width; x += grid) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke(); }
  for (let y = 0; y < height; y += grid) { context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke(); }
  points.forEach((point) => { context.fillStyle = colorFor(point.hue, point.alpha * 0.7); context.beginPath(); context.arc(point.x * width, point.y * height, point.size, 0, Math.PI * 2); context.fill(); });
}

export default function NeuralBackdrop() {
  const fieldRef = useRef<HTMLDivElement>(null);
  const fallbackRef = useRef<HTMLCanvasElement>(null);
  // Keep the first render identical on server and client. The capability tier is
  // selected after mount so hydration never depends on viewport APIs.
  const [tier, setTier] = useState<RenderTier>('static');
  const tierRef = useRef<RenderTier>('static');
  const [paused, setPaused] = useState(false);
  const pointsRef = useRef<Point[]>([]);

  useEffect(() => {
    const field = fieldRef.current;
    const fallback = fallbackRef.current;
    if (!field || !fallback) return;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void } }).connection;
    const readTier = () => chooseTier(window.innerWidth, motionQuery.matches, Boolean(connection?.saveData));
    const initialTier = readTier();
    tierRef.current = initialTier;
    pointsRef.current = makePoints(pointCountForTier(initialTier));
    const context = fallback.getContext('2d');
    const resizeFallback = (nextTier: RenderTier) => {
      const dpr = Math.min(window.devicePixelRatio || 1, dprForTier(nextTier));
      fallback.width = Math.round(window.innerWidth * dpr);
      fallback.height = Math.round(window.innerHeight * dpr);
      fallback.style.width = `${window.innerWidth}px`;
      fallback.style.height = `${window.innerHeight}px`;
      context?.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (context) drawStaticField(context, window.innerWidth, window.innerHeight, pointsRef.current);
    };
    resizeFallback(initialTier);
    const mountTimer = window.setTimeout(() => setTier(initialTier), 0);
    const resize = () => {
      const nextTier = readTier();
      if (nextTier !== tierRef.current) {
        tierRef.current = nextTier;
        pointsRef.current = makePoints(pointCountForTier(nextTier));
        setTier(nextTier);
      }
      resizeFallback(nextTier);
    };
    const observer = new IntersectionObserver(([entry]) => setPaused(!(entry?.isIntersecting ?? true)), { threshold: 0.01 });
    observer.observe(field);
    const onVisibility = () => setPaused(document.visibilityState !== 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', resize, { passive: true });
    motionQuery.addEventListener?.('change', resize);
    connection?.addEventListener?.('change', resize);
    return () => {
      window.clearTimeout(mountTimer);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
      motionQuery.removeEventListener?.('change', resize);
      connection?.removeEventListener?.('change', resize);
    };
  }, []);

  return (
    <div ref={fieldRef} className="neural-backdrop" data-render-tier={tier} data-render-surface="canvas2d" data-paused={paused ? 'true' : 'false'} aria-hidden="true">
      <canvas ref={fallbackRef} className="neural-backdrop__canvas neural-backdrop__canvas--fallback" />
      <div className="neural-backdrop__scan" />
      <div className="neural-backdrop__vignette" />
    </div>
  );
}

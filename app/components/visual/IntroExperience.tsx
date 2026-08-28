'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

const INTRO_KEY = 'crelo-intro-seen-v1';
const REPLAY_EVENT = 'crelo:replay-intro';

type Particle = { x: number; y: number; tx: number; ty: number; size: number; alpha: number; phase: number };

type IntroExperienceProps = {
  mainRef: RefObject<HTMLElement | null>;
  onIntroStart: () => void;
  onIntroComplete: () => void;
};

function createParticles(count: number): Particle[] {
  let value = 31;
  const random = () => {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    tx: 0.5,
    ty: 0.5,
    size: 0.7 + random() * 1.8,
    alpha: 0.25 + random() * 0.75,
    phase: random() * Math.PI * 2,
  }));
}

function setTargetPoints(particles: Particle[], image: HTMLImageElement) {
  const sampleCanvas = document.createElement('canvas');
  const sampleSize = 96;
  sampleCanvas.width = sampleSize;
  sampleCanvas.height = sampleSize;
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
  if (!sampleContext) return;
  sampleContext.clearRect(0, 0, sampleSize, sampleSize);
  sampleContext.drawImage(image, 0, 0, sampleSize, sampleSize);
  const pixels = sampleContext.getImageData(0, 0, sampleSize, sampleSize).data;
  const candidates: Array<{ x: number; y: number }> = [];
  for (let y = 0; y < sampleSize; y += 2) {
    for (let x = 0; x < sampleSize; x += 2) {
      const alpha = pixels[(y * sampleSize + x) * 4 + 3];
      if (alpha > 45) candidates.push({ x: x / sampleSize, y: y / sampleSize });
    }
  }
  if (candidates.length === 0) return;
  particles.forEach((particle, index) => {
    const point = candidates[index % candidates.length];
    particle.tx = 0.26 + point.x * 0.48;
    particle.ty = 0.24 + point.y * 0.48;
  });
}

export default function IntroExperience({ mainRef, onIntroStart, onIntroComplete }: IntroExperienceProps) {
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const finishingRef = useRef(false);

  const finish = useCallback(() => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      window.sessionStorage.setItem(INTRO_KEY, '1');
    } catch {
      // Private browsing and storage policies must not prevent the intro from closing.
    }
    setVisible(false);
    onIntroComplete();
    window.setTimeout(() => mainRef.current?.focus({ preventScroll: true }), 30);
  }, [mainRef, onIntroComplete]);

  const startIntro = useCallback(() => {
    finishingRef.current = false;
    onIntroStart();
    setVisible(true);
  }, [onIntroStart]);

  useEffect(() => {
    const replay = () => startIntro();
    window.addEventListener(REPLAY_EVENT, replay);
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(INTRO_KEY) === '1';
    } catch {
      seen = false;
    }
    const revealTimer = window.setTimeout(() => {
      if (seen) {
        onIntroComplete();
        return;
      }
      startIntro();
    }, 0);
    const motionTimer = window.setTimeout(() => setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches), 0);
    return () => {
      window.clearTimeout(revealTimer);
      window.clearTimeout(motionTimer);
      window.removeEventListener(REPLAY_EVENT, replay);
    };
  }, [onIntroComplete, startIntro]);

  useEffect(() => {
    if (!visible) return;
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!overlay || !canvas) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    skipRef.current?.focus();
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = canvas.getContext('2d');
    } catch {
      context = null;
    }
    const particles = createParticles(reducedMotion ? 90 : 500);
    const logo = new window.Image();
    let frame = 0;
    let finishTimer = 0;
    let active = true;
    let startedAt = performance.now();
    let resize: () => void = () => undefined;
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = overlay.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    overlay.addEventListener('keydown', keydown);
    const cleanup = () => {
      active = false;
      if (frame) window.cancelAnimationFrame(frame);
      if (finishTimer) window.clearTimeout(finishTimer);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('resize', resize);
      overlay.removeEventListener('keydown', keydown);
    };
    if (!context) {
      finishTimer = window.setTimeout(finish, reducedMotion ? 700 : 3100);
      return cleanup;
    }
    resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = (time: number) => {
      if (!active) return;
      const elapsed = time - startedAt;
      const duration = reducedMotion ? 650 : 3000;
      const progress = Math.min(1, elapsed / duration);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - ((-2 * progress + 2) ** 2) / 2;
      const width = window.innerWidth;
      const height = window.innerHeight;
      context.clearRect(0, 0, width, height);
      const haze = context.createRadialGradient(width * 0.5, height * 0.47, 0, width * 0.5, height * 0.47, Math.min(width, height) * 0.58);
      haze.addColorStop(0, `rgba(81, 226, 164, ${0.07 + eased * 0.1})`);
      haze.addColorStop(0.5, 'rgba(17, 79, 70, 0.035)');
      haze.addColorStop(1, 'rgba(2, 5, 6, 0)');
      context.fillStyle = haze;
      context.fillRect(0, 0, width, height);
      particles.forEach((particle, index) => {
        const targetX = particle.tx * width;
        const targetY = particle.ty * height;
        const scatter = 1 - eased;
        const x = particle.x * width * scatter + targetX * eased + Math.sin(time * 0.001 + particle.phase) * scatter * 16;
        const y = particle.y * height * scatter + targetY * eased + Math.cos(time * 0.0008 + particle.phase) * scatter * 12;
        const alpha = particle.alpha * (0.28 + eased * 0.72) * (index % 9 === 0 ? 1.2 : 1);
        context.fillStyle = index % 13 === 0 ? `rgba(112, 226, 255, ${alpha})` : `rgba(174, 255, 216, ${alpha})`;
        context.beginPath();
        context.arc(x, y, particle.size * (0.6 + eased * 0.85), 0, Math.PI * 2);
        context.fill();
      });
      const lineAlpha = Math.min(0.3, eased * 0.3);
      context.strokeStyle = `rgba(164, 255, 211, ${lineAlpha})`;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(width * 0.18, height * 0.72);
      context.lineTo(width * 0.82, height * 0.72);
      context.stroke();
      if (progress >= 1) {
        finish();
        return;
      }
      if (active && !reducedMotion) frame = window.requestAnimationFrame(draw);
    };
    logo.onload = () => {
      if (!active) return;
      setTargetPoints(particles, logo);
      startedAt = performance.now();
      if (reducedMotion) {
        draw(startedAt + 600);
        finishTimer = window.setTimeout(finish, 680);
      } else {
        frame = window.requestAnimationFrame(draw);
      }
    };
    logo.onerror = () => {
      if (!active) return;
      finishTimer = window.setTimeout(finish, reducedMotion ? 700 : 3100);
    };
    logo.src = '/assets/crelo-logo.png';
    resize();
    window.addEventListener('resize', resize, { passive: true });
    return () => {
      cleanup();
    };
  }, [visible, reducedMotion, mainRef, finish]);

  if (!visible) return null;
  return (
    <div ref={overlayRef} className={`intro-layer${reducedMotion ? ' intro-layer--reduced' : ''}`} role="dialog" aria-modal="true" aria-label="Crelo introduction">
      <canvas ref={canvasRef} className="intro-layer__canvas" aria-hidden="true" />
      <div className="intro-layer__topline"><span>CRELO / FIELD SYSTEM</span><span>BOOT SEQUENCE 01</span></div>
      <div className="intro-layer__center">
        <Image className="intro-layer__logo" src="/assets/crelo-logo.png" alt="Crelo" width={180} height={180} priority />
        <span className="intro-layer__wordmark">Crelo</span>
        <span className="intro-layer__subline">Forward deployed / neural operations</span>
      </div>
      <div className="intro-layer__bottomline">
        <span>REASSEMBLE / CONNECT / DEPLOY</span>
        <button ref={skipRef} className="intro-layer__skip" type="button" onClick={finish}>Skip intro <span aria-hidden="true">↗</span></button>
      </div>
    </div>
  );
}

export { REPLAY_EVENT };

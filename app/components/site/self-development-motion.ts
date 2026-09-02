export type SelfDevelopmentPhase = 'intro' | 'tool-1' | 'tool-2' | 'tool-3' | 'tool-4' | 'outro';

export type SelfDevelopmentStageTimeline = {
  progress: number;
  phase: SelfDevelopmentPhase;
  titleReveal: number;
  bodyReveal: number;
  titleLiftVh: number;
  titleScale: number;
  titleOpacity: number;
  railProgress: number;
  atmosphere: number;
  outro: number;
};

export type SelfDevelopmentItemTimeline = {
  localProgress: number;
  xVw: number;
  yVh: number;
  scale: number;
  opacity: number;
  blurPx: number;
  rotateDeg: number;
  cardReveal: number;
  copyReveal: number;
  portal: number;
  afterimage: number;
  interactive: boolean;
};

export const SELF_DEVELOPMENT_WINDOWS = [
  { start: 0.12, end: 0.38 },
  { start: 0.30, end: 0.56 },
  { start: 0.48, end: 0.74 },
  { start: 0.66, end: 0.92 },
] as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - (2 * clamped));
}

function segment(value: number, start: number, end: number): number {
  if (end <= start) return value >= end ? 1 : 0;
  return smoothstep((value - start) / (end - start));
}

function lerp(start: number, end: number, amount: number): number {
  return start + ((end - start) * amount);
}

export function selfDevelopmentPhaseAt(progress: number): SelfDevelopmentPhase {
  const value = clamp01(progress);
  if (value < SELF_DEVELOPMENT_WINDOWS[0].start) return 'intro';
  if (value < SELF_DEVELOPMENT_WINDOWS[1].start) return 'tool-1';
  if (value < SELF_DEVELOPMENT_WINDOWS[2].start) return 'tool-2';
  if (value < SELF_DEVELOPMENT_WINDOWS[3].start) return 'tool-3';
  if (value < 0.92) return 'tool-4';
  return 'outro';
}

export function getSelfDevelopmentStageTimeline(progress: number, reduceMotion = false): SelfDevelopmentStageTimeline {
  const value = clamp01(progress);
  if (reduceMotion) {
    return { progress: value, phase: 'outro', titleReveal: 1, bodyReveal: 1, titleLiftVh: 0, titleScale: 1, titleOpacity: 1, railProgress: 1, atmosphere: 1, outro: 1 };
  }
  const titleReveal = segment(value, 0.01, 0.09);
  const bodyReveal = segment(value, 0.05, 0.12);
  const compact = segment(value, 0.08, 0.20);
  const outro = segment(value, 0.92, 1);
  return {
    progress: value,
    phase: selfDevelopmentPhaseAt(value),
    titleReveal,
    bodyReveal,
    titleLiftVh: lerp(0, -13, compact),
    titleScale: lerp(1, 0.68, compact),
    titleOpacity: titleReveal * lerp(1, 0.2, compact) * lerp(1, 0.62, outro),
    railProgress: segment(value, 0.09, 0.93),
    atmosphere: titleReveal * lerp(1, 0.35, outro),
    outro,
  };
}

export function getSelfDevelopmentItemTimeline(progress: number, index: number, reduceMotion = false): SelfDevelopmentItemTimeline {
  const safeIndex = Math.min(Math.max(Math.round(index), 0), SELF_DEVELOPMENT_WINDOWS.length - 1);
  const window = SELF_DEVELOPMENT_WINDOWS[safeIndex];
  if (reduceMotion) {
    return { localProgress: 1, xVw: 0, yVh: 0, scale: 1, opacity: 1, blurPx: 0, rotateDeg: 0, cardReveal: 1, copyReveal: 1, portal: 0, afterimage: 0, interactive: true };
  }

  const localProgress = clamp01((clamp01(progress) - window.start) / (window.end - window.start));
  // Let each handoff breathe: the next tool reconstructs while the previous
  // one is still leaving, so the slower movement never creates an empty gap.
  const enter = segment(localProgress, 0, 0.33);
  const exit = segment(localProgress, 0.76, 1);
  const side = safeIndex % 2 === 0 ? -1 : 1;
  const portalRise = segment(localProgress, 0.01, 0.22);
  const portalFall = segment(localProgress, 0.28, 0.56);
  const portal = portalRise * (1 - portalFall);

  return {
    localProgress,
    xVw: side * (lerp(7, 0, enter) + lerp(0, 3, exit)),
    yVh: lerp(86, 0, enter) + lerp(0, -92, exit),
    scale: lerp(0.78, 1, enter) - (0.04 * exit),
    opacity: enter * (1 - (0.9 * exit)),
    blurPx: lerp(18, 0, enter) + (5 * exit),
    rotateDeg: side * (lerp(6, 0, enter) + lerp(0, -1.5, exit)),
    cardReveal: segment(localProgress, 0.04, 0.30) * (1 - (0.35 * exit)),
    copyReveal: segment(localProgress, 0.13, 0.32) * (1 - (0.55 * exit)),
    portal,
    afterimage: enter * (1 - exit),
    interactive: localProgress > 0.22 && localProgress < 0.82,
  };
}

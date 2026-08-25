export type CardMotionLayout = {
  x: string;
  y: string;
  rotate: string;
  z: number;
  depth: number;
  parallax: number;
};

export const CARD_LAYOUT: readonly CardMotionLayout[] = [
  { x: '-25vw', y: '-15vh', rotate: '-8deg', z: 44, depth: 72, parallax: -18 },
  { x: '24vw', y: '-17vh', rotate: '7deg', z: 24, depth: 108, parallax: 22 },
  { x: '0vw', y: '0vh', rotate: '-2deg', z: 58, depth: 130, parallax: 0 },
  { x: '-24vw', y: '22vh', rotate: '7deg', z: 19, depth: 88, parallax: -9 },
  { x: '25vw', y: '22vh', rotate: '-6deg', z: 36, depth: 100, parallax: 13 },
] as const;

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(Math.max(progress, 0), 1);
}

export function getActiveCaseIndex(progress: number, caseCount: number): number {
  if (caseCount <= 1) return 0;
  return Math.min(Math.floor(clampProgress(progress) * caseCount), caseCount - 1);
}

export function getCardMotionOffsets(layout: CardMotionLayout, progress: number, reduceMotion = false) {
  const normalized = reduceMotion ? 0 : clampProgress(progress);
  return {
    parallaxOffset: layout.parallax * normalized,
    depthOffset: layout.depth * normalized,
  };
}

export const KEYBOARD_SCROLL_LOCK_MS = 1200;
export const KEYBOARD_SCROLL_JITTER_PX = 16;

/**
 * A keyboard focus move may produce a tiny browser scroll even when
 * preventScroll is requested. Hold the explicit selection only for that
 * short, small movement; a real scroll immediately resumes scroll selection.
 */
export function shouldHoldKeyboardSelection(elapsedMs: number, scrollDeltaPx: number): boolean {
  return elapsedMs >= 0
    && elapsedMs <= KEYBOARD_SCROLL_LOCK_MS
    && Math.abs(scrollDeltaPx) <= KEYBOARD_SCROLL_JITTER_PX;
}

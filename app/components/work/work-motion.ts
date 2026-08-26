export type CardMotionLayout = {
  x: string;
  y: string;
  rotate: string;
  z: number;
  depth: number;
  parallax: number;
};

export const CARD_LAYOUT: readonly CardMotionLayout[] = [
  { x: '0vw', y: '-2vh', rotate: '-2deg', z: 92, depth: 132, parallax: 14 },
  { x: '-58vw', y: '-32vh', rotate: '-14deg', z: 48, depth: 96, parallax: -26 },
  { x: '60vw', y: '-27vh', rotate: '13deg', z: 34, depth: 116, parallax: 30 },
  { x: '-56vw', y: '38vh', rotate: '11deg', z: 24, depth: 88, parallax: -22 },
  { x: '61vw', y: '40vh', rotate: '-12deg', z: 40, depth: 108, parallax: 27 },
] as const;

export const STATIC_CARD_LAYOUT: readonly CardMotionLayout[] = [
  { x: '0vw', y: '-1vh', rotate: '-2deg', z: 52, depth: 0, parallax: 0 },
  { x: '-24vw', y: '-17vh', rotate: '-7deg', z: 28, depth: 0, parallax: 0 },
  { x: '24vw', y: '-17vh', rotate: '7deg', z: 24, depth: 0, parallax: 0 },
  { x: '-24vw', y: '22vh', rotate: '7deg', z: 19, depth: 0, parallax: 0 },
  { x: '25vw', y: '22vh', rotate: '-6deg', z: 32, depth: 0, parallax: 0 },
] as const;

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.min(Math.max(progress, 0), 1);
}

export function getBurstProgress(progress: number, index: number, reduceMotion = false): number {
  if (reduceMotion) return 1;
  const delay = Math.max(index, 0) * 0.012;
  const normalized = clampProgress((progress - delay) / 0.24);
  if (normalized === 0 || normalized === 1) return normalized;

  const overshoot = 1.32;
  const shifted = normalized - 1;
  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2;
}

export function getPointerCardMotion({
  baseX,
  baseY,
  pointerX,
  pointerY,
  viewportWidth,
  viewportHeight,
  depth,
  reduceMotion = false,
}: {
  baseX: number;
  baseY: number;
  pointerX: number;
  pointerY: number;
  viewportWidth: number;
  viewportHeight: number;
  depth: number;
  reduceMotion?: boolean;
}) {
  if (reduceMotion) return { x: 0, y: 0, rotateX: 0, rotateY: 0 };

  const safeWidth = Math.max(viewportWidth, 1);
  const safeHeight = Math.max(viewportHeight, 1);
  const normalizedX = Math.min(Math.max(pointerX / (safeWidth / 2), -1), 1);
  const normalizedY = Math.min(Math.max(pointerY / (safeHeight / 2), -1), 1);
  const outsideX = Math.max(Math.abs(baseX) - safeWidth * 0.3, 0) / (safeWidth * 0.7);
  const outsideY = Math.max(Math.abs(baseY) - safeHeight * 0.3, 0) / (safeHeight * 0.7);
  const outsidePull = Math.min(Math.max(outsideX, outsideY), 1) * 0.2;
  const depthPull = Math.min(Math.max(depth, 0) / 150, 1) * 0.07;
  const pull = 0.08 + outsidePull + depthPull;

  return {
    x: (pointerX - baseX) * pull,
    y: (pointerY - baseY) * pull,
    rotateX: -normalizedY * (3.5 + depthPull * 18),
    rotateY: normalizedX * (4.5 + depthPull * 20),
  };
}

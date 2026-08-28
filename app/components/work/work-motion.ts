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
  { x: '-30vw', y: '-22vh', rotate: '-11deg', z: 48, depth: 96, parallax: -20 },
  { x: '30vw', y: '-21vh', rotate: '11deg', z: 34, depth: 116, parallax: 22 },
  { x: '-30vw', y: '23vh', rotate: '9deg', z: 24, depth: 88, parallax: -18 },
  { x: '31vw', y: '24vh', rotate: '-10deg', z: 40, depth: 108, parallax: 20 },
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

export function getScatterEntryProgress(
  stageTop: number,
  viewportHeight: number,
  reduceMotion = false,
): number {
  if (reduceMotion) return 1;

  const safeHeight = Number.isFinite(viewportHeight) ? Math.max(viewportHeight, 1) : 1;
  const safeStageTop = Number.isFinite(stageTop) ? stageTop : safeHeight;
  const entryStart = (safeHeight * 55) / 100;
  const entryTravel = (safeHeight * 24) / 100;

  return clampProgress((entryStart - safeStageTop) / entryTravel);
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
  const deltaX = pointerX - baseX;
  const deltaY = pointerY - baseY;
  const distance = Math.hypot(deltaX, deltaY);
  const radius = Math.max(Math.min(safeWidth * 0.38, safeHeight * 0.5), 240);
  const proximity = distance >= radius ? 0 : 1 - distance / radius;
  const falloff = proximity * proximity;
  if (falloff === 0) return { x: 0, y: 0, rotateX: 0, rotateY: 0 };
  if (distance === 0) return { x: 0, y: 0, rotateX: 0, rotateY: 0 };

  const depthFactor = Math.min(Math.max(depth, 0) / 180, 1);
  const magneticMagnitude = Math.min(36 + depthFactor * 18, distance * 0.42) * falloff;
  const directionX = deltaX / distance;
  const directionY = deltaY / distance;
  const normalizedX = Math.min(Math.max(deltaX / (safeWidth / 2), -1), 1);
  const normalizedY = Math.min(Math.max(deltaY / (safeHeight / 2), -1), 1);
  const tilt = 3.5 + depthFactor * 12;

  return {
    x: directionX * magneticMagnitude,
    y: directionY * magneticMagnitude,
    rotateX: -normalizedY * tilt * falloff,
    rotateY: normalizedX * tilt * falloff,
  };
}

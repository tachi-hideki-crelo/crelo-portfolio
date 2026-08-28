export type CardMotionLayout = {
  x: string;
  y: string;
  rotate: string;
  z: number;
  depth: number;
  parallax: number;
};

export type OrbitalCardMotion = {
  x: number;
  y: number;
  z: number;
  rotate: number;
  progress: number;
};

export type OrbitStageVisuals = {
  opacity: number;
  scale: number;
  blur: number;
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

function smoothstep(progress: number): number {
  const clamped = clampProgress(progress);
  return clamped * clamped * (3 - 2 * clamped);
}

export function getScatterEntryProgress(
  sectionTop: number,
  stageFlowTop: number,
  viewportHeight: number,
  reduceMotion = false,
): number {
  if (reduceMotion) return 1;

  const safeHeight = Number.isFinite(viewportHeight) ? Math.max(viewportHeight, 1) : 1;
  const safeSectionTop = Number.isFinite(sectionTop) ? sectionTop : 0;
  const safeStageFlowTop = Number.isFinite(stageFlowTop)
    ? Math.max(stageFlowTop, 0)
    : safeHeight * 0.59;
  const scrolledDistance = Math.max(-safeSectionTop, 0);
  const entryStart = Math.max(safeStageFlowTop - safeHeight * 0.4, 0);
  const entryEnd = safeHeight * 0.89;
  const entryTravel = Math.max(entryEnd - entryStart, 1);

  return clampProgress((scrolledDistance - entryStart) / entryTravel);
}

export function getOrbitProgress(progress: number, index: number, reduceMotion = false): number {
  if (reduceMotion) return 1;
  const safeIndex = Math.min(Math.max(Number.isFinite(index) ? index : 0, 0), 4);
  const delay = safeIndex * 0.032;
  const normalized = clampProgress((progress - delay) / 0.82);
  return smoothstep(normalized);
}

export function getOrbitStageVisuals(progress: number, reduceMotion = false): OrbitStageVisuals {
  if (reduceMotion) return { opacity: 1, scale: 1, blur: 0 };

  const safeProgress = clampProgress(progress);
  const opacity = smoothstep(safeProgress / 0.72);
  const scaleProgress = smoothstep(safeProgress / 0.9);

  return {
    opacity,
    scale: 0.72 + scaleProgress * 0.28,
    blur: (1 - opacity) * 20,
  };
}

export function getOrbitalCardMotion({
  progress,
  index,
  targetX,
  targetY,
  targetZ,
  targetRotate,
  viewportWidth,
  viewportHeight,
  reduceMotion = false,
}: {
  progress: number;
  index: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetRotate: number;
  viewportWidth: number;
  viewportHeight: number;
  reduceMotion?: boolean;
}): OrbitalCardMotion {
  if (reduceMotion) {
    return { x: targetX, y: targetY, z: targetZ, rotate: targetRotate, progress: 1 };
  }

  const safeIndex = Math.min(Math.max(Number.isFinite(index) ? index : 0, 0), 4);
  const orbitProgress = getOrbitProgress(progress, safeIndex);
  const targetRadius = Math.hypot(targetX, targetY);
  const targetAngle = targetRadius > 0.001
    ? Math.atan2(targetY, targetX)
    : -Math.PI / 2;
  const safeViewportWidth = Number.isFinite(viewportWidth) ? Math.max(viewportWidth, 1) : 1;
  const safeViewportHeight = Number.isFinite(viewportHeight) ? Math.max(viewportHeight, 1) : 1;
  const tornadoCoreRadius = Math.min(
    Math.max(Math.min(safeViewportWidth, safeViewportHeight) * 0.095, 64),
    110,
  );
  const tornadoEnvelope = Math.sin(Math.PI * orbitProgress);
  const turns = 1.12 + safeIndex * 0.055;
  const phaseOffset = (safeIndex - 2) * ((Math.PI * 2) / 5);
  const currentAngle = targetAngle
    - (1 - orbitProgress) * Math.PI * 2 * turns
    + phaseOffset * tornadoEnvelope;
  const centerOrbit = Math.max(tornadoCoreRadius - targetRadius, 0) * tornadoEnvelope;
  const funnelRadius = tornadoCoreRadius * 0.14 * tornadoEnvelope * (1 - orbitProgress);
  const currentRadius = targetRadius * orbitProgress ** 1.12 + centerOrbit + funnelRadius;
  const depthArc = tornadoEnvelope * (
    98
    + safeIndex * 13
    + Math.cos(currentAngle + phaseOffset) * 32
  );
  const spin = (1 - orbitProgress) * (252 + safeIndex * 22);

  return {
    x: Math.cos(currentAngle) * currentRadius,
    y: Math.sin(currentAngle) * currentRadius,
    z: targetZ * orbitProgress + depthArc,
    rotate: targetRotate * orbitProgress - spin,
    progress: orbitProgress,
  };
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

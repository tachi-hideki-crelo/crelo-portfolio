export type CardMotionLayout = {
  x: string;
  y: string;
  rotate: string;
  z: number;
  depth: number;
  parallax: number;
};

export type HolographicCardMotion = {
  x: number;
  y: number;
  z: number;
  rotate: number;
  progress: number;
  scale: number;
  blur: number;
  opacity: number;
  inactiveOpacity: number;
  mediaOpacity: number;
  hologramOpacity: number;
  scanOpacity: number;
  glowOpacity: number;
};

export const CARD_ENTRY_STAGGER = 0.035;
export const CARD_ENTRY_START_Z = -480;
export const CARD_ENTRY_START_SCALE = 0.55;
export const CARD_ENTRY_START_Y_OFFSET = 0.12;

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

function safeCardIndex(index: number): number {
  return Math.min(Math.max(Number.isFinite(index) ? index : 0, 0), 4);
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

export function getCardEntryProgress(progress: number, index: number, reduceMotion = false): number {
  if (reduceMotion) return 1;
  const safeIndex = safeCardIndex(index);
  const delay = safeIndex * CARD_ENTRY_STAGGER;
  const normalized = clampProgress((progress - delay) / Math.max(1 - delay, 0.001));
  return smoothstep(normalized);
}

/**
 * A single card enters as a faint hologram, then lands in the approved layout.
 * The path is deliberately monotonic: XY moves outward, Z moves toward the
 * viewer, and the final tilt is the only rotation used by the card.
 */
export function getHolographicCardMotion({
  progress,
  index,
  targetX,
  targetY,
  targetZ,
  targetRotate,
  viewportHeight,
  reduceMotion = false,
}: {
  progress: number;
  index: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetRotate: number;
  viewportHeight: number;
  reduceMotion?: boolean;
}): HolographicCardMotion {
  const cardProgress = getCardEntryProgress(progress, index, reduceMotion);
  if (reduceMotion) {
    return {
      x: targetX,
      y: targetY,
      z: targetZ,
      rotate: targetRotate,
      progress: 1,
      scale: 1,
      blur: 0,
      opacity: 1,
      inactiveOpacity: 0.6,
      mediaOpacity: 0.72,
      hologramOpacity: 0,
      scanOpacity: 0,
      glowOpacity: 0,
    };
  }

  const safeViewportHeight = Number.isFinite(viewportHeight) ? Math.max(viewportHeight, 1) : 1;
  const landing = cardProgress >= 1 ? 1 : smoothstep(cardProgress);
  const startX = targetX * 0.15;
  const startY = targetY * 0.15 + safeViewportHeight * CARD_ENTRY_START_Y_OFFSET;
  const mediaReveal = smoothstep((cardProgress - 0.32) / 0.56);
  const hologramFade = 1 - smoothstep(cardProgress / 0.68);
  const scanFade = cardProgress >= 0.92 ? 0 : 0.82 * (1 - smoothstep(cardProgress / 0.92));
  const glowFade = 0.08 + 0.38 * (1 - smoothstep(cardProgress / 0.86));
  const revealEnvelope = smoothstep(cardProgress / 0.16);
  const opacity = revealEnvelope * (0.82 + landing * 0.18);

  return {
    x: startX + (targetX - startX) * landing,
    y: startY + (targetY - startY) * landing,
    z: CARD_ENTRY_START_Z + (targetZ - CARD_ENTRY_START_Z) * landing,
    rotate: targetRotate * landing,
    progress: cardProgress,
    scale: CARD_ENTRY_START_SCALE + (1 - CARD_ENTRY_START_SCALE) * landing,
    blur: 18 * (1 - landing),
    opacity,
    inactiveOpacity: opacity * 0.6,
    mediaOpacity: 0.72 * mediaReveal,
    hologramOpacity: hologramFade,
    scanOpacity: scanFade,
    glowOpacity: glowFade,
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

export type NormalizedTemplatePlacement = {
  x: number;
  y: number;
  z: number;
  rotate: number;
  scale: number;
};

export type TemplateBurstTransform = {
  offsetX: number;
  offsetY: number;
  z: number;
  rotate: number;
  scale: number;
  opacity: number;
  blur: number;
};

/** A deterministic field: no random values are needed during rendering. */
export const NORMALIZED_TEMPLATE_PLACEMENTS: readonly NormalizedTemplatePlacement[] = [
  { x: 0.08, y: 0.12, z: -72, rotate: -8, scale: 0.86 },
  { x: 0.28, y: 0.06, z: -18, rotate: 5, scale: 0.96 },
  { x: 0.51, y: 0.14, z: -54, rotate: -4, scale: 0.9 },
  { x: 0.77, y: 0.08, z: 6, rotate: 7, scale: 1 },
  { x: 0.94, y: 0.26, z: -38, rotate: -6, scale: 0.92 },
  { x: 0.12, y: 0.39, z: -4, rotate: 4, scale: 1.02 },
  { x: 0.36, y: 0.34, z: -62, rotate: -7, scale: 0.88 },
  { x: 0.62, y: 0.32, z: 14, rotate: 3, scale: 1.04 },
  { x: 0.86, y: 0.42, z: -28, rotate: 8, scale: 0.94 },
  { x: 0.03, y: 0.66, z: -46, rotate: -3, scale: 0.9 },
  { x: 0.25, y: 0.62, z: 12, rotate: 6, scale: 1.03 },
  { x: 0.49, y: 0.7, z: -34, rotate: -8, scale: 0.93 },
  { x: 0.72, y: 0.63, z: -8, rotate: 5, scale: 0.99 },
  { x: 0.91, y: 0.74, z: -58, rotate: -5, scale: 0.87 },
  { x: 0.57, y: 0.91, z: -22, rotate: 7, scale: 0.95 },
];

export const TEMPLATE_COUNT = NORMALIZED_TEMPLATE_PLACEMENTS.length;
export const DRAG_CLICK_SUPPRESSION_THRESHOLD = 8;

/** Positive modulo used for both camera offsets and toroidal field wrapping. */
export function modulo(value: number, modulus: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(modulus) || modulus <= 0) return 0;
  const remainder = value % modulus;
  if (Object.is(remainder, -0)) return 0;
  return remainder < 0 ? remainder + modulus : remainder;
}

/** Keep a normalized coordinate in the half-open [0, 1) interval. */
export function wrapNormalized(value: number): number {
  return modulo(value, 1);
}

/** Frame-rate independent exponential damping for camera inertia. */
export function damp(current: number, target: number, lambda: number, deltaSeconds: number): number {
  if (deltaSeconds <= 0 || lambda <= 0) return current;
  const amount = 1 - Math.exp(-lambda * Math.min(deltaSeconds, 0.25));
  return current + (target - current) * amount;
}

export function dragDistance(startX: number, startY: number, currentX: number, currentY: number): number {
  return Math.hypot(currentX - startX, currentY - startY);
}

export function hasExceededDragThreshold(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  threshold = DRAG_CLICK_SUPPRESSION_THRESHOLD,
): boolean {
  return dragDistance(startX, startY, currentX, currentY) >= threshold;
}

export function getTemplatePlacement(index: number): NormalizedTemplatePlacement {
  const safeIndex = Math.min(Math.max(Math.round(index), 0), TEMPLATE_COUNT - 1);
  return NORMALIZED_TEMPLATE_PLACEMENTS[safeIndex] ?? NORMALIZED_TEMPLATE_PLACEMENTS[0];
}

/**
 * Pure burst geometry: every card starts at the same vanishing point, makes
 * a short deterministic spiral, and settles on its normalized field slot.
 */
export function getTemplateBurstTransform(index: number, progress: number): TemplateBurstTransform {
  const placement = getTemplatePlacement(index);
  const clamped = Math.max(0, Math.min(1, progress));
  const angle = (index * 0.73) + placement.rotate * (Math.PI / 180);
  const orbitStrength = Math.sin(clamped * Math.PI) * 0.16;
  const spiralAngle = angle + (1 - clamped) * 4.5;
  return {
    offsetX: Math.cos(spiralAngle) * orbitStrength,
    offsetY: Math.sin(spiralAngle) * orbitStrength,
    z: -180 + (placement.z + 180) * clamped,
    rotate: placement.rotate + (index % 2 === 0 ? 24 : -24) * (1 - clamped),
    scale: 0.56 + (placement.scale - 0.56) * clamped,
    opacity: clamped,
    blur: (1 - clamped) * 11,
  };
}

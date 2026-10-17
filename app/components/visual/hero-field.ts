import { clamp01, expoOut, type HeroTimelineState } from '../site/hero-timeline.ts';

/**
 * Pure math shared by the WebGL field, its Canvas2D annotation layer and the
 * static fallback. The GLSL in HeroCosmosCanvas mirrors these functions and
 * interpolates the constants below, so keep both sides in lockstep.
 */

export const HERO_FIELD_PALETTE = {
  background: '#05080b',
  ink: '#f3f6f3',
  mint: '#a6ffdb',
  amber: '#ffc779',
} as const;

export const FIELD_SCAN_PERIOD_SECONDS = 6;
export const FIELD_SPAN_X = 1.6;
export const FIELD_SPAN_Z = 0.95;
export const FIELD_AMPLITUDE = 0.22;
export const FIELD_TERRACE_STEP = 0.06;
/** How far behind the left edge the right edge starts ordering (0..1). */
export const FIELD_ORDER_STAGGER = 0.55;
export const FIELD_ORDER_WINDOW = 0.45;

/** Observation tags as [column, row] fractions of the grid. */
export const FIELD_TAGS: ReadonlyArray<readonly [number, number]> = [
  [0.113, 0.77],
  [0.268, 0.31],
  [0.437, 0.64],
  [0.62, 0.23],
  [0.775, 0.56],
  [0.901, 0.15],
];

export type HeroFieldTier = 'pc' | 'tablet' | 'mobile' | 'static';

export type FieldTierConfig = {
  columns: number;
  rows: number;
  dpr: number;
  /** Draw OBS labels next to the tag crosshairs. */
  labels: boolean;
  /** Multiplier on the timeline's lateral travel. */
  travel: number;
  scaleByHeight: number;
  scaleByWidth: number;
  /** Added to the timeline's horizon position (fraction of height). */
  horizonShift: number;
};

export const FIELD_TIERS: Record<HeroFieldTier, FieldTierConfig> = {
  pc: { columns: 132, rows: 72, dpr: 1.6, labels: true, travel: 1, scaleByHeight: 1.05, scaleByWidth: 0.62, horizonShift: 0 },
  tablet: { columns: 96, rows: 54, dpr: 1.3, labels: true, travel: 0.8, scaleByHeight: 1, scaleByWidth: 0.72, horizonShift: 0.03 },
  mobile: { columns: 64, rows: 44, dpr: 1, labels: false, travel: 0.35, scaleByHeight: 0.82, scaleByWidth: 1.1, horizonShift: 0.1 },
  // The static poster is placed by staticFieldPlacement, not by the scroll
  // travel or scale below.
  static: { columns: 72, rows: 40, dpr: 1, labels: true, travel: 0, scaleByHeight: 1, scaleByWidth: 0, horizonShift: 0 },
};

export type FieldView = {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  pitch: number;
  yaw: number;
  distance: number;
};

export type ProjectedFieldPoint = { x: number; y: number; depth: number };

export function fieldGridCoordinate(index: number, count: number): number {
  return count <= 1 ? 0 : (index / (count - 1)) * 2 - 1;
}

export function fieldCellSeed(column: number, row: number): number {
  return ((column * 7 + row * 13) % 10) / 10;
}

/** Undulating terrain in [-1, 1]; the unstructured "field" before ordering. */
export function fieldSurfaceHeight(x: number, z: number, time: number): number {
  return Math.sin(x * 3.1 + time * 0.15) * 0.5
    + Math.sin(z * 4.3 - time * 0.11 + x * 1.7) * 0.35
    + Math.sin((x + z) * 7.2 + time * 0.2) * 0.15;
}

/** Local ordering amount for a point: a wave that starts at the left edge. */
export function fieldPointOrder(order: number, x: number): number {
  if (order >= 1) return 1;
  const delay = (x + 1) * 0.5 * FIELD_ORDER_STAGGER;
  return expoOut((order - delay) / FIELD_ORDER_WINDOW);
}

/** Height of one grid point: terrain → terraces → flat grid → falling away. */
export function fieldPointHeight(x: number, z: number, time: number, order: number, dissolve: number, seed: number): number {
  const local = fieldPointOrder(order, x);
  const raw = fieldSurfaceHeight(x, z, time) * FIELD_AMPLITUDE * (1 - dissolve * 0.5);
  const terrace = Math.round(raw / FIELD_TERRACE_STEP) * FIELD_TERRACE_STEP;
  const shaped = (raw + (terrace - raw) * clamp01(local * 2)) * (1 - local);
  return shaped - dissolve * (0.4 + seed * 0.8);
}

export function fieldScanAt(time: number): number {
  const cycle = time / FIELD_SCAN_PERIOD_SECONDS;
  return (cycle - Math.floor(cycle)) * 2.6 - 1.3;
}

export function projectFieldPoint(x: number, y: number, z: number, view: FieldView): ProjectedFieldPoint | null {
  const worldX = x * FIELD_SPAN_X;
  const worldZ = z * FIELD_SPAN_Z;
  const cosYaw = Math.cos(view.yaw);
  const sinYaw = Math.sin(view.yaw);
  const x1 = worldX * cosYaw - worldZ * sinYaw;
  const z1 = worldX * sinYaw + worldZ * cosYaw;
  const cosPitch = Math.cos(view.pitch);
  const sinPitch = Math.sin(view.pitch);
  // Camera above the ground, pitched down: far rows rise toward the horizon.
  const y2 = y * cosPitch + z1 * sinPitch;
  const z2 = z1 * cosPitch - y * sinPitch;
  const depth = z2 + view.distance;
  if (depth < 0.1) return null;
  const focal = view.scale / depth;
  return {
    x: view.width * (0.5 + view.offsetX) + x1 * focal,
    y: view.height * view.offsetY - y2 * focal,
    depth,
  };
}

export function fieldViewFor(width: number, height: number, tier: FieldTierConfig, state: HeroTimelineState): FieldView {
  return {
    width,
    height,
    scale: Math.max(height * tier.scaleByHeight, width * tier.scaleByWidth),
    offsetX: state.fieldOffsetX * tier.travel,
    offsetY: state.fieldOffsetY + tier.horizonShift,
    pitch: state.cameraPitch,
    yaw: state.cameraYaw,
    distance: state.cameraDistance,
  };
}

export function fieldTagCells(columns: number, rows: number): Array<[number, number]> {
  return FIELD_TAGS.map(([u, v]) => [Math.round(u * (columns - 1)), Math.round(v * (rows - 1))]);
}

/**
 * Manhattan route from the left edge, through every tag in order, out of the
 * right edge. Each step changes either the column or the row, never both.
 */
export function buildFieldRoute(cells: ReadonlyArray<readonly [number, number]>, columns: number): Array<[number, number]> {
  if (cells.length === 0) return [];
  const route: Array<[number, number]> = [[0, cells[0][1]]];
  cells.forEach(([column, row], index) => {
    if (index > 0) route.push([column, cells[index - 1][1]]);
    route.push([column, row]);
  });
  route.push([columns - 1, cells[cells.length - 1][1]]);
  return route;
}

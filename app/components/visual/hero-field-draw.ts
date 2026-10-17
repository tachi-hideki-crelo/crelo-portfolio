import { clamp01, getHeroTimeline, type HeroTimelineState } from '../site/hero-timeline.ts';
import {
  buildFieldRoute,
  fieldCellSeed,
  fieldGridCoordinate,
  fieldPointHeight,
  type FieldGridConfig,
  fieldTagCells,
  type FieldView,
  projectFieldPoint,
  type ProjectedFieldPoint,
  STATIC_FIELD_GRID,
} from './hero-field.ts';

type AnnotationOptions = {
  columns: number;
  rows: number;
  time: number;
  labels: boolean;
  fontFamily: string;
};

type FieldLayout = {
  tags: Array<[number, number]>;
  route: Array<[number, number]>;
};

// Tag cells and the route depend only on the grid size, so build them once
// per tier instead of on every animation frame.
const layoutCache = new Map<string, FieldLayout>();

function fieldLayout(columns: number, rows: number): FieldLayout {
  const key = `${columns}x${rows}`;
  let layout = layoutCache.get(key);
  if (!layout) {
    const tags = fieldTagCells(columns, rows);
    layout = { tags, route: buildFieldRoute(tags, columns) };
    layoutCache.set(key, layout);
  }
  return layout;
}

function projectCell(column: number, row: number, view: FieldView, state: HeroTimelineState, options: AnnotationOptions): ProjectedFieldPoint | null {
  const x = fieldGridCoordinate(column, options.columns);
  const z = fieldGridCoordinate(row, options.rows);
  const y = fieldPointHeight(x, z, options.time, state.order, state.dissolve, fieldCellSeed(column, row));
  return projectFieldPoint(x, y, z, view);
}

function drawCrosshair(context: CanvasRenderingContext2D, x: number, y: number) {
  const arm = 7;
  const gap = 3;
  context.beginPath();
  context.moveTo(x - arm, y);
  context.lineTo(x - gap, y);
  context.moveTo(x + gap, y);
  context.lineTo(x + arm, y);
  context.moveTo(x, y - arm);
  context.lineTo(x, y - gap);
  context.moveTo(x, y + gap);
  context.lineTo(x, y + arm);
  context.stroke();
}

/**
 * Draws the tagged observations and the route on top of the point field.
 * Expects a context already scaled to CSS pixels; the caller clears it.
 */
export function drawFieldAnnotations(context: CanvasRenderingContext2D, view: FieldView, state: HeroTimelineState, options: AnnotationOptions) {
  const visible = 1 - state.dissolve;
  if (visible <= 0) return;
  const layout = fieldLayout(options.columns, options.rows);

  if (state.tagReveal > 0) {
    context.lineWidth = 1;
    context.font = `10px ${options.fontFamily}`;
    layout.tags.forEach(([column, row], index) => {
      const point = projectCell(column, row, view, state, options);
      if (!point) return;
      const alpha = clamp01(state.tagReveal * 1.4 - index * 0.08) * visible;
      if (alpha <= 0) return;
      context.strokeStyle = `rgba(166, 255, 219, ${alpha})`;
      drawCrosshair(context, point.x, point.y);
      if (!options.labels) return;
      context.fillStyle = `rgba(154, 168, 164, ${alpha * (1 - state.route * 0.6)})`;
      context.fillText(`OBS/${String(index + 1).padStart(2, '0')}`, point.x + 9, point.y - 8);
    });
  }

  if (state.route <= 0) return;
  const route: ProjectedFieldPoint[] = [];
  let total = 0;
  for (const [column, row] of layout.route) {
    const point = projectCell(column, row, view, state, options);
    if (!point) continue;
    const previous = route[route.length - 1];
    if (previous) total += Math.hypot(point.x - previous.x, point.y - previous.y);
    route.push(point);
  }
  if (route.length < 2) return;
  // The statement draws most of the route; the CTA act extends it out of frame.
  let remaining = total * (state.route * 0.82 + (1 - state.route * 0.82) * state.ship);
  let headX = route[0].x;
  let headY = route[0].y;
  context.strokeStyle = `rgba(255, 199, 121, ${0.95 * visible})`;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(headX, headY);
  for (let index = 1; index < route.length && remaining > 0; index += 1) {
    const from = route[index - 1];
    const to = route[index];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const amount = length > 0 ? Math.min(1, remaining / length) : 1;
    headX = from.x + (to.x - from.x) * amount;
    headY = from.y + (to.y - from.y) * amount;
    context.lineTo(headX, headY);
    remaining -= length;
  }
  context.stroke();
  context.fillStyle = `rgba(255, 199, 121, ${visible})`;
  context.fillRect(headX - 2.5, headY - 2.5, 5, 5);
}

/** Progress used for the condensed, non-scrolling Hero: structured field, finished route. */
export const STATIC_FIELD_PROGRESS = 0.8;

export type StaticFieldPlacement = { offsetX: number; offsetY: number; scale: number };

/** Where the condensed copy sits, in CSS px relative to the static canvas. */
export type StaticCopyBounds = { statementBottom: number; ctaTop: number; ctaRight: number };

const STATIC_MARGIN = 16;

/** Used before layout can be measured: copy roughly where the wide layout puts it. */
function fallbackCopyBounds(width: number, height: number): StaticCopyBounds {
  return { statementBottom: height * 0.78, ctaTop: height * 0.9, ctaRight: width * 0.25 };
}

/** How far the flat field reaches above, below and beside its centre per unit of scale. */
function fieldExtentsPerScale(state: HeroTimelineState) {
  const view: FieldView = { width: 0, height: 0, scale: 1, offsetX: 0, offsetY: 0, pitch: state.cameraPitch, yaw: state.cameraYaw, distance: state.cameraDistance };
  let above = 0;
  let below = 0;
  let side = 0;
  for (const x of [-1, 1]) {
    for (const z of [-1, 1]) {
      const point = projectFieldPoint(x, 0, z, view);
      if (!point) continue;
      above = Math.max(above, -point.y);
      below = Math.max(below, point.y);
      side = Math.max(side, Math.abs(point.x));
    }
  }
  return { above, below, side };
}

/**
 * Places the condensed Hero's field in the free band below its statement.
 * A CTA that reaches past the centre (the phone layout) closes that band from
 * below; a short CTA at the left (the wide layout) only pushes the field to
 * its right, and the field may bleed off the bottom edge.
 */
export function staticFieldPlacement(width: number, height: number, copy: StaticCopyBounds, state: HeroTimelineState = getHeroTimeline(STATIC_FIELD_PROGRESS)): StaticFieldPlacement {
  const extents = fieldExtentsPerScale(state);
  const ctaBlocksBand = copy.ctaRight > width * 0.55;
  const bandTop = copy.statementBottom + STATIC_MARGIN;
  const bandBottom = ctaBlocksBand ? copy.ctaTop - STATIC_MARGIN : height * 1.04;
  const byHeight = Math.max(0, bandBottom - bandTop) / (extents.above + extents.below);
  const byWidth = (width * (ctaBlocksBand ? 1 : 0.33)) / extents.side;
  const scale = Math.min(byHeight, byWidth);
  const centreX = ctaBlocksBand ? width / 2 : copy.ctaRight + STATIC_MARGIN * 2 + extents.side * scale;
  return { offsetX: centreX / width - 0.5, offsetY: (bandTop + extents.above * scale) / height, scale };
}

export function drawStaticField(context: CanvasRenderingContext2D, width: number, height: number, dpr: number, fontFamily: string, copy: StaticCopyBounds | null, grid: FieldGridConfig = STATIC_FIELD_GRID) {
  const state = getHeroTimeline(STATIC_FIELD_PROGRESS);
  const view: FieldView = {
    width,
    height,
    ...staticFieldPlacement(width, height, copy ?? fallbackCopyBounds(width, height), state),
    pitch: state.cameraPitch,
    yaw: state.cameraYaw,
    distance: state.cameraDistance,
  };
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const x = fieldGridCoordinate(column, grid.columns);
      const z = fieldGridCoordinate(row, grid.rows);
      const point = projectFieldPoint(x, fieldPointHeight(x, z, 0, state.order, 0, 0), z, view);
      if (!point) continue;
      const depth = clamp01(1.4 - point.depth * 0.3);
      const size = Math.max(1, 3.6 / point.depth);
      context.fillStyle = `rgba(166, 255, 219, ${(0.22 + depth * 0.38).toFixed(3)})`;
      context.fillRect(point.x - size / 2, point.y - size / 2, size, size);
    }
  }
  drawFieldAnnotations(context, view, state, { columns: grid.columns, rows: grid.rows, time: 0, labels: grid.labels, fontFamily });
}

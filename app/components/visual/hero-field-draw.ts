import { getHeroTimeline, type HeroTimelineState } from '../site/hero-timeline';
import {
  buildFieldRoute,
  FIELD_TIERS,
  fieldCellSeed,
  fieldGridCoordinate,
  fieldPointHeight,
  fieldTagCells,
  fieldViewFor,
  type FieldTierConfig,
  type FieldView,
  projectFieldPoint,
  type ProjectedFieldPoint,
} from './hero-field';

type AnnotationOptions = {
  columns: number;
  rows: number;
  time: number;
  labels: boolean;
  fontFamily: string;
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
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
  const cells = fieldTagCells(options.columns, options.rows);
  const tags = cells.map(([column, row]) => projectCell(column, row, view, state, options));

  if (state.tagReveal > 0) {
    context.lineWidth = 1;
    context.font = `10px ${options.fontFamily}`;
    tags.forEach((point, index) => {
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
  const route = buildFieldRoute(cells, options.columns)
    .map(([column, row]) => projectCell(column, row, view, state, options))
    .filter((point): point is ProjectedFieldPoint => point !== null);
  if (route.length < 2) return;
  const lengths = route.slice(1).map((point, index) => Math.hypot(point.x - route[index].x, point.y - route[index].y));
  const total = lengths.reduce((sum, length) => sum + length, 0);
  // The statement draws most of the route; the CTA act extends it out of frame.
  let remaining = total * (state.route * 0.82 + (1 - state.route * 0.82) * state.ship);
  let headX = route[0].x;
  let headY = route[0].y;
  context.strokeStyle = `rgba(255, 199, 121, ${0.95 * visible})`;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(headX, headY);
  for (let index = 1; index < route.length && remaining > 0; index += 1) {
    const length = lengths[index - 1];
    const amount = length > 0 ? Math.min(1, remaining / length) : 1;
    headX = route[index - 1].x + (route[index].x - route[index - 1].x) * amount;
    headY = route[index - 1].y + (route[index].y - route[index - 1].y) * amount;
    context.lineTo(headX, headY);
    remaining -= length;
  }
  context.stroke();
  context.fillStyle = `rgba(255, 199, 121, ${visible})`;
  context.fillRect(headX - 2.5, headY - 2.5, 5, 5);
}

/** Progress used for the condensed, non-scrolling Hero: structured field, finished route. */
export const STATIC_FIELD_PROGRESS = 0.8;

export function drawStaticField(context: CanvasRenderingContext2D, width: number, height: number, dpr: number, fontFamily: string, tier: FieldTierConfig = FIELD_TIERS.static) {
  const state = { ...getHeroTimeline(STATIC_FIELD_PROGRESS), fieldOffsetX: 0.08 };
  const view = fieldViewFor(width, height, tier, state);
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  for (let row = 0; row < tier.rows; row += 1) {
    for (let column = 0; column < tier.columns; column += 1) {
      const x = fieldGridCoordinate(column, tier.columns);
      const z = fieldGridCoordinate(row, tier.rows);
      const point = projectFieldPoint(x, fieldPointHeight(x, z, 0, state.order, 0, 0), z, view);
      if (!point) continue;
      const depth = clamp01(1.4 - point.depth * 0.3);
      const size = Math.max(1, 3.6 / point.depth);
      context.fillStyle = `rgba(166, 255, 219, ${(0.22 + depth * 0.38).toFixed(3)})`;
      context.fillRect(point.x - size / 2, point.y - size / 2, size, size);
    }
  }
  drawFieldAnnotations(context, view, state, { columns: tier.columns, rows: tier.rows, time: 0, labels: tier.labels, fontFamily });
}

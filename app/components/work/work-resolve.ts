/**
 * Geometry for the "resolve" band: one open slice shows the case media while
 * the closed slices show the same media as a halftone point field.
 */
export const RESOLVE_GROW = 7;

export type SliceWidths = {
  open: number;
  closed: number;
};

export function getSliceWidths({
  bandWidth,
  count,
  gap,
}: {
  bandWidth: number;
  count: number;
  gap: number;
}): SliceWidths {
  if (bandWidth <= 0 || count <= 0) return { open: 0, closed: 0 };
  if (count === 1) return { open: bandWidth, closed: 0 };
  const content = bandWidth - gap * (count - 1);
  const closed = content / (RESOLVE_GROW + count - 1);
  return { open: closed * RESOLVE_GROW, closed };
}

/**
 * Manhattan lead from the bottom edge of the active slice down into the info
 * row, echoing the amber route that closes the hero.
 */
export function getLeadPath({
  activeIndex,
  widths,
  gap,
  inset,
  depth,
}: {
  activeIndex: number;
  widths: SliceWidths;
  gap: number;
  inset: number;
  depth: number;
}): string {
  const x = activeIndex * (widths.closed + gap) + inset + 0.5;
  return `M${x} 0 V${Math.round(depth * 0.43)} H0.5 V${depth}`;
}

/**
 * Luminance (0-1) to a dot. Highlights are compressed so bright screenshots do
 * not turn into solid mint blocks; dark areas keep a faint grid.
 */
export function getHalftoneDot(luminance: number, step: number): { radius: number; alpha: number } {
  const clamped = Math.min(Math.max(luminance, 0), 1);
  const tone = clamped ** 1.7;
  return {
    radius: Math.max(0.5, tone * step * 0.36),
    alpha: 0.12 + tone * 0.42,
  };
}

export type TemplateGalleryPhase = 'title' | 'reveal' | 'burst' | 'explore' | 'settle';

export type TemplateGalleryTimeline = {
  progress: number;
  phase: TemplateGalleryPhase;
  titleOpacity: number;
  bodyOpacity: number;
  ctaOpacity: number;
  cueOpacity: number;
  burst: number;
  compact: number;
  explore: number;
  settle: number;
  scrollCueOpacity: number;
};

export const TEMPLATE_GALLERY_TITLE_END = 0.12;
export const TEMPLATE_GALLERY_REVEAL_END = 0.24;
export const TEMPLATE_GALLERY_BURST_START = 0.18;
export const TEMPLATE_GALLERY_BURST_END = 0.48;
export const TEMPLATE_GALLERY_COMPACT_END = 0.6;
export const TEMPLATE_GALLERY_EXPLORE_END = 0.86;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function segment(value: number, start: number, end: number): number {
  if (end <= start) return value >= end ? 1 : 0;
  return smoothstep((value - start) / (end - start));
}

export function templateGalleryPhaseAt(progress: number): TemplateGalleryPhase {
  const value = clamp01(progress);
  if (value < TEMPLATE_GALLERY_TITLE_END) return 'title';
  if (value < TEMPLATE_GALLERY_BURST_START) return 'reveal';
  if (value < TEMPLATE_GALLERY_BURST_END) return 'burst';
  if (value < TEMPLATE_GALLERY_EXPLORE_END) return 'explore';
  return 'settle';
}

/** Pure source of truth for the 300vh sticky gallery choreography. */
export function getTemplateGalleryTimeline(progress: number, reduceMotion = false): TemplateGalleryTimeline {
  const value = clamp01(progress);
  if (reduceMotion) {
    return {
      progress: value,
      phase: 'settle',
      titleOpacity: 1,
      bodyOpacity: 1,
      ctaOpacity: 1,
      cueOpacity: 1,
      burst: 0,
      compact: 0,
      explore: 1,
      settle: 1,
      scrollCueOpacity: 1,
    };
  }

  const reveal = segment(value, TEMPLATE_GALLERY_TITLE_END, TEMPLATE_GALLERY_REVEAL_END);
  const burst = segment(value, TEMPLATE_GALLERY_BURST_START, TEMPLATE_GALLERY_BURST_END);
  const compact = segment(value, TEMPLATE_GALLERY_BURST_END, TEMPLATE_GALLERY_COMPACT_END);
  const explore = segment(value, TEMPLATE_GALLERY_BURST_END, TEMPLATE_GALLERY_EXPLORE_END);
  const settle = segment(value, TEMPLATE_GALLERY_EXPLORE_END, 1);

  return {
    progress: value,
    phase: templateGalleryPhaseAt(value),
    titleOpacity: 1,
    bodyOpacity: reveal,
    ctaOpacity: reveal,
    cueOpacity: reveal,
    burst,
    compact,
    explore,
    settle,
    scrollCueOpacity: settle,
  };
}

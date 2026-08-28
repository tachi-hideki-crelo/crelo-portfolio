export const METHOD_CARD_COUNT = 4;
export const METHOD_SPREAD_START = 0.08;
export const METHOD_SPREAD_END = 0.66;
export const METHOD_SETTLE_END = 0.92;

export type MethodStageTimeline = {
  progress: number;
  spread: number;
  settle: number;
  atmosphere: number;
};

export type MethodCardTimeline = MethodStageTimeline & {
  x: number;
  y: number;
  z: number;
  rotate: number;
  yaw: number;
  opacity: number;
};

export type MethodHoverTimeline = {
  pushX: number;
  liftY: number;
  liftZ: number;
  scale: number;
  opacity: number;
};

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function smoothstep(start: number, end: number, value: number): number {
  const progress = clamp01((value - start) / Math.max(end - start, Number.EPSILON));
  return progress * progress * (3 - 2 * progress);
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

export function getMethodStageTimeline(
  progress: number,
  reduceMotion = false,
): MethodStageTimeline {
  const clamped = clamp01(progress);
  if (reduceMotion) {
    return { progress: clamped, spread: 1, settle: 1, atmosphere: 1 };
  }

  return {
    progress: clamped,
    spread: smoothstep(METHOD_SPREAD_START, METHOD_SPREAD_END, clamped),
    settle: smoothstep(METHOD_SPREAD_END, METHOD_SETTLE_END, clamped),
    atmosphere: smoothstep(0.02, 0.2, clamped),
  };
}

export function getMethodCardTimeline({
  progress,
  index,
  viewportWidth,
  reduceMotion = false,
}: {
  progress: number;
  index: number;
  viewportWidth: number;
  reduceMotion?: boolean;
}): MethodCardTimeline {
  const cardIndex = Math.min(Math.max(Math.round(index), 0), METHOD_CARD_COUNT - 1);
  const stage = getMethodStageTimeline(progress, reduceMotion);
  const offset = cardIndex - (METHOD_CARD_COUNT - 1) / 2;
  const direction = Math.sign(offset);
  const distance = Math.abs(offset);
  const spacing = Math.min(Math.max(viewportWidth * 0.238, 232), 340);
  const startX = offset * 11;
  const endX = offset * spacing + direction * stage.settle * 12;
  const startRotate = [-7.2, -2.6, 2.6, 7.2][cardIndex] ?? 0;
  const endRotate = [-2.4, -0.75, 0.75, 2.4][cardIndex] ?? 0;
  const endYaw = direction * -lerp(4.5, 13.5, distance / 1.5);

  return {
    ...stage,
    x: lerp(startX, endX, stage.spread),
    y: lerp(104 + distance * 8, -stage.settle * (4 + distance * 2), stage.spread),
    z: lerp(-cardIndex * 26, -distance * 13, stage.spread),
    rotate: lerp(startRotate, endRotate + direction * stage.settle * 0.45, stage.spread),
    yaw: lerp(0, endYaw, stage.spread),
    opacity: lerp(0.82, 1, smoothstep(0, 0.18, stage.progress)),
  };
}

export function getMethodHoverTimeline(
  index: number,
  activeIndex: number | null,
): MethodHoverTimeline {
  if (activeIndex === null) {
    return { pushX: 0, liftY: 0, liftZ: 0, scale: 1, opacity: 1 };
  }

  if (index === activeIndex) {
    return { pushX: 0, liftY: -16, liftZ: 72, scale: 1.035, opacity: 1 };
  }

  const direction = index < activeIndex ? -1 : 1;
  const distance = Math.abs(index - activeIndex);
  return {
    pushX: direction * (10 + distance * 5),
    liftY: 5 + distance * 2,
    liftZ: -22 - distance * 8,
    scale: 0.985,
    opacity: 0.66,
  };
}

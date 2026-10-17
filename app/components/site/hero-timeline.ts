export type HeroPhase =
  | 'field'
  | 'fde'
  | 'hold'
  | 'transfer'
  | 'statement'
  | 'cta'
  | 'dissolve';

export type HeroTimelineState = {
  phase: HeroPhase;
  fieldOffsetX: number;
  fieldOffsetY: number;
  cameraPitch: number;
  cameraYaw: number;
  cameraDistance: number;
  tagReveal: number;
  order: number;
  route: number;
  ship: number;
  fdeOpacity: number;
  statementOpacity: number;
  statementFirstOpacity: number;
  statementSecondOpacity: number;
  ctaOpacity: number;
  coordinateOpacity: number;
  dissolve: number;
};

export type HeroFormationState = {
  rowReveal: number;
  fieldLight: number;
};

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function segment(value: number, start: number, end: number): number {
  if (end <= start) return value >= end ? 1 : 0;
  return clamp01((value - start) / (end - start));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

export function expoOut(value: number): number {
  const t = clamp01(value);
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function heroPhaseAt(progress: number): HeroPhase {
  const value = clamp01(progress);
  if (value < 0.14) return 'field';
  if (value < 0.34) return 'fde';
  if (value < 0.47) return 'hold';
  if (value < 0.6) return 'transfer';
  if (value < 0.8) return 'statement';
  if (value < 0.94) return 'cta';
  return 'dissolve';
}

export function getHeroFormationTimeline(progress: number): HeroFormationState {
  const value = clamp01(progress);
  // The intro hands over to a genuinely empty Hero. The point field is laid in
  // row by row from the horizon, then its light settles. This entrance is
  // time-driven and stays independent from the longer scroll story below.
  return {
    rowReveal: smoothstep(segment(value, 0.02, 0.7)),
    fieldLight: smoothstep(segment(value, 0.25, 1)),
  };
}

/**
 * Single source of truth for the long-form Hero choreography.
 * Keep this function pure: the R3F scene reads it in useFrame and the HTML
 * layer reads the same values through MotionValue transforms.
 */
export function getHeroTimeline(progress: number): HeroTimelineState {
  const value = clamp01(progress);
  const phase = heroPhaseAt(value);
  const fdeIn = smoothstep(segment(value, 0.14, 0.22));
  // The English copy has fully yielded by the midpoint checkpoint while the
  // field continues its leftward travel through 0.62.
  const fdeOut = smoothstep(segment(value, 0.47, 0.52));
  const statementFirstIn = smoothstep(segment(value, 0.58, 0.68));
  const statementSecondIn = smoothstep(segment(value, 0.62, 0.72));
  const statementIn = Math.max(statementFirstIn, statementSecondIn);
  const statementOut = smoothstep(segment(value, 0.94, 1));
  const ctaIn = smoothstep(segment(value, 0.8, 0.86));
  const ctaOut = smoothstep(segment(value, 0.94, 1));
  const dissolve = smoothstep(segment(value, 0.94, 1));
  const ship = smoothstep(segment(value, 0.8, 0.94));

  // The field starts on-axis, slides right while the English title reads,
  // then crosses left for the Japanese statement. The CTA act raises the
  // camera to an overhead, blueprint-like view of the finished route.
  const rightTravel = smoothstep(segment(value, 0.14, 0.34));
  const leftTravel = smoothstep(segment(value, 0.47, 0.62));

  return {
    phase,
    // While the right-aligned statement reads, the field stays left of it and
    // drops below its baseline so the route never runs under the copy.
    fieldOffsetX: rightTravel * 0.2 - leftTravel * 0.42,
    fieldOffsetY: lerp(lerp(0.62, 0.7, leftTravel), 0.6, ship),
    cameraPitch: lerp(0.32, 1.18, ship) + dissolve * 0.2,
    cameraYaw: lerp(0, -0.22, rightTravel) + leftTravel * 0.3 - ship * 0.08,
    cameraDistance: lerp(3.1, 2.7, rightTravel) + ship * 0.5,
    // Observations are tagged while the title reads, the field is structured
    // during the transfer, and the route is drawn under the statement.
    tagReveal: smoothstep(segment(value, 0.16, 0.3)),
    order: segment(value, 0.47, 0.6),
    route: expoOut(segment(value, 0.6, 0.8)),
    ship,
    fdeOpacity: fdeIn * (1 - fdeOut),
    statementOpacity: statementIn * (1 - statementOut),
    statementFirstOpacity: statementFirstIn * (1 - statementOut),
    statementSecondOpacity: statementSecondIn * (1 - statementOut),
    ctaOpacity: ctaIn * (1 - ctaOut),
    // Keep the opening act visually pure: telemetry labels only enter after
    // the field-only window has completed.
    coordinateOpacity: smoothstep(segment(value, 0.14, 0.18)),
    dissolve,
  };
}

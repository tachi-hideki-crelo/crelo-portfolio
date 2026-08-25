export type HeroPhase =
  | 'sphere'
  | 'fde'
  | 'hold'
  | 'transfer'
  | 'statement'
  | 'cta'
  | 'dissolve';

export type HeroTimelineState = {
  phase: HeroPhase;
  sphereX: number;
  sphereY: number;
  sphereScale: number;
  sphereRotationX: number;
  sphereRotationY: number;
  sphereRotationZ: number;
  cameraYaw: number;
  cameraPitch: number;
  cameraRoll: number;
  fdeOpacity: number;
  statementOpacity: number;
  statementFirstOpacity: number;
  statementSecondOpacity: number;
  ctaOpacity: number;
  coordinateOpacity: number;
  dissolve: number;
  particleOpacity: number;
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

export function heroPhaseAt(progress: number): HeroPhase {
  const value = clamp01(progress);
  if (value < 0.14) return 'sphere';
  if (value < 0.34) return 'fde';
  if (value < 0.47) return 'hold';
  if (value < 0.6) return 'transfer';
  if (value < 0.8) return 'statement';
  if (value < 0.94) return 'cta';
  return 'dissolve';
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
  // sphere continues its leftward arc through 0.60.
  const fdeOut = smoothstep(segment(value, 0.47, 0.52));
  const statementFirstIn = smoothstep(segment(value, 0.58, 0.68));
  const statementSecondIn = smoothstep(segment(value, 0.62, 0.72));
  const statementIn = Math.max(statementFirstIn, statementSecondIn);
  const statementOut = smoothstep(segment(value, 0.94, 1));
  const ctaIn = smoothstep(segment(value, 0.8, 0.86));
  const ctaOut = smoothstep(segment(value, 0.94, 1));
  const grandAngle = smoothstep(segment(value, 0.8, 0.94));
  const journey = smoothstep(segment(value, 0, 0.94));
  const dissolve = smoothstep(segment(value, 0.94, 1));

  // The sphere starts on-axis, moves right for the English introduction, then
  // traces a shallow leftward arc as the Japanese field statement takes over.
  const rightTravel = smoothstep(segment(value, 0.14, 0.34));
  const leftArc = smoothstep(segment(value, 0.47, 0.6));
  const sphereX = lerp(0, 0.68, rightTravel) + lerp(0, -1.26, leftArc);
  const sphereY = lerp(0, 0.08, rightTravel) + Math.sin(leftArc * Math.PI) * 0.18;

  return {
    phase,
    sphereX,
    sphereY,
    sphereScale: (1 + journey * 0.08 + Math.sin(value * Math.PI * 2.4) * 0.025) * lerp(1, 1.18, dissolve),
    // The cosmos is already in motion during the introduction. The final
    // angle change is an accent layered on top of the continuous journey.
    sphereRotationX: 0.12 + journey * 0.76 + Math.sin(value * Math.PI * 3.2) * 0.16 + grandAngle * 0.34 + dissolve * 0.42,
    sphereRotationY: -0.18 + journey * 1.08 + value * 1.18 + grandAngle * 0.42 + dissolve * 1.8,
    sphereRotationZ: -0.08 + journey * 0.36 + Math.sin(value * Math.PI * 2.1) * 0.1 + grandAngle * 0.28 + dissolve * 1.2,
    cameraYaw: journey * -0.12 + grandAngle * -0.3 + dissolve * 0.24,
    cameraPitch: journey * 0.08 + grandAngle * 0.18 + dissolve * 0.18,
    cameraRoll: journey * -0.025 + grandAngle * -0.075 + dissolve * 0.12,
    fdeOpacity: fdeIn * (1 - fdeOut),
    statementOpacity: statementIn * (1 - statementOut),
    statementFirstOpacity: statementFirstIn * (1 - statementOut),
    statementSecondOpacity: statementSecondIn * (1 - statementOut),
    ctaOpacity: ctaIn * (1 - ctaOut),
    // Keep the opening act visually pure: telemetry labels only enter after
    // the sphere-only window has completed.
    coordinateOpacity: smoothstep(segment(value, 0.14, 0.18)),
    dissolve,
    particleOpacity: 0.58 + dissolve * 0.42,
  };
}

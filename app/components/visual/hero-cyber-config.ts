export const HERO_CYBER_PALETTE = {
  dark: '#050812',
  cyan: '#70E9FF',
  violet: '#9E72FF',
  gold: '#FFD24A',
} as const;

export const CORE_BREATH_PERIOD_SECONDS = 8;
export const CIRCUIT_SCAN_PERIOD_SECONDS = 6;
export const RING_PERIODS = [45, 70, 95] as const;
export const RING_DIRECTIONS = [1, -1, 1] as const;

/**
 * Keep the shell behind the forming core until the core has a readable mass,
 * while ensuring it starts before the existing orbital reveal at progress .30.
 * This only remaps the existing sphere reveal; it does not alter the Hero
 * timeline or add another animation clock.
 */
export function getHeroCircuitReveal(sphereReveal: number): number {
  const clamped = Math.max(0, Math.min(1, sphereReveal));
  const t = Math.max(0, Math.min(1, (clamped - 0.12) / 0.88));
  return t * t * (3 - 2 * t);
}

/**
 * Return a continuous signed phase for a hero ring. The modulo keeps the
 * value stable for long-lived tabs while the direction preserves the intended
 * front/back choreography. At each exact period the phase is zero again.
 */
export function getHeroRingPhase(elapsedSeconds: number, ringIndex: number, fallbackPeriod = 110): number {
  const period = ringIndex < RING_PERIODS.length ? RING_PERIODS[ringIndex] : fallbackPeriod;
  const direction = ringIndex < RING_DIRECTIONS.length ? RING_DIRECTIONS[ringIndex] : (ringIndex % 2 === 0 ? 1 : -1);
  const cycleSeconds = ((elapsedSeconds % period) + period) % period;
  return cycleSeconds / period * Math.PI * 2 * direction;
}

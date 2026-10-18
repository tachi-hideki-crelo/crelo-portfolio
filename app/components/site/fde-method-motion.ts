// METHOD plates: the four steps are print-plate separations of ONE map, drawn
// in a shared 400×400 coordinate space so they register into a single
// composite. On scroll the plates drop in and stack (isometric), then collapse
// and turn to a plan view where the registration marks line up.

export const METHOD_STEP_COUNT = 4;
export const METHOD_COMPOSITE_INDEX = METHOD_STEP_COUNT;
export const METHOD_PLATE_SIZE = 400;

// Scroll maps onto a timeline f in [-LEAD_IN, SPAN - LEAD_IN]: plate i arrives
// over [i - 1, i], the stack collapses over [3.9, 4.6] and turns to plan view
// over [4.55, 5.35].
export const METHOD_TIMELINE_SPAN = 5.6;
const LEAD_IN = 0.2;
const COLLAPSE_START = 3.9;
const COLLAPSE_LENGTH = 0.7;
const PLAN_START = 4.55;
const PLAN_LENGTH = 0.8;
const COMPOSITE_AT = 0.35;

// Stack geometry, relative to the rendered plate width.
const GAP_RATIO = 0.156;
const LIFT_RATIO = 0.044;
const DROP_RATIO = 1.05;
const PIN_OVERHANG = 40;
const TILT_X = 58;
const TILT_Z = -38;
const PLAN_SCALE = 0.08;

export type MethodPoint = readonly [x: number, y: number];

export type MethodPlateArt = {
  frame: { x0: number; y0: number; x1: number; y1: number };
  center: MethodPoint;
  field: ReadonlyArray<{ x: number; y: number; inFrame: boolean }>;
  prototype: readonly MethodPoint[];
  rings: readonly number[];
  nodes: readonly MethodPoint[];
  routes: ReadonlyArray<readonly MethodPoint[]>;
  adopted: readonly MethodPoint[];
  registration: readonly MethodPoint[];
};

export type MethodPlateState = { z: number; opacity: number; arrived: boolean };

export type MethodTimeline = {
  progress: number;
  active: number;
  collapse: number;
  plan: number;
  composite: boolean;
  dimInactive: boolean;
  plates: readonly MethodPlateState[];
  pin: { length: number; z: number; visible: boolean };
  tilt: { x: number; z: number; scale: number };
};

function clamp01(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function createSeededRandom(seed: number): () => number {
  let state = Math.max(1, Math.floor(Math.abs(seed)) % 2147483647);
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

function distanceToSegment([px, py]: MethodPoint, [ax, ay]: MethodPoint, [bx, by]: MethodPoint): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared > 0 ? clamp01(((px - ax) * dx + (py - ay) * dy) / lengthSquared) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function routePath(route: readonly MethodPoint[]): string {
  return route.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x} ${y}`).join(' ');
}

export function createMethodPlateArt(seed = 21): MethodPlateArt {
  const random = createSeededRandom(seed);
  const frame = { x0: 150, y0: 140, x1: 262, y1: 252 };
  const cx = (frame.x0 + frame.x1) / 2;
  const cy = (frame.y0 + frame.y1) / 2;
  const inFrame = (x: number, y: number) => x > frame.x0 && x < frame.x1 && y > frame.y0 && y < frame.y1;

  const raw: MethodPoint[] = [];
  for (let index = 0; index < 150; index += 1) raw.push([34 + random() * 332, 34 + random() * 332]);
  for (let index = 0; index < 26; index += 1) raw.push([cx + (random() - 0.5) * 70, cy + (random() - 0.5) * 70]);
  const field = raw.map(([x, y]) => ({ x: Number(x.toFixed(1)), y: Number(y.toFixed(1)), inFrame: inFrame(x, y) }));

  const prototype: MethodPoint[] = [];
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) prototype.push([cx - 21 + column * 14, cy - 21 + row * 14]);
  }

  const nodes: MethodPoint[] = [[60, 70], [338, 62], [350, 220], [300, 344], [74, 330], [48, 196]];
  const routes: MethodPoint[][] = [
    [[cx, cy], [cx, 70], [60, 70]],
    [[cx, cy], [300, cy], [300, 62], [338, 62]],
    [[cx, cy], [350, cy], [350, 220]],
    [[cx, cy], [cx, 300], [300, 300], [300, 344]],
    [[cx, cy], [cx, 300], [74, 300], [74, 330]],
    [[cx, cy], [48, cy], [48, 196]],
  ];

  // Adoption spreads along the system: field points outside the original
  // scope that sit close to a route light up on the last plate.
  const adopted = field
    .filter((point) => !point.inFrame && routes.some((route) => route.slice(1).some((end, index) => (
      distanceToSegment([point.x, point.y], route[index], end) < 10
    ))))
    .map((point): MethodPoint => [point.x, point.y]);

  return {
    frame,
    center: [cx, cy],
    field,
    prototype,
    rings: [40, 54, 68],
    nodes,
    routes,
    adopted,
    registration: [[16, 16], [384, 16], [16, 384], [384, 384]],
  };
}

export function getMethodTimeline(progress: number, plateWidth: number, reduceMotion = false): MethodTimeline {
  const clamped = clamp01(progress);
  const f = reduceMotion ? METHOD_TIMELINE_SPAN : clamped * METHOD_TIMELINE_SPAN - LEAD_IN;
  const collapse = ease(clamp01((f - COLLAPSE_START) / COLLAPSE_LENGTH));
  const plan = ease(clamp01((f - PLAN_START) / PLAN_LENGTH));
  const composite = plan > COMPOSITE_AT;
  const active = composite
    ? METHOD_COMPOSITE_INDEX
    : Math.min(Math.max(Math.floor(f + LEAD_IN), 0), METHOD_STEP_COUNT - 1);
  const width = Math.max(plateWidth, 0);
  const gap = width * GAP_RATIO * (1 - collapse);
  const middle = (METHOD_STEP_COUNT - 1) / 2;

  const plates = Array.from({ length: METHOD_STEP_COUNT }, (_, index): MethodPlateState => {
    const arrive = ease(clamp01(f - index + 1));
    const lift = index === active ? width * LIFT_RATIO * (1 - collapse) : 0;
    return {
      z: (index - middle) * gap + lift + (1 - arrive) * width * DROP_RATIO,
      opacity: arrive,
      arrived: arrive > 0.98,
    };
  });
  const arrivedCount = plates.filter((plate) => plate.arrived).length;

  return {
    progress: clamped,
    active,
    collapse,
    plan,
    composite,
    dimInactive: !composite && collapse < 0.5,
    plates,
    pin: {
      length: Math.max(arrivedCount - 1, 0) * gap + PIN_OVERHANG * (1 - plan),
      z: -middle * gap - (PIN_OVERHANG / 2) * (1 - plan),
      visible: plan <= 0.5 && arrivedCount > 0,
    },
    tilt: { x: TILT_X * (1 - plan), z: TILT_Z * (1 - plan), scale: 1 + PLAN_SCALE * plan },
  };
}

// Scroll progress that lands in the middle of a step's hold (or on the
// finished composite for METHOD_COMPOSITE_INDEX).
export function getMethodStepProgress(index: number): number {
  const step = Math.min(Math.max(Math.round(index), 0), METHOD_COMPOSITE_INDEX);
  const f = step === METHOD_COMPOSITE_INDEX ? 5.5 : step + 0.3;
  return clamp01((f + LEAD_IN) / METHOD_TIMELINE_SPAN);
}

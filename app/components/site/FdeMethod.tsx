'use client';

import { memo, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useReducedMotion } from 'motion/react';

import {
  createMethodPlateArt,
  getMethodStepProgress,
  getMethodTimeline,
  METHOD_COMPOSITE_INDEX,
  METHOD_PLATE_SIZE,
  routePath,
} from './fde-method-motion';
import styles from './fde-method.module.css';

const methodSteps = [
  {
    code: '01',
    en: 'Frame',
    verb: '見極める',
    head: '何を解くべきかを決める',
    body: '現場の声と事業の制約を聞き取り、データで裏づけて、取り組む課題をひとつに絞ります。',
    output: '解くべき課題と、成功の基準',
  },
  {
    code: '02',
    en: 'Prove',
    verb: '確かめる',
    head: '小さく作って、効くかを試す',
    body: '最小限の試作を現場で動かし、続けるか・変えるかを数字で判断します。',
    output: '動く試作と、判断の根拠',
  },
  {
    code: '03',
    en: 'Build',
    verb: '組み上げる',
    head: '毎日使える仕組みにする',
    body: 'AIやソフトウェア、既存ツールとの連携を、運用まで見据えて設計・実装します。',
    output: '本番で動くシステム',
  },
  {
    code: '04',
    en: 'Land',
    verb: '根づかせる',
    head: '使われ続けるまで伴走する',
    body: '導入後の使われ方をデータで追い、改善を続けます。業務が変われば、仕組みも合わせて変えます。',
    output: '定着と、改善のサイクル',
  },
] as const;

const plateArt = createMethodPlateArt();

const subscribeNothing = () => () => {};

// The sticky stage needs room for the intro, the copy slot and the plates;
// shorter viewports (a phone in landscape) get the static page instead.
const SHORT_VIEWPORT_QUERY = '(max-height: 560px)';

function subscribeShortViewport(onChange: () => void): () => void {
  const query = window.matchMedia(SHORT_VIEWPORT_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

const STATIC_VIEW = { active: METHOD_COMPOSITE_INDEX, dimInactive: false };

function cropMarks(): string {
  const { x0, y0, x1, y1 } = plateArt.frame;
  const m = 14;
  return [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]
    .map(([x, y, dx, dy]) => `M${x + dx * m} ${y} H${x} V${y + dy * m}`)
    .join(' ');
}

const PlateArt = memo(function PlateArt({ index }: { index: number }) {
  const { frame, center: [cx, cy] } = plateArt;
  return (
    <svg viewBox={`0 0 ${METHOD_PLATE_SIZE} ${METHOD_PLATE_SIZE}`} aria-hidden="true" focusable="false">
      {plateArt.registration.map(([x, y]) => (
        <g key={`${x}-${y}`} className={styles.registration}>
          <circle cx={x} cy={y} r="5" />
          <path d={`M${x - 9} ${y} H${x + 9} M${x} ${y - 9} V${y + 9}`} />
        </g>
      ))}

      {index === 0 ? (
        <>
          {plateArt.field.map((point, pointIndex) => (
            <rect
              key={pointIndex}
              className={point.inFrame ? styles.fieldScoped : styles.fieldPoint}
              x={point.x - 1}
              y={point.y - 1}
              width="2"
              height="2"
            />
          ))}
          <path className={styles.crop} d={cropMarks()} />
          <text className={styles.artLabelLead} x={frame.x0} y={frame.y0 - 8}>SCOPE</text>
        </>
      ) : null}

      {index === 1 ? (
        <>
          <rect
            className={styles.prototypeFrame}
            x={frame.x0 + 14}
            y={frame.y0 + 14}
            width={frame.x1 - frame.x0 - 28}
            height={frame.y1 - frame.y0 - 28}
          />
          {plateArt.prototype.map(([x, y]) => (
            <rect key={`${x}-${y}`} className={styles.prototypePoint} x={x - 1.5} y={y - 1.5} width="3" height="3" />
          ))}
          {plateArt.rings.map((radius, ringIndex) => (
            <circle key={radius} className={styles.ring} cx={cx} cy={cy} r={radius} style={{ strokeOpacity: 0.7 - ringIndex * 0.2 }} />
          ))}
          <text className={styles.artLabelLead} x={frame.x1 + 22} y={cy - 40}>TEST × 3</text>
        </>
      ) : null}

      {index === 2 ? (
        <>
          {plateArt.routes.map((route, routeIndex) => (
            <path key={routeIndex} className={styles.route} d={routePath(route)} />
          ))}
          {plateArt.nodes.map(([x, y]) => (
            <rect key={`${x}-${y}`} className={styles.node} x={x - 5} y={y - 5} width="10" height="10" />
          ))}
          <rect className={styles.node} x={cx - 7} y={cy - 7} width="14" height="14" />
          <text className={styles.artLabel} x="312" y="236">SYSTEM</text>
        </>
      ) : null}

      {index === 3 ? (
        <>
          {plateArt.routes.map((route, routeIndex) => (
            <path key={routeIndex} className={styles.flow} d={routePath(route)} />
          ))}
          {plateArt.adopted.map(([x, y]) => (
            <rect key={`${x}-${y}`} className={styles.adopted} x={x - 1.3} y={y - 1.3} width="2.6" height="2.6" />
          ))}
          {plateArt.nodes.map(([x, y]) => (
            <circle key={`${x}-${y}`} className={styles.ping} cx={x} cy={y} r="12" />
          ))}
          <text className={styles.artLabelLead} x="60" y="358">IN USE</text>
        </>
      ) : null}
    </svg>
  );
});

export default function FdeMethod() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const plateRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pinRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const frameRef = useRef<number | null>(null);
  const [liveView, setView] = useState(STATIC_VIEW);
  const reduceMotion = useReducedMotion() ?? false;
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const shortViewport = useSyncExternalStore(
    subscribeShortViewport,
    () => window.matchMedia(SHORT_VIEWPORT_QUERY).matches,
    () => false,
  );
  // Until hydration, with reduced motion, or on short viewports the section
  // renders as a static page: every step readable beside the finished
  // composite in plan view.
  const live = hydrated && !reduceMotion && !shortViewport;
  const view = live ? liveView : STATIC_VIEW;

  useEffect(() => {
    const section = sectionRef.current;
    const stack = stackRef.current;
    if (!section || !stack) return;

    if (!live) {
      // Static layout: the CSS draws the flat composite; drop any transforms
      // left over from live motion.
      stack.style.transform = '';
      plateRefs.current.forEach((plate) => { if (plate) { plate.style.transform = ''; plate.style.opacity = ''; } });
      pinRefs.current.forEach((pin) => { if (pin) pin.style.opacity = '0'; });
      return;
    }

    const update = () => {
      frameRef.current = null;
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      const timeline = getMethodTimeline(-section.getBoundingClientRect().top / travel, stack.clientWidth);

      stack.style.transform = `rotateX(${timeline.tilt.x.toFixed(2)}deg) rotateZ(${timeline.tilt.z.toFixed(2)}deg) scale(${timeline.tilt.scale.toFixed(3)})`;
      timeline.plates.forEach((plate, index) => {
        const node = plateRefs.current[index];
        if (!node) return;
        node.style.transform = `translateZ(${plate.z.toFixed(1)}px)`;
        node.style.opacity = plate.opacity.toFixed(3);
      });
      pinRefs.current.forEach((pin) => {
        if (!pin) return;
        pin.style.height = `${timeline.pin.length.toFixed(1)}px`;
        pin.style.transform = `translateZ(${timeline.pin.z.toFixed(1)}px) rotateX(90deg)`;
        pin.style.opacity = timeline.pin.visible ? '1' : '0';
      });
      setView((current) => (
        current.active === timeline.active && current.dimInactive === timeline.dimInactive
          ? current
          : { active: timeline.active, dimInactive: timeline.dimInactive }
      ));
    };

    const requestUpdate = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(update);
    };

    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(requestUpdate);
    observer?.observe(stack);
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [live]);

  const jumpTo = useCallback((index: number) => {
    const section = sectionRef.current;
    if (!section) return;
    const travel = Math.max(section.offsetHeight - window.innerHeight, 0);
    const top = section.getBoundingClientRect().top + window.scrollY + getMethodStepProgress(index) * travel;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [reduceMotion]);

  const { active, dimInactive } = view;
  const composite = active === METHOD_COMPOSITE_INDEX;

  return (
    <section
      ref={sectionRef}
      id="method"
      className={styles.methodSection}
      aria-labelledby="method-title"
      data-motion={live ? 'live' : 'static'}
      data-composite={composite ? 'true' : 'false'}
    >
      <div className={styles.stage}>
        <div className={styles.copy}>
          <header className={styles.intro}>
            <p className={styles.eyebrow}>03 / HOW I WORK</p>
            <h2 id="method-title">進め方</h2>
            <p className={styles.lead}>
              作って納品するだけでは、現場は変わりません。何を解くべきかを決めるところから、使われ続けるところまで。4つのステップを一貫して担当します。
            </p>
          </header>

          <div className={styles.slots}>
            <ol className={styles.steps}>
              {methodSteps.map((step, index) => (
                <li key={step.code} className={styles.step} data-active={active === index ? 'true' : 'false'}>
                  <p className={styles.stepLabel}>PLATE {step.code} / <span lang="en">{step.en.toUpperCase()}</span></p>
                  <h3 className={styles.verb}>{step.verb}</h3>
                  <p className={styles.stepHead}>{step.head}</p>
                  <p className={styles.stepCopy}>{step.body}</p>
                  <p className={styles.stepOutput}><span>成果物</span>{step.output}</p>
                </li>
              ))}
            </ol>
            <div className={styles.composite} data-active={composite ? 'true' : 'false'}>
              <p className={styles.stepLabel}>COMPOSITE / 4 PLATES</p>
              <p className={styles.verb}>一枚の仕組みに。</p>
              <p className={styles.stepHead}>4枚が重なって、現場で動く完成図になる</p>
              <p className={styles.stepCopy}>使われ方から見えてきた次の課題は、新しい 01 の版として、また見極めるところから始めます。</p>
            </div>
          </div>
        </div>

        <div className={styles.scene} aria-hidden="true">
          <div ref={stackRef} className={styles.stack}>
            {methodSteps.map((step, index) => (
              <div
                key={step.code}
                ref={(node) => { plateRefs.current[index] = node; }}
                className={styles.plate}
                data-active={active === index ? 'true' : 'false'}
                data-dim={dimInactive && active !== index ? 'true' : 'false'}
              >
                <PlateArt index={index} />
                <span className={styles.plateEdge}>PLATE {step.code} — {step.en.toUpperCase()} / {step.verb}</span>
                <span className={styles.plateTab} style={{ top: `${8 + index * 9}%` }}>{step.code}</span>
              </div>
            ))}
            {[[4, 4], [96, 4], [4, 96], [96, 96]].map(([x, y], index) => (
              <span
                key={`${x}-${y}`}
                ref={(node) => { pinRefs.current[index] = node; }}
                className={styles.pin}
                style={{ left: `${x}%`, top: `${y}%` }}
              />
            ))}
          </div>
        </div>

        <nav className={styles.rail} aria-label="進め方のステップ">
          {methodSteps.map((step, index) => (
            <button
              key={step.code}
              type="button"
              className={styles.railButton}
              aria-current={active === index ? 'step' : undefined}
              onClick={() => jumpTo(index)}
            >
              <b>{step.code}</b><span>{step.verb}</span>
            </button>
          ))}
          <button
            type="button"
            className={styles.railButton}
            data-loop="true"
            aria-current={composite ? 'step' : undefined}
            onClick={() => jumpTo(METHOD_COMPOSITE_INDEX)}
          >
            <b aria-hidden="true">↻ 01</b><span className={styles.srOnly}>完成図</span>
          </button>
        </nav>
      </div>
    </section>
  );
}

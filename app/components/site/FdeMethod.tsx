'use client';

import type { CSSProperties, FocusEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';

import {
  getMethodCardTimeline,
  getMethodHoverTimeline,
  getMethodStageTimeline,
} from './fde-method-motion';
import styles from './fde-method.module.css';

type CSSVars = CSSProperties & Record<`--${string}`, string | number>;

const processSteps = [
  {
    code: '01',
    name: 'Frame',
    jp: '課題を定義する',
    signal: 'DISCOVERY / CONTEXT',
    copy: '現場の声と事業の制約をつなぎ、問題点や課題点をデータを用いて定めます。',
    output: 'Problem frame / success signal',
    accent: '#a6ffdb',
    accentRgb: '166 255 219',
    glyph: 'frame',
  },
  {
    code: '02',
    name: 'Prove',
    jp: '仮説を確かめる',
    signal: 'PROTOTYPE / EVIDENCE',
    copy: '小さく作って効果を検証し、仮説の成否を判断します。',
    output: 'Working proof / decision evidence',
    accent: '#79dcff',
    accentRgb: '121 220 255',
    glyph: 'prove',
  },
  {
    code: '03',
    name: 'Build',
    jp: '使える形にする',
    signal: 'SYSTEM / INTEGRATION',
    copy: 'AI・ソフトウェア・連携を、運用に乗る設計へ落とし込みます。',
    output: 'Production system / operating flow',
    accent: '#ffc779',
    accentRgb: '255 199 121',
    glyph: 'build',
  },
  {
    code: '04',
    name: 'Land',
    jp: '現場へ届ける',
    signal: 'ROLLOUT / ADOPTION',
    copy: '導入後のデータ収集、その後の改善まで伴走し、業務の日々の変化にも柔軟に対応します。',
    output: 'Field adoption / iteration loop',
    accent: '#ff9fcb',
    accentRgb: '255 159 203',
    glyph: 'land',
  },
] as const;

function hasFinePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
}

export default function FdeMethod() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const mobileQuery = window.matchMedia('(max-width: 900px)');
    const update = () => {
      frameRef.current = null;
      const viewportWidth = window.innerWidth;
      const mobile = mobileQuery.matches;
      section.dataset.layout = mobile ? 'stack' : reduceMotion ? 'static' : 'deck';

      if (mobile) {
        section.dataset.methodProgress = '1.0000';
        section.style.setProperty('--method-spread', '1');
        section.style.setProperty('--method-atmosphere', '1');
        return;
      }

      const rect = section.getBoundingClientRect();
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      const progress = reduceMotion ? 1 : Math.min(Math.max(-rect.top / travel, 0), 1);
      const stage = getMethodStageTimeline(progress, reduceMotion);
      section.dataset.methodProgress = stage.progress.toFixed(4);
      section.style.setProperty('--method-spread', stage.spread.toFixed(4));
      section.style.setProperty('--method-atmosphere', stage.atmosphere.toFixed(4));
      section.style.setProperty('--method-settle', stage.settle.toFixed(4));

      cardRefs.current.forEach((card, index) => {
        if (!card) return;
        const timeline = getMethodCardTimeline({
          progress,
          index,
          viewportWidth,
          reduceMotion,
        });
        card.style.setProperty('--method-x', `${timeline.x.toFixed(3)}px`);
        card.style.setProperty('--method-y', `${timeline.y.toFixed(3)}px`);
        card.style.setProperty('--method-z', `${timeline.z.toFixed(3)}px`);
        card.style.setProperty('--method-rotate', `${timeline.rotate.toFixed(3)}deg`);
        card.style.setProperty('--method-yaw', `${timeline.yaw.toFixed(3)}deg`);
        card.style.setProperty('--method-counter-yaw', activeIndex === index ? `${(-timeline.yaw * 0.86).toFixed(3)}deg` : '0deg');
        card.style.setProperty('--method-card-opacity', timeline.opacity.toFixed(4));
      });
    };

    const requestUpdate = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(update);
    };

    requestUpdate();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    mobileQuery.addEventListener('change', requestUpdate);
    return () => {
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      mobileQuery.removeEventListener('change', requestUpdate);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [activeIndex, reduceMotion]);

  useEffect(() => {
    const cards = cardRefs.current.filter((card): card is HTMLElement => Boolean(card));
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      cards.forEach((card) => { card.dataset.inview = 'true'; });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) (entry.target as HTMLElement).dataset.inview = 'true';
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.16 });
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [reduceMotion]);

  const resetPointer = useCallback((card: HTMLElement) => {
    card.style.setProperty('--method-pointer-x', '0px');
    card.style.setProperty('--method-pointer-y', '0px');
    card.style.setProperty('--method-pointer-tilt-x', '0deg');
    card.style.setProperty('--method-pointer-tilt-y', '0deg');
    card.style.setProperty('--method-glint-x', '50%');
    card.style.setProperty('--method-glint-y', '45%');
  }, []);

  const handlePointerEnter = useCallback((event: ReactPointerEvent<HTMLElement>, index: number) => {
    if (event.pointerType === 'touch' || !hasFinePointer()) return;
    setActiveIndex(index);
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>, index: number) => {
    if (reduceMotion || event.pointerType === 'touch' || !hasFinePointer() || activeIndex !== index) return;
    const card = event.currentTarget;
    const cardRect = card.getBoundingClientRect();
    const stage = card.closest<HTMLElement>('[data-method-deck-stage]');
    const stageRect = stage?.getBoundingClientRect() ?? cardRect;
    const localX = Math.min(Math.max((event.clientX - cardRect.left) / Math.max(cardRect.width, 1), 0), 1);
    const localY = Math.min(Math.max((event.clientY - cardRect.top) / Math.max(cardRect.height, 1), 0), 1);
    const deckX = Math.min(Math.max((event.clientX - stageRect.left) / Math.max(stageRect.width, 1), 0), 1);
    const deckY = Math.min(Math.max((event.clientY - stageRect.top) / Math.max(stageRect.height, 1), 0), 1);

    cardRefs.current.forEach((target, targetIndex) => {
      if (!target) return;
      const strength = targetIndex === index ? 1 : 0.34;
      target.style.setProperty('--method-pointer-x', targetIndex === index ? `${((localX - 0.5) * 7).toFixed(3)}px` : '0px');
      target.style.setProperty('--method-pointer-y', targetIndex === index ? `${((localY - 0.5) * 5).toFixed(3)}px` : '0px');
      target.style.setProperty('--method-pointer-tilt-x', `${((0.5 - deckY) * 7 * strength).toFixed(3)}deg`);
      target.style.setProperty('--method-pointer-tilt-y', `${((deckX - 0.5) * 8 * strength).toFixed(3)}deg`);
      target.style.setProperty('--method-glint-x', `${(localX * 100).toFixed(2)}%`);
      target.style.setProperty('--method-glint-y', `${(localY * 100).toFixed(2)}%`);
    });
  }, [activeIndex, reduceMotion]);

  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLElement>, index: number) => {
    const card = event.currentTarget;
    setActiveIndex(card.contains(document.activeElement) ? index : null);
    cardRefs.current.forEach((target) => { if (target) resetPointer(target); });
  }, [resetPointer]);

  const handleBlur = useCallback((event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget as Element | null;
    if (next?.closest('[data-method-card]')) return;
    setActiveIndex(null);
    cardRefs.current.forEach((card) => { if (card) resetPointer(card); });
  }, [resetPointer]);

  return (
    <section
      ref={sectionRef}
      id="method"
      className={styles.methodSection}
      aria-labelledby="method-title"
      data-reduced-motion={reduceMotion ? 'true' : 'false'}
      data-layout="deck"
      data-method-progress="0.0000"
    >
      <div className={styles.stickyStage}>
        <div className={styles.atmosphere} aria-hidden="true">
          <span className={styles.atmosphereGrid} />
          <span className={styles.atmosphereBeam} />
          <span className={styles.atmosphereCore} />
        </div>

        <div className={`section-marker ${styles.marker}`}><span>03</span><span>FDE METHOD / FIELD LOOP</span></div>

        <header className={styles.intro}>
          <p className="eyebrow eyebrow--mint">From ambiguity to adoption</p>
          <h2 id="method-title" className={styles.title}>
            <span>Frame</span><i aria-hidden="true">→</i><span>Prove</span><i aria-hidden="true">→</i><span>Build</span><i aria-hidden="true">→</i><span>Land</span>
          </h2>
          <p>納品して終わりではなく、実際の現場で使われ続けるところまで。<br />4つのFlowで、変化、改善まで担当します。</p>
        </header>

        <div className={styles.deckStage} data-method-deck-stage>
          <span className={styles.deckAxis} aria-hidden="true" />
          <div className={styles.deck} aria-label="FDE process">
            {processSteps.map((step, index) => {
              const hover = getMethodHoverTimeline(index, activeIndex);
              const cardStyle: CSSVars = {
                '--method-index': index,
                '--method-accent': step.accent,
                '--method-accent-rgb': step.accentRgb,
                '--method-hover-x': `${hover.pushX}px`,
                '--method-hover-y': `${hover.liftY}px`,
                '--method-hover-z': `${hover.liftZ}px`,
                '--method-hover-scale': hover.scale,
                '--method-hover-opacity': hover.opacity,
              };

              return (
                <article
                  ref={(node) => { cardRefs.current[index] = node; }}
                  className={styles.methodCard}
                  key={step.name}
                  data-method-card
                  data-method-index={index}
                  data-method-active={activeIndex === index ? 'true' : 'false'}
                  data-inview="false"
                  style={cardStyle}
                  tabIndex={0}
                  aria-labelledby={`method-step-${index}`}
                  onPointerEnter={(event) => handlePointerEnter(event, index)}
                  onPointerMove={(event) => handlePointerMove(event, index)}
                  onPointerLeave={(event) => handlePointerLeave(event, index)}
                  onFocus={() => setActiveIndex(index)}
                  onBlur={handleBlur}
                >
                  <div className={styles.cardSurface}>
                    <span className={styles.cardGlint} aria-hidden="true" />
                    <span className={styles.cardScan} aria-hidden="true" />
                    <div className={styles.cardTopline}>
                      <span>FIELD / {step.code}</span>
                      <span>{step.signal}</span>
                    </div>
                    <div className={`${styles.cardSigil} ${styles[`cardSigil--${step.glyph}`]}`} aria-hidden="true">
                      <span /><span /><span /><span />
                    </div>
                    <div className={styles.cardCopy}>
                      <p className={styles.cardPhase}>PHASE {step.code}</p>
                      <h3 id={`method-step-${index}`}>{step.name}</h3>
                      <p className={styles.cardJapanese}>{step.jp}</p>
                      <p className={styles.cardDescription}>{step.copy}</p>
                    </div>
                    <div className={styles.cardOutput}>
                      <span>OUTPUT</span>
                      <strong>{step.output}</strong>
                    </div>
                    <span className={styles.cardCorner} aria-hidden="true">+</span>
                  </div>
                </article>
              );
            })}
          </div>
          <p className={styles.interactionHint} aria-hidden="true"><span>SCROLL TO ORCHESTRATE</span><span>HOVER / FOCUS TO INSPECT</span></p>
        </div>
      </div>
    </section>
  );
}

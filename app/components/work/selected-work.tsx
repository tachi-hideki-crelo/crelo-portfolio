'use client';

import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import { WorkVisual } from './work-visual';
import {
  CARD_LAYOUT,
  getActiveCaseIndex,
  getCardMotionOffsets,
  shouldHoldKeyboardSelection,
} from './work-motion';
import type { PublicCaseStudy } from './work-public';
import styles from './selected-work.module.css';

type CSSVars = CSSProperties & Record<`--${string}`, string | number>;

type CaseTheme = {
  accent: string;
  accentSoft: string;
  index: string;
};

const THEMES: Record<string, CaseTheme> = {
  mint: { accent: '#a6ffdb', accentSoft: '166, 255, 219', index: '01' },
  cyan: { accent: '#7bdcff', accentSoft: '123, 220, 255', index: '02' },
  violet: { accent: '#c5a8ff', accentSoft: '197, 168, 255', index: '03' },
  amber: { accent: '#ffd28a', accentSoft: '255, 210, 138', index: '04' },
  rose: { accent: '#ff9fcb', accentSoft: '255, 159, 203', index: '05' },
};

function approvedText(value: string | null): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function statusCopy(caseStudy: PublicCaseStudy): string {
  if (!caseStudy.approved) return '公開承認後に反映';
  return approvedText(caseStudy.title) ?? 'Case study';
}

function approvedIndustry(caseStudy: PublicCaseStudy): string | null {
  return caseStudy.approved ? approvedText(caseStudy.industry) : null;
}

function approvedHighlights(caseStudy: PublicCaseStudy): Array<{ label: string; value: string }> {
  if (!caseStudy.approved) return [];
  const summaryRows: Array<{ label: string; value: string | null }> = [
    { label: 'Challenge', value: caseStudy.challenge },
    { label: 'Role', value: caseStudy.role },
    { label: 'Outcome', value: caseStudy.qualitativeOutcome },
  ];
  return summaryRows.flatMap(({ label, value }) => {
    const text = approvedText(value);
    return text ? [{ label, value: text }] : [];
  });
}

function getTheme(caseStudy: PublicCaseStudy): CaseTheme {
  return THEMES[caseStudy.theme] ?? THEMES.mint;
}

function clampIndex(index: number, caseCount: number): number {
  return Math.min(Math.max(index, 0), Math.max(caseCount - 1, 0));
}

function isFinePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
}

function resolveViewportOffset(value: string): number {
  const numeric = Number.parseFloat(value);
  if (!Number.isFinite(numeric)) return 0;
  if (value.endsWith('vw')) return (numeric / 100) * window.innerWidth;
  if (value.endsWith('vh')) return (numeric / 100) * window.innerHeight;
  if (value.endsWith('px')) return numeric;
  return numeric;
}

function updateActiveFromScroll(
  section: HTMLElement,
  setActive: (index: number) => void,
  reduceMotion: boolean,
  caseCount: number,
) {
  const rect = section.getBoundingClientRect();
  const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
  const progress = Math.min(Math.max(-rect.top / travel, 0), 1);
  const visualProgress = reduceMotion ? 0 : progress;
  setActive(getActiveCaseIndex(progress, caseCount));
  section.style.setProperty('--work-progress', visualProgress.toFixed(4));
  section.style.setProperty('--work-rotation', `${(visualProgress * 22).toFixed(3)}deg`);

  section.querySelectorAll<HTMLElement>('[data-case-index]').forEach((card) => {
    const index = Number(card.dataset.caseIndex);
    const layout = CARD_LAYOUT[index];
    if (!layout) return;
    const offsets = getCardMotionOffsets(layout, progress, reduceMotion);
    card.style.setProperty('--card-x-px', `${resolveViewportOffset(layout.x).toFixed(3)}px`);
    card.style.setProperty('--card-y-px', `${(resolveViewportOffset(layout.y) + offsets.parallaxOffset).toFixed(3)}px`);
    card.style.setProperty('--card-z-px', `${(layout.z + offsets.depthOffset).toFixed(3)}px`);
    card.style.setProperty('--card-parallax-offset', `${offsets.parallaxOffset.toFixed(3)}px`);
    card.style.setProperty('--card-depth-offset', `${offsets.depthOffset.toFixed(3)}px`);
  });
}

function CaseCard({
  caseStudy,
  index,
  active,
  onSelect,
  onPointerEnter,
}: {
  caseStudy: PublicCaseStudy;
  index: number;
  active: boolean;
  onSelect: (index: number) => void;
  onPointerEnter: (event: ReactPointerEvent<HTMLButtonElement>, index: number) => void;
}) {
  const theme = getTheme(caseStudy);
  const layout = CARD_LAYOUT[index] ?? CARD_LAYOUT[0];
  const title = statusCopy(caseStudy);
  const cardStyle: CSSVars = {
    '--card-x': layout.x,
    '--card-y': layout.y,
    '--card-rotate': layout.rotate,
    '--card-z': `${layout.z}px`,
    '--card-depth': `${layout.depth}px`,
    '--card-parallax': `${layout.parallax}px`,
    '--card-parallax-offset': '0px',
    '--card-depth-offset': '0px',
    '--case-accent': theme.accent,
    '--case-accent-rgb': theme.accentSoft,
    '--card-order': index,
  };

  return (
    <article
      className={`${styles.card} ${active ? styles.cardActive : ''}`}
      data-case-index={index}
      data-active={active}
      style={cardStyle}
    >
      <button
        className={styles.cardButton}
        id={`work-tab-${caseStudy.slug}`}
        type="button"
        role="tab"
        data-index={index}
        data-tab-index={index}
        data-tab-group="desktop"
        aria-selected={active}
        aria-controls="work-summary-panel"
        tabIndex={active ? 0 : -1}
        onClick={() => onSelect(index)}
        onFocus={() => onSelect(index)}
        onPointerEnter={(event) => onPointerEnter(event, index)}
      >
        <span className={styles.cardTopline}>
          <span>CASE {String(caseStudy.displayOrder).padStart(2, '0')}</span>
          <span>{caseStudy.approved ? 'PUBLISHED' : 'PRIVATE PREVIEW'}</span>
        </span>
        <span className={styles.cardTitle}>{title}</span>
        {caseStudy.approved && approvedIndustry(caseStudy) ? (
          <span className={styles.cardMeta}>{approvedIndustry(caseStudy)}</span>
        ) : null}
        <span className={styles.cardRule} aria-hidden="true" />
        <span className={styles.cardHint}>{active ? 'SELECTED / OPEN SUMMARY' : 'SELECT CASE'}</span>
        <span className={styles.cardCorner} aria-hidden="true" />
      </button>
      <span className={styles.cardNumber} aria-hidden="true">
        {String(caseStudy.displayOrder).padStart(2, '0')}
      </span>
      <a className={styles.cardArrow} href={`/work/${caseStudy.slug}`} aria-label={`${title} details`}>
        <span aria-hidden="true">↗</span>
      </a>
    </article>
  );
}

function MobileCaseItem({
  caseStudy,
  index,
  active,
  onSelect,
  reduceMotion,
}: {
  caseStudy: PublicCaseStudy;
  index: number;
  active: boolean;
  onSelect: (index: number) => void;
  reduceMotion: boolean;
}) {
  const theme = getTheme(caseStudy);
  const title = statusCopy(caseStudy);
  const industry = approvedIndustry(caseStudy);
  const highlights = approvedHighlights(caseStudy);
  const style: CSSVars = {
    '--case-accent': theme.accent,
    '--case-accent-rgb': theme.accentSoft,
  };

  return (
    <li className={`${styles.mobileItem} ${active ? styles.mobileItemActive : ''}`} style={style}>
      <button
        className={styles.mobileButton}
        type="button"
        role="tab"
        data-index={index}
        data-tab-index={index}
        data-tab-group="mobile"
        aria-selected={active}
        aria-controls="mobile-work-summary-panel"
        id={`mobile-work-tab-${caseStudy.slug}`}
        tabIndex={active ? 0 : -1}
        onClick={() => onSelect(index)}
      >
        <span className={styles.mobileIndex}>{String(caseStudy.displayOrder).padStart(2, '0')}</span>
        <span className={styles.mobileButtonCopy}>
          <span className={styles.mobileStatus}>{caseStudy.approved ? 'PUBLISHED' : 'PRIVATE PREVIEW'}</span>
          <span className={styles.mobileTitle}>{title}</span>
        </span>
        <span className={styles.mobilePlus} aria-hidden="true">{active ? '−' : '+'}</span>
      </button>
      {active ? (
        <motion.div
          className={styles.mobilePanel}
          id="mobile-work-summary-panel"
          role="tabpanel"
          aria-labelledby={`mobile-work-tab-${caseStudy.slug}`}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.28, ease: 'easeOut' }}
        >
          <div className={styles.mobilePanelVisual}>
            <WorkVisual accent={theme.accent} compact label={`CASE ${String(caseStudy.displayOrder).padStart(2, '0')} / ROUTE`} />
          </div>
          {caseStudy.approved ? (
            <div className={styles.mobileApprovedSummary}>
              {industry ? <span className={styles.mobileIndustry}>{industry}</span> : null}
              {highlights.map(({ label, value }) => (
                <p key={label}><strong>{label}</strong>{value}</p>
              ))}
            </div>
          ) : (
            <p className={styles.mobileSummary}>
              このスロットの業界・課題・担当範囲・定性成果は、公開承認後に反映します。
            </p>
          )}
          <a className={styles.detailLink} href={`/work/${caseStudy.slug}`}>
            <span>Open case study</span>
            <span aria-hidden="true">↗</span>
          </a>
        </motion.div>
      ) : null}
    </li>
  );
}

type SelectedWorkProps = {
  cases: readonly PublicCaseStudy[];
};

type KeyboardScrollLock = {
  index: number;
  baselineY: number;
  startedAt: number;
};

export function SelectedWork({ cases }: SelectedWorkProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const keyboardScrollLockRef = useRef<KeyboardScrollLock | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const reduceMotion = useReducedMotion() ?? false;
  const caseStudies = cases;
  const caseCount = caseStudies.length;

  const activeCase = caseStudies[activeIndex] ?? caseStudies[0];
  const activeTheme = activeCase ? getTheme(activeCase) : THEMES.mint;
  const activeIndustry = activeCase ? approvedIndustry(activeCase) : null;
  const activeHighlights = activeCase ? approvedHighlights(activeCase) : [];

  const handleSelect = useCallback((index: number) => {
    setActiveIndex(clampIndex(index, caseCount));
  }, [caseCount]);

  const handleCardPointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>, index: number) => {
      if (event.pointerType === 'mouse' || isFinePointer()) handleSelect(index);
    },
    [handleSelect],
  );

  const handleKeyboard = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.getAttribute('role') !== 'tab') return;

      const current = Number(target.getAttribute('data-tab-index') ?? activeIndex);
      let next: number | null = null;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % caseCount;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + caseCount) % caseCount;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = caseCount - 1;
      if (next === null) return;

      event.preventDefault();
      const selectedIndex = clampIndex(next, caseCount);
      keyboardScrollLockRef.current = {
        index: selectedIndex,
        baselineY: window.scrollY,
        startedAt: performance.now(),
      };
      handleSelect(selectedIndex);
      const tabGroup = target.getAttribute('data-tab-group') ?? 'desktop';
      const tab = document.querySelector<HTMLButtonElement>(`button[data-tab-group="${tabGroup}"][data-tab-index="${selectedIndex}"]`);
      tab?.focus({ preventScroll: true });
    },
    [activeIndex, caseCount, handleSelect],
  );

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const onScroll = () => {
      if (window.matchMedia('(max-width: 768px)').matches) return;
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        const keyboardLock = keyboardScrollLockRef.current;
        if (keyboardLock && shouldHoldKeyboardSelection(
          performance.now() - keyboardLock.startedAt,
          window.scrollY - keyboardLock.baselineY,
        )) {
          setActiveIndex(keyboardLock.index);
          return;
        }
        keyboardScrollLockRef.current = null;
        updateActiveFromScroll(section, setActiveIndex, reduceMotion, caseCount);
      });
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [caseCount, reduceMotion]);

  const handleStagePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const stage = event.currentTarget;
      if (reduceMotion || !isFinePointer() || event.pointerType === 'touch') {
        delete stage.dataset.cursorInside;
        delete stage.dataset.cursorHover;
        return;
      }

      const target = event.target as Element;
      stage.style.setProperty('--cursor-x', `${event.clientX}px`);
      stage.style.setProperty('--cursor-y', `${event.clientY}px`);
      stage.dataset.cursorInside = 'true';
      stage.dataset.cursorHover = target.closest('[data-case-index]') ? 'true' : 'false';
    },
    [reduceMotion],
  );

  const handleStagePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    delete event.currentTarget.dataset.cursorInside;
    delete event.currentTarget.dataset.cursorHover;
    delete event.currentTarget.dataset.cursorFocus;
  }, []);

  const handleStageFocusCapture = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    if (target.closest('[data-case-index]')) event.currentTarget.dataset.cursorFocus = 'true';
  }, []);

  const handleStageBlurCapture = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget) || !(nextTarget as Element).closest?.('[data-case-index]')) {
      delete event.currentTarget.dataset.cursorFocus;
    }
  }, []);

  const sectionStyle: CSSVars = useMemo(
    () => ({
      '--theme-accent': activeTheme.accent,
      '--theme-accent-rgb': activeTheme.accentSoft,
      '--theme-index': activeIndex,
    }),
    [activeIndex, activeTheme.accent, activeTheme.accentSoft],
  );

  if (!activeCase) return null;

  return (
    <section
      ref={sectionRef}
      className={styles.selectedWork}
      id="selected-work"
      aria-labelledby="selected-work-title"
      style={sectionStyle}
      onKeyDown={handleKeyboard}
    >
      <div className={styles.workIntro}>
        <p className={styles.eyebrow}>02 / SELECTED WORK</p>
        <h2 id="selected-work-title">
          <span className={styles.introPhrase}>現場に入り、</span>
          <span className={styles.introPhrase}><em>解像度</em>を上げる。</span>
        </h2>
        <p className={styles.introCopy}>
          5つの匿名ケースを選択できます。公開承認された情報だけを、ここへ実装します。
        </p>
        <span className={styles.scrollLabel}>SCROLL TO SELECT / {String(activeIndex + 1).padStart(2, '0')}</span>
      </div>

      <div className={styles.desktopStage}>
        <div className={styles.stageAtmosphere} aria-hidden="true" />
        <div
          className={styles.stageShell}
          onPointerMove={handleStagePointerMove}
          onPointerLeave={handleStagePointerLeave}
          onFocusCapture={handleStageFocusCapture}
          onBlurCapture={handleStageBlurCapture}
        >
          <div className={styles.tabList} role="tablist" aria-label="Selected work cases" aria-orientation="horizontal">
            {caseStudies.map((caseStudy, index) => (
              <CaseCard
                caseStudy={caseStudy}
                index={index}
                active={index === activeIndex}
                onSelect={handleSelect}
                onPointerEnter={handleCardPointerEnter}
                key={caseStudy.slug}
              />
            ))}
          </div>
          <motion.div
            className={styles.summaryPanel}
            id="work-summary-panel"
            role="tabpanel"
            aria-live="polite"
            aria-label={`${statusCopy(activeCase)} summary`}
            key={activeCase.slug}
            initial={reduceMotion ? false : { opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.42, ease: 'easeOut' }}
          >
            <span className={styles.summaryIndex}>{String(activeCase.displayOrder).padStart(2, '0')} / 05</span>
            <span className={styles.summaryStatus}>{activeCase.approved ? 'APPROVED CASE' : 'PRIVATE PREVIEW SLOT'}</span>
            <h3>{statusCopy(activeCase)}</h3>
            {activeCase.approved ? (
              <div className={styles.summaryFacts}>
                {activeIndustry ? <span className={styles.summaryIndustry}>{activeIndustry}</span> : null}
                {activeHighlights.map(({ label, value }) => (
                  <p key={label}><strong>{label}</strong>{value}</p>
                ))}
              </div>
            ) : (
              <p>業界・課題・担当範囲・成果は、公開承認後に反映します。</p>
            )}
            <a className={styles.summaryLink} href={`/work/${activeCase.slug}`}>
              <span>Open case study</span>
              <span aria-hidden="true">↗</span>
            </a>
          </motion.div>
          <div className={styles.stageVisual}>
            <WorkVisual accent={activeTheme.accent} compact label="FDE / CASE ROUTE" />
          </div>
          <span className={styles.cursor} aria-hidden="true"><span>↗</span></span>
        </div>
      </div>

      <div className={styles.mobileStage}>
        <div className={styles.mobileTabList} role="tablist" aria-label="Selected work cases" aria-orientation="vertical">
          <ul>
            {caseStudies.map((caseStudy, index) => (
              <MobileCaseItem
                caseStudy={caseStudy}
                index={index}
                active={index === activeIndex}
                onSelect={handleSelect}
                reduceMotion={reduceMotion}
                key={caseStudy.slug}
              />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export default SelectedWork;

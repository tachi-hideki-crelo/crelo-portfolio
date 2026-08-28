'use client';

import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { WorkVisual } from './work-visual';
import {
  CARD_LAYOUT,
  STATIC_CARD_LAYOUT,
  getBurstProgress,
  getPointerCardMotion,
  getScatterEntryProgress,
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
  mint: { accent: '#a6ffdb', accentSoft: '166 255 219', index: '01' },
  cyan: { accent: '#7bdcff', accentSoft: '123 220 255', index: '02' },
  violet: { accent: '#c5a8ff', accentSoft: '197 168 255', index: '03' },
  amber: { accent: '#ffd28a', accentSoft: '255 210 138', index: '04' },
  rose: { accent: '#ff9fcb', accentSoft: '255 159 203', index: '05' },
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

function updateScatterFromScroll(
  section: HTMLElement,
  reduceMotion: boolean,
) {
  const stage = section.querySelector<HTMLElement>('[data-work-stage]');
  if (!stage) return;

  const rect = section.getBoundingClientRect();
  const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
  const visualProgress = reduceMotion ? 0 : Math.min(Math.max(-rect.top / travel, 0), 1);
  const stageRect = stage.getBoundingClientRect();
  const entryProgress = getScatterEntryProgress(stageRect.top, window.innerHeight, reduceMotion);
  const entryOpacity = reduceMotion ? 1 : Math.min(entryProgress * 2.6, 1);
  const entryScale = reduceMotion ? 1 : 0.64 + Math.min(entryProgress * 1.7, 1) * 0.36;
  const useContainedLayout = reduceMotion || !isFinePointer();

  section.style.setProperty('--work-progress', visualProgress.toFixed(4));
  section.style.setProperty('--work-rotation', `${(visualProgress * 34).toFixed(3)}deg`);
  section.style.setProperty('--work-entry-opacity', entryOpacity.toFixed(4));
  section.style.setProperty('--work-entry-scale', entryScale.toFixed(4));
  section.style.setProperty('--work-entry-blur', `${((1 - entryOpacity) * 22).toFixed(3)}px`);
  section.dataset.burstReady = entryProgress > 0.2 || reduceMotion ? 'true' : 'false';

  section.querySelectorAll<HTMLElement>('[data-case-index]').forEach((card) => {
    const index = Number(card.dataset.caseIndex);
    const layout = (useContainedLayout ? STATIC_CARD_LAYOUT : CARD_LAYOUT)[index];
    if (!layout) return;
    const burst = getBurstProgress(entryProgress, index, reduceMotion);
    const settledBurst = Math.min(Math.max(burst, 0), 1.16);
    const depthDrift = reduceMotion ? 0 : layout.depth * visualProgress * 0.18;
    card.style.setProperty('--card-x-px', `${(resolveViewportOffset(layout.x) * settledBurst).toFixed(3)}px`);
    card.style.setProperty('--card-y-px', `${(resolveViewportOffset(layout.y) * settledBurst).toFixed(3)}px`);
    card.style.setProperty('--card-z-px', `${(layout.z * Math.min(settledBurst, 1) + depthDrift).toFixed(3)}px`);
    card.style.setProperty('--card-rotate-current', `${(Number.parseFloat(layout.rotate) * settledBurst).toFixed(3)}deg`);
    card.style.setProperty('--card-burst-progress', settledBurst.toFixed(4));
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
  onPointerEnter: (event: ReactPointerEvent<HTMLElement>, index: number) => void;
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
    '--card-x-px': '0px',
    '--card-y-px': '0px',
    '--card-z-px': '0px',
    '--card-pointer-x': '0px',
    '--card-pointer-y': '0px',
    '--card-pointer-rotate-x': '0deg',
    '--card-pointer-rotate-y': '0deg',
    '--card-rotate-current': '0deg',
    '--card-burst-progress': 0,
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
      onPointerEnter={(event) => onPointerEnter(event, index)}
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

function ThemeBleedLayer({
  caseStudy,
  theme,
  reduceMotion,
  className,
}: {
  caseStudy: PublicCaseStudy;
  theme: CaseTheme;
  reduceMotion: boolean;
  className: string;
}) {
  return (
    <AnimatePresence initial={false}>
      <motion.div
        aria-hidden="true"
        className={`${styles.themeBleed} ${className}`}
        data-theme-bleed={caseStudy.theme}
        key={`theme-bleed-${caseStudy.slug}`}
        style={{ '--bleed-rgb': theme.accentSoft } as CSSVars}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.012 }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className={styles.themeBleedCore} />
        <span className={styles.themeBleedHaze} />
      </motion.div>
    </AnimatePresence>
  );
}

export function SelectedWork({ cases }: SelectedWorkProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const pointerFrameRef = useRef<number | null>(null);
  const pointerSampleRef = useRef<{
    stage: HTMLDivElement;
    clientX: number;
    clientY: number;
    hoveredIndex: number | null;
  } | null>(null);
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
    (event: ReactPointerEvent<HTMLElement>, index: number) => {
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
        updateScatterFromScroll(section, reduceMotion);
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
  }, [reduceMotion]);

  useEffect(() => () => {
    if (pointerFrameRef.current !== null) window.cancelAnimationFrame(pointerFrameRef.current);
  }, []);

  const handleStagePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const stage = event.currentTarget;
      if (reduceMotion || !isFinePointer() || event.pointerType === 'touch') {
        pointerSampleRef.current = null;
        return;
      }

      const target = event.target as Element;
      const hoveredCard = target.closest<HTMLElement>('[data-case-index]');
      const hoveredIndex = hoveredCard ? Number(hoveredCard.dataset.caseIndex) : null;

      pointerSampleRef.current = { stage, clientX: event.clientX, clientY: event.clientY, hoveredIndex };
      if (pointerFrameRef.current !== null) return;
      pointerFrameRef.current = window.requestAnimationFrame(() => {
        pointerFrameRef.current = null;
        const sample = pointerSampleRef.current;
        if (!sample) return;
        const stageRect = sample.stage.getBoundingClientRect();
        const pointerX = sample.clientX - stageRect.left - stageRect.width / 2;
        const pointerY = sample.clientY - stageRect.top - stageRect.height / 2;

        sample.stage.querySelectorAll<HTMLElement>('[data-case-index]').forEach((card) => {
          const index = Number(card.dataset.caseIndex);
          if (index === sample.hoveredIndex) return;
          const layout = CARD_LAYOUT[index];
          if (!layout) return;
          const baseX = Number.parseFloat(card.style.getPropertyValue('--card-x-px')) || 0;
          const baseY = Number.parseFloat(card.style.getPropertyValue('--card-y-px')) || 0;
          const pointerMotion = getPointerCardMotion({
            baseX,
            baseY,
            pointerX,
            pointerY,
            viewportWidth: stageRect.width,
            viewportHeight: stageRect.height,
            depth: layout.depth,
          });
          card.style.setProperty('--card-pointer-x', `${pointerMotion.x.toFixed(3)}px`);
          card.style.setProperty('--card-pointer-y', `${pointerMotion.y.toFixed(3)}px`);
          card.style.setProperty('--card-pointer-rotate-x', `${pointerMotion.rotateX.toFixed(3)}deg`);
          card.style.setProperty('--card-pointer-rotate-y', `${pointerMotion.rotateY.toFixed(3)}deg`);
        });
      });
    },
    [reduceMotion],
  );

  const handleStagePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    pointerSampleRef.current = null;
    if (pointerFrameRef.current !== null) {
      window.cancelAnimationFrame(pointerFrameRef.current);
      pointerFrameRef.current = null;
    }
    event.currentTarget.querySelectorAll<HTMLElement>('[data-case-index]').forEach((card) => {
      card.style.setProperty('--card-pointer-x', '0px');
      card.style.setProperty('--card-pointer-y', '0px');
      card.style.setProperty('--card-pointer-rotate-x', '0deg');
      card.style.setProperty('--card-pointer-rotate-y', '0deg');
    });
  }, []);

  const handleStageFocusCapture = useCallback((event: FocusEvent<HTMLDivElement>) => {
    const target = event.target as Element;
    const card = target.closest<HTMLElement>('[data-case-index]');
    if (!card) return;
    const baseX = Number.parseFloat(card.style.getPropertyValue('--card-x-px')) || 0;
    const baseY = Number.parseFloat(card.style.getPropertyValue('--card-y-px')) || 0;
    card.style.setProperty('--card-pointer-x', `${(-baseX * 0.58).toFixed(3)}px`);
    card.style.setProperty('--card-pointer-y', `${(-baseY * 0.58).toFixed(3)}px`);
    card.style.setProperty('--card-pointer-rotate-x', '0deg');
    card.style.setProperty('--card-pointer-rotate-y', '0deg');
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
      data-active-theme={activeCase.theme}
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
        <span className={styles.scrollLabel}>
          <span className={styles.desktopInstruction}>HOVER TO SELECT</span>
          <span className={styles.mobileInstruction}>TAP TO SELECT</span>
          {' / '}{String(activeIndex + 1).padStart(2, '0')}
        </span>
      </div>

      <div className={styles.desktopStage}>
        <ThemeBleedLayer
          caseStudy={activeCase}
          theme={activeTheme}
          reduceMotion={reduceMotion}
          className={styles.desktopThemeBleed}
        />
        <div className={styles.stageAtmosphere} aria-hidden="true" />
        <div
          className={styles.stageShell}
          data-work-stage
          onPointerMove={handleStagePointerMove}
          onPointerLeave={handleStagePointerLeave}
          onFocusCapture={handleStageFocusCapture}
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
        </div>
      </div>

      <div className={styles.mobileStage}>
        <ThemeBleedLayer
          caseStudy={activeCase}
          theme={activeTheme}
          reduceMotion={reduceMotion}
          className={styles.mobileThemeBleed}
        />
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

'use client';

import type {
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { WorkVisual } from './work-visual';
import {
  CARD_LAYOUT,
  STATIC_CARD_LAYOUT,
  getOrbitStageVisuals,
  getOrbitalCardMotion,
  getPointerCardMotion,
  getScatterEntryProgress,
} from './work-motion';
import type {
  PublicCaseStudy,
  PublicCaseStudyImageMedia,
  PublicCaseStudyVideoMedia,
} from './work-public';
import styles from './selected-work.module.css';

type CSSVars = CSSProperties & Record<`--${string}`, string | number>;

type ExpansionOrigin = {
  x: number;
  y: number;
  scale: number;
};

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
    { label: '課題', value: caseStudy.challenge },
    { label: '担当', value: caseStudy.role },
    { label: '成果', value: caseStudy.qualitativeOutcome },
  ];
  return summaryRows.flatMap(({ label, value }) => {
    const text = approvedText(value);
    return text ? [{ label, value: text }] : [];
  });
}

function getTheme(caseStudy: PublicCaseStudy): CaseTheme {
  return THEMES[caseStudy.theme] ?? THEMES.mint;
}

function getVideoMedia(
  caseStudy: PublicCaseStudy,
  role: PublicCaseStudyVideoMedia['role'],
): PublicCaseStudyVideoMedia | null {
  if (!caseStudy.approved) return null;
  const media = caseStudy.media.find((item) => item.kind === 'video' && item.role === role);
  return media?.kind === 'video' ? media : null;
}

function getImageMedia(caseStudy: PublicCaseStudy): PublicCaseStudyImageMedia | null {
  if (!caseStudy.approved) return null;
  const media = caseStudy.media.find((item) => item.kind === 'image');
  return media?.kind === 'image' ? media : null;
}

function releaseLoadedVideo(video: HTMLVideoElement | null) {
  if (!video) return;
  video.pause();
  video.removeAttribute('src');
  video.load();
}

function CasePreviewVideo({
  video,
  reduceMotion,
  className,
}: {
  video: PublicCaseStudyVideoMedia;
  reduceMotion: boolean;
  className: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachedRef = useRef(false);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (reduceMotion) {
      element.pause();
      return;
    }

    const attachAndPlay = () => {
      if (!attachedRef.current) {
        element.src = video.src;
        element.load();
        attachedRef.current = true;
      }
      void element.play().catch(() => undefined);
    };
    const observer = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => {
        if (entry?.isIntersecting) attachAndPlay();
        else element.pause();
      }, { threshold: 0.2 });

    observer?.observe(element);
    return () => {
      observer?.disconnect();
      element.pause();
      attachedRef.current = false;
    };
  }, [reduceMotion, video]);

  useEffect(() => () => releaseLoadedVideo(videoRef.current), []);

  return (
    <video
      ref={videoRef}
      className={className}
      poster={video.poster ?? undefined}
      preload="none"
      autoPlay={!reduceMotion}
      muted
      loop
      playsInline
      aria-hidden="true"
      data-work-video-role="preview"
    />
  );
}

function CaseFeatureVideo({
  video,
  videoRef,
  reduceMotion,
}: {
  video: PublicCaseStudyVideoMedia;
  videoRef: { current: HTMLVideoElement | null };
  reduceMotion: boolean;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackFeedback, setPlaybackFeedback] = useState<'play' | 'pause' | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const pointerActivatedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;

    element.src = video.src;
    element.load();
    if (!reduceMotion) {
      void element.play().catch(() => undefined);
    }

    return () => {
      releaseLoadedVideo(element);
      if (videoRef.current === element) videoRef.current = null;
    };
  }, [reduceMotion, video, videoRef]);

  useEffect(() => () => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
  }, []);

  const showPlaybackFeedback = (feedback: 'play' | 'pause') => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    setPlaybackFeedback(feedback);
    feedbackTimerRef.current = window.setTimeout(() => {
      setPlaybackFeedback(null);
      feedbackTimerRef.current = null;
    }, 680);
  };

  const togglePlayback = (event: ReactMouseEvent<HTMLButtonElement>) => {
    const element = videoRef.current;
    if (!element) return;

    const pointerActivatedAt = pointerActivatedAtRef.current;
    const isPointerActivation = event.detail > 0
      || (pointerActivatedAt !== null && Date.now() - pointerActivatedAt < 1_000);
    pointerActivatedAtRef.current = null;
    if (isPointerActivation) {
      event.currentTarget.blur();
    }

    if (element.paused) {
      void element.play()
        .then(() => showPlaybackFeedback('play'))
        .catch(() => undefined);
      return;
    }

    element.pause();
    showPlaybackFeedback('pause');
  };

  return (
    <div className={styles.featureVideoShell} data-work-feature-video-shell>
      <video
        ref={videoRef}
        className={styles.featureVideo}
        poster={video.poster ?? undefined}
        preload="none"
        autoPlay={!reduceMotion}
        muted
        loop
        playsInline
        aria-label={video.alt}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        data-work-feature-video
      >
        {video.captionsSrc ? <track kind="captions" src={video.captionsSrc} /> : null}
      </video>
      <button
        className={styles.featurePlaybackSurface}
        type="button"
        aria-label={isPlaying ? `${video.alt}を一時停止` : `${video.alt}を再生`}
        aria-pressed={isPlaying}
        data-work-feature-playback
        onPointerDown={() => {
          pointerActivatedAtRef.current = Date.now();
        }}
        onClick={togglePlayback}
      >
        <AnimatePresence initial={false}>
          {playbackFeedback ? (
            <motion.span
              key={playbackFeedback}
              className={styles.featurePlaybackIndicator}
              aria-hidden="true"
              data-playback-feedback={playbackFeedback}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.72 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.2 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: 'easeOut' }}
            >
              {playbackFeedback === 'play' ? '▶' : 'Ⅱ'}
            </motion.span>
          ) : null}
        </AnimatePresence>
      </button>
    </div>
  );
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

function setDesktopCardListReady(cardList: HTMLElement, ready: boolean) {
  cardList.toggleAttribute('inert', !ready);
  if (ready) cardList.removeAttribute('aria-hidden');
  else cardList.setAttribute('aria-hidden', 'true');

  cardList.querySelectorAll<HTMLElement>('button').forEach((control) => {
    if (!ready) {
      control.tabIndex = -1;
      return;
    }
    control.removeAttribute('tabindex');
  });
}

function updateScatterFromScroll(
  section: HTMLElement,
  reduceMotion: boolean,
) {
  const stage = section.querySelector<HTMLElement>('[data-work-stage]');
  const stageAnchor = section.querySelector<HTMLElement>('[data-work-stage-anchor]');
  if (!stage || !stageAnchor) return;

  const rect = section.getBoundingClientRect();
  const stageFlowTop = stageAnchor.getBoundingClientRect().top - rect.top;
  const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
  const visualProgress = reduceMotion ? 0 : Math.min(Math.max(-rect.top / travel, 0), 1);
  const entryProgress = getScatterEntryProgress(
    rect.top,
    stageFlowTop,
    window.innerHeight,
    reduceMotion,
  );
  const entryVisuals = getOrbitStageVisuals(entryProgress, reduceMotion);
  const useContainedLayout = reduceMotion || !isFinePointer();

  section.style.setProperty('--work-progress', visualProgress.toFixed(4));
  section.style.setProperty('--work-rotation', `${(visualProgress * 34).toFixed(3)}deg`);
  section.style.setProperty('--work-entry-opacity', entryVisuals.opacity.toFixed(4));
  section.style.setProperty('--work-entry-scale', entryVisuals.scale.toFixed(4));
  section.style.setProperty('--work-entry-blur', `${entryVisuals.blur.toFixed(3)}px`);
  const orbitReady = entryProgress > 0.3 || reduceMotion;
  const desktopCardList = stage.querySelector<HTMLElement>('[data-work-card-list]');
  section.dataset.orbitReady = orbitReady ? 'true' : 'false';
  if (desktopCardList) setDesktopCardListReady(desktopCardList, orbitReady);

  section.querySelectorAll<HTMLElement>('[data-case-index]').forEach((card) => {
    const index = Number(card.dataset.caseIndex);
    const layout = (useContainedLayout ? STATIC_CARD_LAYOUT : CARD_LAYOUT)[index];
    if (!layout) return;
    const orbit = getOrbitalCardMotion({
      progress: entryProgress,
      index,
      targetX: resolveViewportOffset(layout.x),
      targetY: resolveViewportOffset(layout.y),
      targetZ: layout.z,
      targetRotate: Number.parseFloat(layout.rotate),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      reduceMotion,
    });
    const depthDrift = reduceMotion ? 0 : layout.depth * visualProgress * orbit.progress * 0.18;
    card.style.setProperty('--card-x-px', `${orbit.x.toFixed(3)}px`);
    card.style.setProperty('--card-y-px', `${orbit.y.toFixed(3)}px`);
    card.style.setProperty('--card-z-px', `${(orbit.z + depthDrift).toFixed(3)}px`);
    card.style.setProperty('--card-rotate-current', `${orbit.rotate.toFixed(3)}deg`);
    card.style.setProperty('--card-orbit-progress', orbit.progress.toFixed(4));
  });
}

function CaseCard({
  caseStudy,
  index,
  active,
  expanded,
  reduceMotion,
  onSelect,
  onOpen,
  onPointerEnter,
}: {
  caseStudy: PublicCaseStudy;
  index: number;
  active: boolean;
  expanded: boolean;
  reduceMotion: boolean;
  onSelect: (index: number) => void;
  onOpen: (index: number, trigger: HTMLButtonElement) => void;
  onPointerEnter: (event: ReactPointerEvent<HTMLElement>, index: number) => void;
}) {
  const theme = getTheme(caseStudy);
  const layout = CARD_LAYOUT[index] ?? CARD_LAYOUT[0];
  const title = statusCopy(caseStudy);
  const previewVideo = getVideoMedia(caseStudy, 'preview');
  const previewImage = getImageMedia(caseStudy);
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
    '--card-orbit-progress': 0,
    '--case-accent': theme.accent,
    '--case-accent-rgb': theme.accentSoft,
    '--card-order': index,
  };

  return (
    <article
      className={`${styles.card} ${active ? styles.cardActive : ''}`}
      data-case-index={index}
      data-active={active}
      data-expanded={expanded}
      role="listitem"
      style={cardStyle}
      onPointerEnter={(event) => onPointerEnter(event, index)}
    >
      <button
        className={styles.cardButton}
        id={`work-tab-${caseStudy.slug}`}
        type="button"
        data-index={index}
        data-tab-index={index}
        data-tab-group="desktop"
        data-work-trigger="true"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={expanded ? `work-detail-dialog-${caseStudy.slug}` : undefined}
        aria-label={`${title}の詳細を開く`}
        onClick={(event) => onOpen(index, event.currentTarget)}
        onFocus={() => onSelect(index)}
      >
        {previewVideo ? (
          <span className={styles.cardMedia} aria-hidden="true">
            <CasePreviewVideo video={previewVideo} reduceMotion={reduceMotion} className={styles.cardMediaVideo} />
          </span>
        ) : previewImage ? (
          <span className={styles.cardMedia} aria-hidden="true">
            <Image
              className={styles.cardMediaImage}
              src={previewImage.src}
              alt=""
              width={previewImage.width}
              height={previewImage.height}
              loading="lazy"
              sizes="(max-width: 768px) 100vw, 31vw"
              data-work-image-role="preview"
            />
          </span>
        ) : null}
        <span className={styles.cardTopline}>
          <span>CASE {String(caseStudy.displayOrder).padStart(2, '0')}</span>
          <span>{caseStudy.approved ? 'PUBLISHED' : 'PRIVATE PREVIEW'}</span>
        </span>
        <span className={styles.cardTitle}>{title}</span>
        {caseStudy.approved && approvedIndustry(caseStudy) ? (
          <span className={styles.cardMeta}>{approvedIndustry(caseStudy)}</span>
        ) : null}
        <span className={styles.cardRule} aria-hidden="true" />
        <span className={styles.cardHint}>{active ? 'CLICK / OPEN DETAILS' : 'SELECT CASE'}</span>
        <span className={styles.cardCorner} aria-hidden="true" />
      </button>
      <span className={styles.cardNumber} aria-hidden="true">
        {String(caseStudy.displayOrder).padStart(2, '0')}
      </span>
      <span className={styles.cardExpandIcon} aria-hidden="true">
        <span aria-hidden="true">↗</span>
      </span>
    </article>
  );
}

function MobileCaseItem({
  caseStudy,
  index,
  active,
  expanded,
  reduceMotion,
  onSelect,
  onOpen,
}: {
  caseStudy: PublicCaseStudy;
  index: number;
  active: boolean;
  expanded: boolean;
  reduceMotion: boolean;
  onSelect: (index: number) => void;
  onOpen: (index: number, trigger: HTMLButtonElement) => void;
}) {
  const theme = getTheme(caseStudy);
  const title = statusCopy(caseStudy);
  const previewVideo = getVideoMedia(caseStudy, 'preview');
  const previewImage = getImageMedia(caseStudy);
  const style: CSSVars = {
    '--case-accent': theme.accent,
    '--case-accent-rgb': theme.accentSoft,
  };

  return (
    <li className={`${styles.mobileItem} ${active ? styles.mobileItemActive : ''}`} style={style}>
      <button
        className={styles.mobileButton}
        type="button"
        data-index={index}
        data-tab-index={index}
        data-tab-group="mobile"
        data-work-trigger="true"
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={expanded ? `work-detail-dialog-${caseStudy.slug}` : undefined}
        aria-label={`${title}の詳細を開く`}
        id={`mobile-work-tab-${caseStudy.slug}`}
        onClick={(event) => {
          onSelect(index);
          onOpen(index, event.currentTarget);
        }}
        onFocus={() => onSelect(index)}
      >
        {previewVideo ? (
          <span className={styles.mobileMedia} aria-hidden="true">
            <CasePreviewVideo video={previewVideo} reduceMotion={reduceMotion} className={styles.mobileMediaVideo} />
          </span>
        ) : previewImage ? (
          <span className={styles.mobileMedia} aria-hidden="true">
            <Image
              className={styles.mobileMediaImage}
              src={previewImage.src}
              alt=""
              width={previewImage.width}
              height={previewImage.height}
              loading="lazy"
              sizes="100vw"
              data-work-image-role="preview"
            />
          </span>
        ) : null}
        <span className={styles.mobileIndex}>{String(caseStudy.displayOrder).padStart(2, '0')}</span>
        <span className={styles.mobileButtonCopy}>
          <span className={styles.mobileStatus}>{caseStudy.approved ? 'PUBLISHED' : 'PRIVATE PREVIEW'}</span>
          <span className={styles.mobileTitle}>{title}</span>
        </span>
        <span className={styles.mobilePlus} aria-hidden="true">↗</span>
      </button>
    </li>
  );
}

function ExpandedCaseDialog({
  caseStudy,
  index,
  origin,
  reduceMotion,
  featureVideoRef,
  onClose,
}: {
  caseStudy: PublicCaseStudy;
  index: number;
  origin: ExpansionOrigin;
  reduceMotion: boolean;
  featureVideoRef: { current: HTMLVideoElement | null };
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const theme = getTheme(caseStudy);
  const title = statusCopy(caseStudy);
  const industry = approvedIndustry(caseStudy);
  const highlights = approvedHighlights(caseStudy);
  const detail = caseStudy.approved ? caseStudy.detail : null;
  const featureVideo = getVideoMedia(caseStudy, 'full');
  const featureImage = getImageMedia(caseStudy);
  const dialogTitleId = `work-detail-title-${caseStudy.slug}`;
  const dialogDescriptionId = `work-detail-description-${caseStudy.slug}`;
  const style = {
    '--case-accent': theme.accent,
    '--case-accent-rgb': theme.accentSoft,
  } as CSSVars;

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ));
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  return (
    <motion.div
      className={styles.detailOverlay}
      data-work-detail-overlay
      style={style}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduceMotion ? { duration: 0 } : { duration: 0.34, ease: 'easeOut' }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.article
        ref={dialogRef}
        className={styles.expandedCard}
        id={`work-detail-dialog-${caseStudy.slug}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={detail || !caseStudy.approved ? dialogDescriptionId : undefined}
        tabIndex={-1}
        data-expanded-case={caseStudy.slug}
        style={style}
        initial={reduceMotion ? false : {
          opacity: 0.72,
          x: origin.x,
          y: origin.y,
          scale: origin.scale,
          rotateZ: (index - 2) * 2.4,
        }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotateZ: 0 }}
        exit={reduceMotion ? { opacity: 0 } : {
          opacity: 0,
          x: origin.x * 0.35,
          y: origin.y * 0.35,
          scale: Math.max(origin.scale, 0.72),
          rotateZ: (index - 2) * 1.2,
        }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 165, damping: 24, mass: 0.9 }}
        onKeyDown={handleDialogKeyDown}
      >
        <span className={styles.expandedScan} aria-hidden="true" />
        <span className={styles.expandedCorner} aria-hidden="true" />
        <header className={styles.expandedHeader}>
          <div>
            <span className={styles.expandedEyebrow}>CASE {String(caseStudy.displayOrder).padStart(2, '0')} / INLINE DETAIL</span>
            <span className={styles.expandedStatus}>{caseStudy.approved ? 'APPROVED CASE' : 'PRIVATE PREVIEW SLOT'}</span>
          </div>
          <button ref={closeRef} className={styles.expandedClose} type="button" onClick={onClose}>
            <span>CLOSE</span><span aria-hidden="true">×</span>
          </button>
        </header>

        <div className={styles.expandedVisual}>
          <div className={styles.expandedMediaFrame} data-work-feature-frame>
            {featureVideo ? (
              <CaseFeatureVideo
                video={featureVideo}
                videoRef={featureVideoRef}
                reduceMotion={reduceMotion}
              />
            ) : featureImage ? (
              <Image
                className={styles.featureImage}
                src={featureImage.src}
                alt={featureImage.alt}
                width={featureImage.width}
                height={featureImage.height}
                loading="eager"
                sizes="(max-width: 768px) calc(100vw - 2rem), 32rem"
                data-work-feature-image
              />
            ) : (
              <div aria-hidden="true">
                <WorkVisual accent={theme.accent} compact label={`CASE ${String(caseStudy.displayOrder).padStart(2, '0')} / FDE SIGNAL`} />
              </div>
            )}
          </div>
        </div>

        <div className={styles.expandedBody}>
          <span className={styles.expandedIndex} aria-hidden="true">{String(caseStudy.displayOrder).padStart(2, '0')}</span>
          {industry ? <span className={styles.expandedIndustry}>{industry}</span> : null}
          <h3 id={dialogTitleId}>{title}</h3>
          {detail ? (
            <dl className={styles.expandedDetail}>
              <div>
                <dt>プロジェクト名{detail.labelSuffix}</dt>
                <dd className={styles.expandedProjectName}>{detail.projectName}</dd>
              </div>
              <div>
                <dt>概要{detail.labelSuffix}</dt>
                <dd id={dialogDescriptionId}>{detail.overview}</dd>
              </div>
              <div>
                <dt>{detail.outcomesLabel}{detail.labelSuffix}</dt>
                <dd>
                  <ul className={styles.expandedOutcomes}>
                    {detail.outcomes.map(({ title: outcomeTitle, description }) => (
                      <li key={outcomeTitle}>
                        <strong>{outcomeTitle}{detail.labelSuffix}</strong>
                        <span>{description}</span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          ) : caseStudy.approved ? (
            <dl className={styles.expandedFacts}>
              {highlights.map(({ label, value }) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          ) : (
            <>
              <p id={dialogDescriptionId} className={styles.expandedDescription}>
                このケースの業界・課題・担当範囲・定性成果は、公開承認後にここへ反映します。
              </p>
              <dl className={`${styles.expandedFacts} ${styles.expandedFactsPending}`}>
                {['課題', '担当', '成果'].map((label) => (
                  <div key={label}><dt>{label}</dt><dd>公開承認後に反映</dd></div>
                ))}
              </dl>
            </>
          )}
        </div>

        <footer className={styles.expandedFooter}>
          <span>SELECTED WORK / {String(caseStudy.displayOrder).padStart(2, '0')} OF 05</span>
          <span>CLOSE TO RETURN</span>
        </footer>
      </motion.article>
    </motion.div>
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
  const expansionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const featureVideoRef = useRef<HTMLVideoElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [expansionOrigin, setExpansionOrigin] = useState<ExpansionOrigin>({ x: 0, y: 0, scale: 0.5 });
  const reduceMotion = useReducedMotion() ?? false;
  const caseStudies = cases;
  const caseCount = caseStudies.length;

  const activeCase = caseStudies[activeIndex] ?? caseStudies[0];
  const activeTheme = activeCase ? getTheme(activeCase) : THEMES.mint;
  const expandedCase = expandedIndex === null ? null : caseStudies[expandedIndex] ?? null;

  const handleSelect = useCallback((index: number) => {
    setActiveIndex(clampIndex(index, caseCount));
  }, [caseCount]);

  const handleOpen = useCallback((index: number, trigger: HTMLButtonElement) => {
    const selectedIndex = clampIndex(index, caseCount);
    const rect = trigger.getBoundingClientRect();
    const finalWidth = Math.min(window.innerWidth * 0.92, 608);
    setActiveIndex(selectedIndex);
    setExpansionOrigin({
      x: rect.left + rect.width / 2 - window.innerWidth / 2,
      y: rect.top + rect.height / 2 - window.innerHeight / 2,
      scale: Math.min(Math.max(rect.width / Math.max(finalWidth, 1), 0.34), 0.76),
    });
    expansionTriggerRef.current = trigger;
    setExpandedIndex(selectedIndex);
  }, [caseCount]);

  const handleClose = useCallback(() => {
    releaseLoadedVideo(featureVideoRef.current);
    featureVideoRef.current = null;
    setExpandedIndex(null);
  }, []);

  const handleCardPointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLElement>, index: number) => {
      if (expandedIndex === null && (event.pointerType === 'mouse' || isFinePointer())) handleSelect(index);
    },
    [expandedIndex, handleSelect],
  );

  const handleKeyboard = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (expandedIndex !== null) return;
      const target = event.target as HTMLElement;
      if (target.dataset.workTrigger !== 'true') return;

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
    [activeIndex, caseCount, expandedIndex, handleSelect],
  );

  useEffect(() => {
    if (expandedIndex === null) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => expansionTriggerRef.current?.focus({ preventScroll: true }));
    };
  }, [expandedIndex]);

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
      data-detail-open={expandedCase ? 'true' : 'false'}
      style={sectionStyle}
      onKeyDown={handleKeyboard}
    >
      <div className={styles.workIntro}>
        <p className={styles.eyebrow}>02 / SELECTED WORK</p>
        <h2 id="selected-work-title">実績例</h2>
        <p className={styles.introCopy}>
          実際の例をご紹介します。<br />
          <span className={styles.introCopyChunk}>WEBサイト、</span><span className={styles.introCopyChunk}>チラシ制作、</span><span className={styles.introCopyChunk}>SNSデータ運用化、</span><span className={styles.introCopyChunk}>アプリ開発など</span><br />
          <span className={styles.introCopyChunk}>様々な企業の悩みに合った</span><span className={styles.introCopyChunk}>技術を用いて</span><span className={styles.introCopyChunk}>解決を目指します。</span>
        </p>
        <span className={styles.scrollLabel}>
          <span className={styles.desktopInstruction}>HOVER TO SELECT / CLICK TO EXPAND</span>
          <span className={styles.mobileInstruction}>TAP TO EXPAND</span>
          {' / '}{String(activeIndex + 1).padStart(2, '0')}
        </span>
      </div>

      <span className={styles.stageAnchor} data-work-stage-anchor aria-hidden="true" />
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
          <div className={styles.tabList} role="list" aria-label="Selected work cases" data-work-card-list>
            {caseStudies.map((caseStudy, index) => (
              <CaseCard
                caseStudy={caseStudy}
                index={index}
                active={index === activeIndex}
                expanded={index === expandedIndex}
                reduceMotion={reduceMotion}
                onSelect={handleSelect}
                onOpen={handleOpen}
                onPointerEnter={handleCardPointerEnter}
                key={caseStudy.slug}
              />
            ))}
          </div>
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
        <div className={styles.mobileTabList}>
          <ul aria-label="Selected work cases">
            {caseStudies.map((caseStudy, index) => (
              <MobileCaseItem
                caseStudy={caseStudy}
                index={index}
                active={index === activeIndex}
                expanded={index === expandedIndex}
                reduceMotion={reduceMotion}
                onSelect={handleSelect}
                onOpen={handleOpen}
                key={caseStudy.slug}
              />
            ))}
          </ul>
        </div>
      </div>
      {typeof document !== 'undefined'
        ? createPortal(
          <AnimatePresence>
            {expandedCase ? (
              <ExpandedCaseDialog
                key={expandedCase.slug}
                caseStudy={expandedCase}
                index={expandedIndex ?? 0}
                origin={expansionOrigin}
                reduceMotion={reduceMotion}
                featureVideoRef={featureVideoRef}
                onClose={handleClose}
              />
            ) : null}
          </AnimatePresence>,
          document.body,
        )
        : null}
    </section>
  );
}

export default SelectedWork;

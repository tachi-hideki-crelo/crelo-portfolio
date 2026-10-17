'use client';

import type {
  CSSProperties,
  FocusEvent,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { WorkVisual } from './work-visual';
import {
  RESOLVE_GROW,
  getHalftoneDot,
  getLeadPath,
  getLuminanceLevels,
  getSliceWidths,
  liftLuminance,
} from './work-resolve';
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
  active,
  reduceMotion,
  className,
}: {
  video: PublicCaseStudyVideoMedia;
  active: boolean;
  reduceMotion: boolean;
  className: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const attachedRef = useRef(false);

  useEffect(() => {
    attachedRef.current = false;
  }, [video]);

  useEffect(() => {
    const element = videoRef.current;
    if (!element) return;
    if (reduceMotion || !active) {
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

    if (observer) observer.observe(element);
    else attachAndPlay();
    return () => {
      observer?.disconnect();
      element.pause();
    };
  }, [active, reduceMotion, video]);

  useEffect(() => () => {
    attachedRef.current = false;
    releaseLoadedVideo(videoRef.current);
  }, []);

  return (
    <video
      ref={videoRef}
      className={className}
      poster={video.poster ?? undefined}
      preload="none"
      autoPlay={!reduceMotion && active}
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


const BAND_GAP = 6;
const HOVER_INTENT_MS = 110;
const MOBILE_QUERY = '(max-width: 768px)';
const SUMMARY_ID = 'selected-work-active-summary';
const LEAD_DEPTH = 56;
const LEAD_INSET = 24;

function getFieldSource(caseStudy: PublicCaseStudy): string | null {
  const previewVideo = getVideoMedia(caseStudy, 'preview');
  if (previewVideo?.poster) return previewVideo.poster;
  return getImageMedia(caseStudy)?.src ?? null;
}

function getSummaryOutcomes(caseStudy: PublicCaseStudy): string[] {
  if (!caseStudy.approved) return ['公開承認後に反映'];
  const outcomes = caseStudy.detail?.outcomes.map(({ title }) => title) ?? [];
  if (outcomes.length > 0) return outcomes;
  return approvedHighlights(caseStudy).map(({ value }) => value);
}

/**
 * Draws the case media as a calm mint halftone, the same point language as the
 * hero field. Unapproved slots fall back to the bare grid.
 */
function HalftoneField({ src, rgb, className }: { src: string | null; rgb: string; className: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame: number | null = null;
    let image: HTMLImageElement | null = null;

    const draw = () => {
      frame = null;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const context = canvas.getContext('2d');
      if (!context || width === 0 || height === 0) return;

      const step = width < 480 ? 7 : 9;
      const columns = Math.ceil(width / step);
      const rows = Math.ceil(height / step);
      let luminances: Float32Array | null = null;
      if (image?.complete && image.naturalWidth > 0) {
        const sample = document.createElement('canvas');
        sample.width = columns;
        sample.height = rows;
        const sampleContext = sample.getContext('2d', { willReadFrequently: true });
        if (sampleContext) {
          const scale = Math.max(columns / image.naturalWidth, rows / image.naturalHeight);
          const drawWidth = image.naturalWidth * scale;
          const drawHeight = image.naturalHeight * scale;
          sampleContext.drawImage(image, (columns - drawWidth) / 2, (rows - drawHeight) / 2, drawWidth, drawHeight);
          try {
            const pixels = sampleContext.getImageData(0, 0, columns, rows).data;
            luminances = new Float32Array(columns * rows);
            for (let cell = 0; cell < luminances.length; cell += 1) {
              const offset = cell * 4;
              luminances[cell] = (pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114) / 255;
            }
          } catch {
            luminances = null;
          }
        }
      }

      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      const levels = luminances ? getLuminanceLevels(luminances) : null;
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const luminance = luminances && levels
            ? liftLuminance(levels.normalize(luminances[row * columns + column]))
            : 0;
          const dot = getHalftoneDot(luminance, step);
          context.fillStyle = `rgb(${rgb} / ${dot.alpha.toFixed(3)})`;
          context.beginPath();
          context.arc(column * step + step / 2, row * step + step / 2, dot.radius, 0, Math.PI * 2);
          context.fill();
        }
      }
    };

    const schedule = () => {
      if (frame === null) frame = window.requestAnimationFrame(draw);
    };

    if (src) {
      image = new window.Image();
      image.decoding = 'async';
      image.onload = schedule;
      image.src = src;
    }
    schedule();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    observer?.observe(canvas);

    return () => {
      observer?.disconnect();
      if (frame !== null) window.cancelAnimationFrame(frame);
      if (image) image.onload = null;
    };
  }, [rgb, src]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" data-work-halftone />;
}

function CaseSummary({ caseStudy, compact = false }: { caseStudy: PublicCaseStudy; compact?: boolean }) {
  const index = String(caseStudy.displayOrder).padStart(2, '0');
  const role = caseStudy.approved ? approvedText(caseStudy.role) : null;
  const projectName = caseStudy.approved ? caseStudy.detail?.projectName ?? null : null;
  const outcomes = getSummaryOutcomes(caseStudy);

  return (
    <>
      <div className={styles.summaryLead}>
        <p className={styles.summaryRole}>
          {compact ? role ?? 'PRIVATE PREVIEW' : `CASE ${index} — ${role ?? 'PRIVATE PREVIEW'}`}
        </p>
        <h3 className={styles.summaryTitle}>{statusCopy(caseStudy)}</h3>
        {!compact && projectName ? <p className={styles.summaryProject}>{projectName}</p> : null}
      </div>
      <ol className={styles.summaryOutcomes}>
        {outcomes.map((outcome, outcomeIndex) => (
          <li key={`${outcomeIndex}-${outcome}`}>
            <span>{compact ? '' : 'OUTCOME '}{String(outcomeIndex + 1).padStart(2, '0')}</span>
            {outcome}
          </li>
        ))}
      </ol>
    </>
  );
}

function ResolveSlice({
  caseStudy,
  index,
  caseCount,
  active,
  revealed,
  expanded,
  reduceMotion,
  onSelect,
  onOpen,
  onPointerEnter,
  onPointerLeave,
}: {
  caseStudy: PublicCaseStudy;
  index: number;
  caseCount: number;
  active: boolean;
  revealed: boolean;
  expanded: boolean;
  reduceMotion: boolean;
  onSelect: (index: number) => void;
  onOpen: (index: number, trigger: HTMLButtonElement) => void;
  onPointerEnter: (event: ReactPointerEvent<HTMLLIElement>, index: number) => void;
  onPointerLeave: () => void;
}) {
  const title = statusCopy(caseStudy);
  const theme = getTheme(caseStudy);
  const order = String(caseStudy.displayOrder).padStart(2, '0');
  const previewVideo = getVideoMedia(caseStudy, 'preview');
  const previewImage = getImageMedia(caseStudy);

  return (
    <li
      className={styles.slice}
      role="listitem"
      data-active={active}
      data-has-media={previewVideo || previewImage ? 'true' : 'false'}
      style={{ '--slice-acc': theme.accentSoft } as CSSVars}
      onPointerEnter={(event) => onPointerEnter(event, index)}
      onPointerLeave={onPointerLeave}
    >
      <button
        className={styles.sliceButton}
        id={`work-slice-${caseStudy.slug}`}
        type="button"
        data-index={index}
        data-tab-index={index}
        data-tab-group="work"
        data-work-trigger="true"
        aria-current={active ? 'true' : undefined}
        aria-describedby={active ? SUMMARY_ID : undefined}
        aria-haspopup="dialog"
        aria-expanded={expanded}
        aria-controls={expanded ? `work-detail-dialog-${caseStudy.slug}` : undefined}
        aria-label={active ? `${title}の詳細を開く` : title}
        onClick={(event) => {
          if (active || isFinePointer()) {
            onSelect(index);
            onOpen(index, event.currentTarget);
            return;
          }
          onSelect(index);
        }}
        onFocus={(event: FocusEvent<HTMLButtonElement>) => {
          if (event.currentTarget.matches(':focus-visible')) onSelect(index);
        }}
      >
        <span className={styles.slicePlate} aria-hidden="true">
          <HalftoneField src={getFieldSource(caseStudy)} rgb={theme.accentSoft} className={styles.sliceField} />
          {previewVideo ? (
            <span className={styles.sliceMedia}>
              <CasePreviewVideo
                video={previewVideo}
                active={active}
                reduceMotion={reduceMotion}
                className={styles.sliceMediaAsset}
              />
            </span>
          ) : previewImage ? (
            <span className={styles.sliceMedia}>
              <Image
                className={styles.sliceMediaAsset}
                src={previewImage.src}
                alt=""
                width={previewImage.width}
                height={previewImage.height}
                loading="lazy"
                sizes="(max-width: 768px) 100vw, 64vw"
                data-work-image-role="preview"
              />
            </span>
          ) : null}
          {active && revealed && !reduceMotion ? <span className={styles.sliceScan} /> : null}
        </span>
        <span className={styles.sliceTitle} aria-hidden="true">
          <span className={styles.sliceName}>{title}</span>
          <span className={styles.sliceMeta}>CASE {order} · {previewVideo ? 'MOTION' : 'STILL'}</span>
        </span>
        <span className={styles.sliceIndex} aria-hidden="true"><i />{order}</span>
        <span className={styles.sliceChevron} aria-hidden="true">＋</span>
        <span className={styles.sliceHud} aria-hidden="true">
          <span className={styles.sliceTag}>
            CASE <b>{order}</b> / {String(caseCount).padStart(2, '0')} · {previewVideo ? 'MOTION' : 'STILL'}
          </span>
          <span className={styles.sliceOpen}>詳細を見る<span>↗</span></span>
        </span>
      </button>
      {active ? (
        <div className={styles.sliceSummary}>
          <CaseSummary caseStudy={caseStudy} compact />
        </div>
      ) : null}
    </li>
  );
}

function ExpandedCaseDialog({
  caseStudy,
  origin,
  reduceMotion,
  featureVideoRef,
  onClose,
}: {
  caseStudy: PublicCaseStudy;
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
        }}
        animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : {
          opacity: 0,
          x: origin.x * 0.35,
          y: origin.y * 0.35,
          scale: Math.max(origin.scale, 0.72),
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

export function SelectedWork({ cases }: SelectedWorkProps) {
  const bandRef = useRef<HTMLUListElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const userSelectedRef = useRef(false);
  const expansionTriggerRef = useRef<HTMLButtonElement | null>(null);
  const featureVideoRef = useRef<HTMLVideoElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [expansionOrigin, setExpansionOrigin] = useState<ExpansionOrigin>({ x: 0, y: 0, scale: 0.5 });
  const [bandWidth, setBandWidth] = useState(0);
  const [hasEnteredView, setRevealed] = useState(false);
  const reduceMotion = useReducedMotion() ?? false;
  const caseStudies = cases;
  const caseCount = caseStudies.length;

  const activeCase = caseStudies[activeIndex] ?? caseStudies[0];
  const revealed = hasEnteredView || reduceMotion;
  const expandedCase = expandedIndex === null ? null : caseStudies[expandedIndex] ?? null;
  const widths = getSliceWidths({ bandWidth, count: caseCount, gap: BAND_GAP });
  const leadPath = getLeadPath({ activeIndex, widths, gap: BAND_GAP, inset: LEAD_INSET, depth: LEAD_DEPTH });

  const handleSelect = useCallback((index: number) => {
    userSelectedRef.current = true;
    setActiveIndex(clampIndex(index, caseCount));
  }, [caseCount]);

  const clearHoverIntent = useCallback(() => {
    if (hoverTimerRef.current === null) return;
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  }, []);

  const handleOpen = useCallback((index: number, trigger: HTMLButtonElement) => {
    clearHoverIntent();
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
  }, [caseCount, clearHoverIntent]);

  const handleClose = useCallback(() => {
    releaseLoadedVideo(featureVideoRef.current);
    featureVideoRef.current = null;
    setExpandedIndex(null);
  }, []);

  const handleSlicePointerEnter = useCallback(
    (event: ReactPointerEvent<HTMLLIElement>, index: number) => {
      if (expandedIndex !== null || event.pointerType !== 'mouse') return;
      clearHoverIntent();
      hoverTimerRef.current = window.setTimeout(() => {
        hoverTimerRef.current = null;
        handleSelect(index);
      }, HOVER_INTENT_MS);
    },
    [clearHoverIntent, expandedIndex, handleSelect],
  );

  const handleKeyboard = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
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
      const tabGroup = target.getAttribute('data-tab-group') ?? 'work';
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
    const band = bandRef.current;
    if (!band) return;
    setBandWidth(Math.round(band.getBoundingClientRect().width));
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBandWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(band);
    return () => observer.disconnect();
  }, []);

  // Hold the first resolve until the band is actually on screen so the scan
  // and media wipe are seen instead of playing below the fold at load.
  useEffect(() => {
    const band = bandRef.current;
    if (!band || hasEnteredView || reduceMotion) return;
    if (typeof IntersectionObserver === 'undefined') {
      const frame = window.requestAnimationFrame(() => setRevealed(true));
      return () => window.cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      setRevealed(true);
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(band);
    return () => observer.disconnect();
  }, [hasEnteredView, reduceMotion]);

  useEffect(() => clearHoverIntent, [clearHoverIntent]);

  // On phones the previously open row collapses above the new one; keep the
  // newly opened row in view once the height transition has settled.
  useEffect(() => {
    if (!userSelectedRef.current || !window.matchMedia(MOBILE_QUERY).matches) return;
    const timer = window.setTimeout(() => {
      const slice = bandRef.current?.children[activeIndex];
      if (!(slice instanceof HTMLElement)) return;
      const top = slice.getBoundingClientRect().top;
      if (top < 64 || top > window.innerHeight * 0.6) {
        window.scrollTo({ top: window.scrollY + top - 72, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }, reduceMotion ? 0 : 960);
    return () => window.clearTimeout(timer);
  }, [activeIndex, reduceMotion]);

  const resolveStyle: CSSVars = {
    '--slice-grow': RESOLVE_GROW,
    '--band-gap': `${BAND_GAP}px`,
    '--active-acc': (activeCase ? getTheme(activeCase) : THEMES.mint).accentSoft,
    '--lead-depth': `${LEAD_DEPTH}px`,
    ...(bandWidth > 0
      ? {
        '--plate-width': `${Math.round(widths.open)}px`,
        '--plate-height': `${Math.round(bandWidth * 0.75)}px`,
      }
      : {}),
  };

  if (!activeCase) return null;

  return (
    <section
      className={styles.selectedWork}
      id="selected-work"
      aria-labelledby="selected-work-title"
      data-detail-open={expandedCase ? 'true' : 'false'}
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
      </div>

      <div className={styles.resolve} style={resolveStyle}>
        <p className={styles.bandMeta}>
          <span><b>{String(caseCount).padStart(2, '0')}</b> CASES</span>
          <span className={styles.desktopInstruction}>HOVER TO RESOLVE / CLICK TO EXPAND</span>
          <span className={styles.mobileInstruction}>TAP TO OPEN</span>
        </p>
        <ul
          ref={bandRef}
          className={styles.band}
          role="list"
          aria-label="Selected work cases"
          data-work-band
          data-revealed={revealed}
        >
          {caseStudies.map((caseStudy, index) => (
            <ResolveSlice
              caseStudy={caseStudy}
              index={index}
              caseCount={caseCount}
              active={index === activeIndex}
              revealed={revealed}
              expanded={index === expandedIndex}
              reduceMotion={reduceMotion}
              onSelect={handleSelect}
              onOpen={handleOpen}
              onPointerEnter={handleSlicePointerEnter}
              onPointerLeave={clearHoverIntent}
              key={caseStudy.slug}
            />
          ))}
        </ul>
        <div className={styles.infoRow} data-work-info>
          {bandWidth > 0 && revealed ? (
            <svg className={styles.lead} aria-hidden="true">
              <path key={activeIndex} d={leadPath} pathLength={1} />
            </svg>
          ) : null}
          <div className={styles.infoContent} id={SUMMARY_ID} key={activeCase.slug}>
            <CaseSummary caseStudy={activeCase} />
          </div>
        </div>
      </div>

      {typeof document !== 'undefined'
        ? createPortal(
          <AnimatePresence>
            {expandedCase ? (
              <ExpandedCaseDialog
                key={expandedCase.slug}
                caseStudy={expandedCase}
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

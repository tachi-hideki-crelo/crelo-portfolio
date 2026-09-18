'use client';

import type {
  CSSProperties,
  FocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import { createPortal } from 'react-dom';

import {
  getPendingTemplateMessage,
  getSafeGalleryUrl,
  getSafeTemplateThumbnail,
  getSafeTemplateUrl,
  getSafeTemplateVideo,
  type WebTemplate,
  type WebTemplateAccent,
  type WebTemplateGalleryConfig,
  webTemplateGallery,
} from './web-template-gallery-data';
import {
  damp,
  DRAG_CLICK_SUPPRESSION_THRESHOLD,
  getTemplateBurstTransform,
  getTemplatePlacement,
  hasExceededDragThreshold,
  NORMALIZED_TEMPLATE_PLACEMENTS,
  wrapNormalized,
} from './web-template-gallery-field';
import { getTemplateGalleryTimeline } from './web-template-gallery-motion';
import styles from './web-template-gallery.module.css';

type CSSVars = CSSProperties & Record<`--${string}`, string | number>;

type PointerState = {
  pointerId: number | null;
  pointerType: string;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  velocityX: number;
  velocityY: number;
  axis: 'horizontal' | 'vertical' | null;
};

type FieldState = {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
};

const ACCENT_RGB: Record<WebTemplateAccent, string> = {
  mint: '166 255 219',
  cyan: '121 220 255',
  amber: '255 199 121',
  violet: '197 168 255',
  rose: '255 159 203',
};

const INITIAL_POINTER_STATE: PointerState = {
  pointerId: null,
  pointerType: '',
  startX: 0,
  startY: 0,
  lastX: 0,
  lastY: 0,
  velocityX: 0,
  velocityY: 0,
  axis: null,
};

const INITIAL_FIELD_STATE: FieldState = { x: 0, y: 0, targetX: 0, targetY: 0 };

export default function WebTemplateGallery({ config = webTemplateGallery }: { config?: WebTemplateGalleryConfig }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const fieldStageRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const fieldRef = useRef<FieldState>({ ...INITIAL_FIELD_STATE });
  const pointerRef = useRef<PointerState>({ ...INITIAL_POINTER_STATE });
  const suppressClickRef = useRef(false);
  const suppressClickTimerRef = useRef<number | null>(null);
  const fieldFrameRef = useRef<number | null>(null);
  const timelineFrameRef = useRef<number | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<WebTemplate | null>(null);
  const detailTriggerRef = useRef<HTMLElement | null>(null);
  const detailCloseRef = useRef<HTMLButtonElement | null>(null);
  const reduceMotion = useReducedMotion() ?? false;
  const templates = config.templates;
  const galleryUrl = getSafeGalleryUrl(config);

  useEffect(() => {
    if (!selectedTemplate) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    detailCloseRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => detailTriggerRef.current?.focus({ preventScroll: true }));
    };
  }, [selectedTemplate]);

  const handleDetailKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setSelectedTemplate(null);
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = event.currentTarget;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  const writeTimeline = useCallback(() => {
    const section = sectionRef.current;
    if (!section) return;

    const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
    const progress = reduceMotion ? 1 : Math.min(Math.max(-section.getBoundingClientRect().top / travel, 0), 1);
    const timeline = getTemplateGalleryTimeline(progress, reduceMotion);
    section.dataset.galleryProgress = timeline.progress.toFixed(4);
    section.dataset.galleryPhase = timeline.phase;
    section.style.setProperty('--gallery-title-opacity', timeline.titleOpacity.toFixed(4));
    section.style.setProperty('--gallery-body-opacity', timeline.bodyOpacity.toFixed(4));
    section.style.setProperty('--gallery-cta-opacity', timeline.ctaOpacity.toFixed(4));
    section.style.setProperty('--gallery-cue-opacity', timeline.cueOpacity.toFixed(4));
    section.style.setProperty('--gallery-burst', timeline.burst.toFixed(4));
    section.style.setProperty('--gallery-compact', timeline.compact.toFixed(4));
    section.style.setProperty('--gallery-explore', timeline.explore.toFixed(4));
    section.style.setProperty('--gallery-settle', timeline.settle.toFixed(4));
    section.style.setProperty('--gallery-scroll-cue-opacity', timeline.scrollCueOpacity.toFixed(4));

    const fieldStage = fieldStageRef.current;
    const fieldInteractive = reduceMotion || timeline.burst >= 1;
    if (fieldStage) {
      fieldStage.inert = !fieldInteractive;
      fieldStage.setAttribute('aria-hidden', fieldInteractive ? 'false' : 'true');
    }
    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const stagger = (index % 5) * 0.08;
      const burstProgress = reduceMotion ? 1 : Math.max(0, Math.min(1, (timeline.burst - stagger) / Math.max(1 - stagger, Number.EPSILON)));
      const burst = getTemplateBurstTransform(index, burstProgress);
      card.style.setProperty('--template-burst-progress', burstProgress.toFixed(4));
      card.style.setProperty('--template-burst-x', burst.offsetX.toFixed(5));
      card.style.setProperty('--template-burst-y', burst.offsetY.toFixed(5));
      card.style.setProperty('--template-burst-z', `${burst.z.toFixed(3)}px`);
      card.style.setProperty('--template-burst-rotate', `${burst.rotate.toFixed(3)}deg`);
      card.style.setProperty('--template-burst-scale', burst.scale.toFixed(4));
      card.style.setProperty('--template-burst-opacity', burst.opacity.toFixed(4));
      card.style.setProperty('--template-burst-blur', `${burst.blur.toFixed(3)}px`);
      const action = card.querySelector<HTMLElement>('[data-template-action]');
      if (action) action.tabIndex = fieldInteractive ? 0 : -1;
    });
  }, [reduceMotion]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const requestTimelineUpdate = () => {
      if (timelineFrameRef.current !== null) return;
      timelineFrameRef.current = window.requestAnimationFrame(() => {
        timelineFrameRef.current = null;
        writeTimeline();
      });
    };

    writeTimeline();
    if (reduceMotion) return undefined;

    window.addEventListener('scroll', requestTimelineUpdate, { passive: true });
    window.addEventListener('resize', requestTimelineUpdate, { passive: true });
    return () => {
      window.removeEventListener('scroll', requestTimelineUpdate);
      window.removeEventListener('resize', requestTimelineUpdate);
      if (timelineFrameRef.current !== null) window.cancelAnimationFrame(timelineFrameRef.current);
    };
  }, [reduceMotion, writeTimeline]);

  const applyFieldToCards = useCallback(() => {
    const field = fieldRef.current;
    cardRefs.current.forEach((card, index) => {
      if (!card) return;
      const placement = getTemplatePlacement(index);
      card.style.setProperty('--template-field-x', wrapNormalized(placement.x + field.x).toFixed(5));
      card.style.setProperty('--template-field-y', wrapNormalized(placement.y + field.y).toFixed(5));
    });
  }, []);

  useEffect(() => {
    const stage = fieldStageRef.current;
    if (!stage) return;

    applyFieldToCards();
    if (reduceMotion) return undefined;

    let fieldInView = true;
    let documentVisible = document.visibilityState === 'visible';
    let previousTime = performance.now();
    const stopFieldFrame = () => {
      if (fieldFrameRef.current !== null) window.cancelAnimationFrame(fieldFrameRef.current);
      fieldFrameRef.current = null;
    };
    const animateField = (now: number) => {
      fieldFrameRef.current = null;
      if (!fieldInView || !documentVisible) return;
      const deltaSeconds = Math.max((now - previousTime) / 1000, 0);
      previousTime = now;
      const field = fieldRef.current;
      field.x = damp(field.x, field.targetX, 8, deltaSeconds);
      field.y = damp(field.y, field.targetY, 8, deltaSeconds);
      applyFieldToCards();
      fieldFrameRef.current = window.requestAnimationFrame(animateField);
    };

    const startFieldFrame = () => {
      if (!fieldInView || !documentVisible || fieldFrameRef.current !== null) return;
      previousTime = performance.now();
      fieldFrameRef.current = window.requestAnimationFrame(animateField);
    };
    const onVisibilityChange = () => {
      documentVisible = document.visibilityState === 'visible';
      if (documentVisible) startFieldFrame();
      else stopFieldFrame();
    };
    const observer = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => {
          fieldInView = entry?.isIntersecting ?? true;
          if (fieldInView) startFieldFrame();
          else stopFieldFrame();
        }, { rootMargin: '120px 0px' });
    observer?.observe(stage);
    document.addEventListener('visibilitychange', onVisibilityChange);

    startFieldFrame();
    return () => {
      stopFieldFrame();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [applyFieldToCards, reduceMotion]);

  useEffect(() => {
    const stage = fieldStageRef.current;
    if (!stage || reduceMotion) return undefined;

    const onWheel = (event: WheelEvent) => {
      // This listener is intentionally passive: the page keeps its native
      // vertical scroll while deltaX/deltaY steer the field camera.
      fieldRef.current.targetX -= event.deltaX * 0.0014;
      fieldRef.current.targetY -= event.deltaY * 0.00075;
    };
    stage.addEventListener('wheel', onWheel, { passive: true });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [reduceMotion]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    pointerRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      lastX: event.clientX,
      lastY: event.clientY,
      velocityX: 0,
      velocityY: 0,
      axis: null,
    };
  }, [reduceMotion]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (reduceMotion || pointer.pointerId !== event.pointerId) return;

    const totalX = event.clientX - pointer.startX;
    const totalY = event.clientY - pointer.startY;
    if (event.pointerType === 'touch' && pointer.axis === null) {
      if (Math.abs(totalX) < 2 && Math.abs(totalY) < 2) return;
      pointer.axis = Math.abs(totalX) >= Math.abs(totalY) ? 'horizontal' : 'vertical';
    }
    if (pointer.axis === 'vertical') return;

    // Capture only an actual drag. Capturing on pointerdown redirects a
    // regular card click to the field instead of its detail button.
    if (!event.currentTarget.hasPointerCapture(event.pointerId) && hasExceededDragThreshold(
      pointer.startX, pointer.startY, event.clientX, event.clientY, DRAG_CLICK_SUPPRESSION_THRESHOLD,
    )) event.currentTarget.setPointerCapture(event.pointerId);

    const deltaX = event.clientX - pointer.lastX;
    const deltaY = event.clientY - pointer.lastY;
    pointer.lastX = event.clientX;
    pointer.lastY = event.clientY;
    pointer.velocityX = deltaX;
    pointer.velocityY = deltaY;
    const width = Math.max(event.currentTarget.clientWidth, 1);
    const height = Math.max(event.currentTarget.clientHeight, 1);
    fieldRef.current.targetX -= deltaX / width;
    fieldRef.current.targetY -= deltaY / height;
  }, [reduceMotion]);

  const finishPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const pointer = pointerRef.current;
    if (pointer.pointerId !== event.pointerId) return;
    const didDrag = hasExceededDragThreshold(
      pointer.startX,
      pointer.startY,
      event.clientX,
      event.clientY,
      DRAG_CLICK_SUPPRESSION_THRESHOLD,
    );
    if (didDrag) {
      suppressClickRef.current = true;
      if (suppressClickTimerRef.current !== null) window.clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = false;
        suppressClickTimerRef.current = null;
      }, 350);
      fieldRef.current.targetX -= pointer.velocityX * 0.012;
      fieldRef.current.targetY -= pointer.velocityY * 0.012;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    pointerRef.current = { ...INITIAL_POINTER_STATE };
  }, []);

  const handleCardClick = useCallback((event: ReactMouseEvent<HTMLElement>, template: WebTemplate) => {
    if (suppressClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
        suppressClickTimerRef.current = null;
      }
      return;
    }
    detailTriggerRef.current = event.currentTarget;
    setLiveMessage('');
    setSelectedTemplate(template);
  }, []);

  const handleCardFocus = useCallback((event: FocusEvent<HTMLElement>, index: number) => {
    const card = event.currentTarget.closest<HTMLElement>('[data-template-card]');
    if (!card) return;
    const placement = getTemplatePlacement(index);
    fieldRef.current.targetX = 0.5 - placement.x;
    fieldRef.current.targetY = 0.5 - placement.y;
  }, []);

  const handleCardKeyDown = useCallback((event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      suppressClickRef.current = false;
      if (suppressClickTimerRef.current !== null) {
        window.clearTimeout(suppressClickTimerRef.current);
        suppressClickTimerRef.current = null;
      }
    }
  }, []);

  const renderCard = (template: WebTemplate, index: number) => {
    const placement = NORMALIZED_TEMPLATE_PLACEMENTS[index] ?? NORMALIZED_TEMPLATE_PLACEMENTS[0];
    const safeThumbnail = getSafeTemplateThumbnail(template);
    const thumbnailAlt = safeThumbnail ? template.thumbnailAlt ?? template.title : '';
    const cardStyle: CSSVars = {
      '--template-index': index,
      '--template-accent': `rgb(${ACCENT_RGB[template.accent]})`,
      '--template-accent-rgb': ACCENT_RGB[template.accent],
      '--template-field-x': placement.x,
      '--template-field-y': placement.y,
      '--template-z': `${placement.z}px`,
      '--template-rotate': `${placement.rotate}deg`,
      '--template-scale': placement.scale,
      '--template-burst-progress': 0,
      '--template-burst-x': 0,
      '--template-burst-y': 0,
      '--template-burst-z': '-180px',
      '--template-burst-rotate': `${placement.rotate}deg`,
      '--template-burst-scale': 0.56,
      '--template-burst-opacity': 0,
      '--template-burst-blur': '11px',
    };
    const actionProps = {
      className: styles.cardAction,
      'data-template-action': 'true',
      tabIndex: -1,
      'aria-label': `${template.title}の詳細を開く`,
      'aria-haspopup': 'dialog' as const,
      'aria-controls': `template-detail-${template.id}`,
      onClick: (event: ReactMouseEvent<HTMLElement>) => handleCardClick(event, template),
      onFocus: (event: FocusEvent<HTMLElement>) => handleCardFocus(event, index),
      onKeyDown: handleCardKeyDown,
    };

    return (
      <article
        key={template.id}
        ref={(node) => { cardRefs.current[index] = node; }}
        className={styles.card}
        role="listitem"
        data-template-card
        data-template-index={template.order}
        data-template-accent={template.accent}
        data-template-pending="false"
        style={cardStyle}
      >
        <div className={styles.cardSurface}>
          <span className={styles.cardBleed} aria-hidden="true" />
          <div className={styles.cardTopline}>
            <span>{template.title}</span>
            <span aria-hidden="true">{String(template.order).padStart(2, '0')}</span>
          </div>
          <div className={styles.thumbnail}>
            {safeThumbnail ? <Image className={styles.thumbnailImage} src={safeThumbnail} alt={thumbnailAlt} fill sizes="(max-width: 720px) 42vw, 18vw" /> : <span className={styles.thumbnailPlaceholder} aria-hidden="true">WEB / TEMPLATE</span>}
          </div>
          <div className={styles.cardFooter}>
            <span className={styles.cardStatus}>VIEW DETAILS</span>
            <span className={styles.cardArrow} aria-hidden="true">↗</span>
          </div>
          <button {...actionProps} type="button"><span className={styles.srOnly}>詳細を見る</span></button>
        </div>
      </article>
    );
  };

  return (
    <section
      ref={sectionRef}
      id="templates"
      className={styles.gallerySection}
      aria-labelledby="templates-title"
      data-reduced-motion={reduceMotion ? 'true' : 'false'}
      data-gallery-progress="0.0000"
      data-gallery-phase="title"
    >
      <div className={styles.stickyStage}>
        <div className={`section-marker ${styles.marker}`}><span>04</span><span>WEB TEMPLATE GALLERY</span></div>

        <header className={styles.intro}>
          <p className="eyebrow eyebrow--amber">START SMALL / CHOOSE A DIRECTION</p>
          <h2 id="templates-title" aria-label="まずは簡単なWEBサイトから。"><span className={styles.titleLine}>まずは簡単な</span><span className={styles.titleLine}>WEBサイトから。</span></h2>
          <div className={styles.introLower}>
            <p className={styles.description}>大がかりな開発でなくても構いません。まずはお気軽に、シンプルなWebサイトの制作だけお受けすることも可能です。公開済みのテンプレートから、目的や雰囲気に合うものを選んで始められます。</p>
            <div className={styles.ctaBlock}>
              <span className={styles.ctaLabel}>VIEW ALL TEMPLATES ↗</span>
              {galleryUrl ? (
                <a className={styles.cta} href={galleryUrl} target="_blank" rel="noopener noreferrer">テンプレート一覧を見る <span aria-hidden="true">↗</span></a>
              ) : (
                <span className={styles.pendingLabel} role="status">一覧URL準備中</span>
              )}
            </div>
          </div>
        </header>

        <div
          ref={fieldStageRef}
          className={styles.fieldStage}
          role="region"
          aria-roledescription="Web template gallery"
          aria-label="Web template choices"
          aria-hidden="true"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointer}
          onPointerCancel={finishPointer}
        >
          <div className={styles.field} role="list">
            {templates.map(renderCard)}
          </div>
        </div>

        <p className={styles.interactionCue} aria-hidden="true"><span>TWO-FINGER SWIPE / DRAG TO EXPLORE</span><span className={styles.scrollContinue}>SCROLL TO CONTINUE</span></p>
        <p className={styles.liveRegion} aria-live="polite" aria-atomic="true" role="status">{liveMessage}</p>
      </div>
      {typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {selectedTemplate ? (
            <motion.div
              key={selectedTemplate.id}
              className={styles.detailOverlay}
              data-template-detail-overlay
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : .24 }}
              onPointerDown={(event) => { if (event.target === event.currentTarget) setSelectedTemplate(null); }}
              style={{ '--template-accent': `rgb(${ACCENT_RGB[selectedTemplate.accent]})`, '--template-accent-rgb': ACCENT_RGB[selectedTemplate.accent] } as CSSVars}
            >
              <motion.article
                id={`template-detail-${selectedTemplate.id}`}
                className={styles.detailPanel}
                role="dialog"
                aria-modal="true"
                aria-labelledby={`template-detail-title-${selectedTemplate.id}`}
                aria-describedby={`template-detail-description-${selectedTemplate.id}`}
                tabIndex={-1}
                onKeyDown={handleDetailKeyDown}
                initial={reduceMotion ? false : { opacity: .6, y: 40, scale: .88 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 22, scale: .94 }}
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 210, damping: 28 }}
              >
                <header className={styles.detailHeader}>
                  <span>TEMPLATE / {String(selectedTemplate.order).padStart(2, '0')} <small>DESIGN FILE</small></span>
                  <button ref={detailCloseRef} className={styles.detailClose} type="button" onClick={() => setSelectedTemplate(null)}>CLOSE <span aria-hidden="true">×</span></button>
                </header>
                <div className={styles.detailVisual}>
                  {getSafeTemplateVideo(selectedTemplate) ? (
                    <video src={getSafeTemplateVideo(selectedTemplate) ?? undefined} poster={getSafeTemplateThumbnail(selectedTemplate) ?? undefined} controls playsInline preload="metadata" aria-label={`${selectedTemplate.title}の紹介動画`} />
                  ) : getSafeTemplateThumbnail(selectedTemplate) ? (
                    <Image src={getSafeTemplateThumbnail(selectedTemplate)!} alt={selectedTemplate.thumbnailAlt ?? selectedTemplate.title} fill sizes="(max-width: 720px) calc(100vw - 3rem), 44rem" />
                  ) : null}
                  {!getSafeTemplateVideo(selectedTemplate) && <span className={styles.videoPending}>VIDEO / COMING SOON</span>}
                </div>
                <div className={styles.detailBody}>
                  <p className={styles.detailCategory}>{selectedTemplate.category}</p>
                  <h3 id={`template-detail-title-${selectedTemplate.id}`}>{selectedTemplate.title}</h3>
                  <p className={styles.detailTagline}>{selectedTemplate.tagline}</p>
                  <p id={`template-detail-description-${selectedTemplate.id}`} className={styles.detailDescription}>{selectedTemplate.description}</p>
                  <dl className={styles.detailFacts}>
                    <div><dt>表現の特徴</dt><dd>{selectedTemplate.traits}</dd></div>
                    <div><dt>向いている案件</dt><dd>{selectedTemplate.fit}</dd></div>
                  </dl>
                  <div className={styles.detailActions}>
                    {getSafeTemplateUrl(selectedTemplate) ? <a className={styles.detailVisit} href={getSafeTemplateUrl(selectedTemplate)!} target="_blank" rel="noopener noreferrer">サイトを見る <span aria-hidden="true">↗</span></a> : <span className={styles.pendingLabel}>{getPendingTemplateMessage(selectedTemplate)}</span>}
                    {galleryUrl ? <a className={styles.detailGallery} href={galleryUrl} target="_blank" rel="noopener noreferrer">テンプレート一覧を見る <span aria-hidden="true">↗</span></a> : <span className={styles.pendingLabel}>一覧URL準備中</span>}
                  </div>
                </div>
              </motion.article>
            </motion.div>
          ) : null}
        </AnimatePresence>, document.body,
      ) : null}
    </section>
  );
}

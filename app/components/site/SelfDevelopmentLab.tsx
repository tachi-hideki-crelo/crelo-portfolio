'use client';

import Image from 'next/image';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';

import type { SelfBuiltTool } from '../../lib/types';
import { selfBuiltTools } from './self-development-data';
import { getSelfDevelopmentItemTimeline, getSelfDevelopmentStageTimeline } from './self-development-motion';
import styles from './self-development-lab.module.css';

type CSSVars = CSSProperties & Record<`--${string}`, string | number>;

const ACCENTS = {
  mint: { hex: '#a6ffdb', rgb: '166 255 219' },
  cyan: { hex: '#79dcff', rgb: '121 220 255' },
  amber: { hex: '#ffc779', rgb: '255 199 121' },
  violet: { hex: '#c5a8ff', rgb: '197 168 255' },
} as const;

function hasFinePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: fine)').matches;
}

function toolNumber(order: number): string {
  return String(order).padStart(2, '0');
}

export default function SelfDevelopmentLab({ tools = selfBuiltTools }: { tools?: readonly SelfBuiltTool[] }) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const nodeRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const frameRef = useRef<number | null>(null);
  const visibleRef = useRef(false);
  const reduceMotion = useReducedMotion() ?? false;

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const update = () => {
      frameRef.current = null;
      if (!reduceMotion && (!visibleRef.current || document.hidden)) return;
      const travel = Math.max(section.offsetHeight - window.innerHeight, 1);
      const rect = section.getBoundingClientRect();
      const progress = reduceMotion ? 1 : Math.min(Math.max(-rect.top / travel, 0), 1);
      const stage = getSelfDevelopmentStageTimeline(progress, reduceMotion);
      const mobile = window.innerWidth <= 720;

      section.dataset.labProgress = stage.progress.toFixed(4);
      section.dataset.labPhase = stage.phase;
      section.style.setProperty('--lab-title-reveal', stage.titleReveal.toFixed(4));
      section.style.setProperty('--lab-body-reveal', stage.bodyReveal.toFixed(4));
      section.style.setProperty('--lab-title-blur', `${((1 - stage.titleReveal) * 14).toFixed(3)}px`);
      section.style.setProperty('--lab-body-blur', `${((1 - stage.bodyReveal) * 9).toFixed(3)}px`);
      section.style.setProperty('--lab-title-echo-opacity', (stage.titleReveal * 0.18).toFixed(4));
      section.style.setProperty('--lab-title-echo-secondary-opacity', (stage.titleReveal * 0.16).toFixed(4));
      section.style.setProperty('--lab-title-lift', `${stage.titleLiftVh.toFixed(3)}vh`);
      section.style.setProperty('--lab-title-scale', stage.titleScale.toFixed(4));
      section.style.setProperty('--lab-title-opacity', stage.titleOpacity.toFixed(4));
      section.style.setProperty('--lab-rail-progress', stage.railProgress.toFixed(4));
      section.style.setProperty('--lab-atmosphere', stage.atmosphere.toFixed(4));
      section.style.setProperty('--lab-outro', stage.outro.toFixed(4));
      const introCue = Math.max(0, Math.min(1, (0.22 - stage.progress) / 0.12));
      section.style.setProperty('--lab-intro-cue-opacity', (introCue * 0.75).toFixed(4));
      section.style.setProperty('--lab-outro-cue-opacity', (stage.outro * 0.78).toFixed(4));

      itemRefs.current.forEach((item, index) => {
        if (!item) return;
        const timeline = getSelfDevelopmentItemTimeline(progress, index, reduceMotion);
        item.style.setProperty('--lab-x', `${(timeline.xVw * (mobile ? 0.32 : 1)).toFixed(3)}vw`);
        item.style.setProperty('--lab-y', `${timeline.yVh.toFixed(3)}vh`);
        item.style.setProperty('--lab-scale', timeline.scale.toFixed(4));
        item.style.setProperty('--lab-opacity', timeline.opacity.toFixed(4));
        item.style.setProperty('--lab-blur', `${timeline.blurPx.toFixed(3)}px`);
        item.style.setProperty('--lab-rotate', `${timeline.rotateDeg.toFixed(3)}deg`);
        item.style.setProperty('--lab-card-reveal', timeline.cardReveal.toFixed(4));
        item.style.setProperty('--lab-card-scan-y', `${(9 + (timeline.cardReveal * 79)).toFixed(2)}%`);
        item.style.setProperty('--lab-copy-opacity', timeline.copyReveal.toFixed(4));
        item.style.setProperty('--lab-copy-y', `${((1 - timeline.copyReveal) * 34).toFixed(3)}px`);
        item.style.setProperty('--lab-copy-blur', `${((1 - timeline.copyReveal) * 12).toFixed(3)}px`);
        item.style.setProperty('--lab-copy-clip', `${((1 - timeline.copyReveal) * 100).toFixed(2)}%`);
        item.style.setProperty('--lab-portal', timeline.portal.toFixed(4));
        item.style.setProperty('--lab-portal-scale', (0.6 + (timeline.portal * 0.55)).toFixed(4));
        item.style.setProperty('--lab-afterimage', timeline.afterimage.toFixed(4));
        item.style.setProperty('--lab-afterimage-opacity', (timeline.afterimage * 0.52).toFixed(4));
        item.style.setProperty('--lab-bleed-opacity', (timeline.afterimage * 0.7).toFixed(4));
        item.dataset.active = timeline.interactive || reduceMotion ? 'true' : 'false';
        item.inert = !(timeline.interactive || reduceMotion);
        const link = item.querySelector<HTMLAnchorElement>('a[data-lab-detail-link]');
        if (link) link.tabIndex = timeline.interactive || reduceMotion ? 0 : -1;
      });

      nodeRefs.current.forEach((node, index) => {
        if (!node) return;
        node.dataset.active = progress >= (0.12 + (index * 0.18)) ? 'true' : 'false';
      });
    };

    const requestUpdate = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(update);
    };

    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
      section.dataset.viewportActive = entry.isIntersecting ? 'true' : 'false';
      if (entry.isIntersecting) requestUpdate();
    }, { rootMargin: '20% 0px 20% 0px', threshold: 0 });
    if (observer) observer.observe(section);
    else {
      visibleRef.current = true;
      section.dataset.viewportActive = 'true';
    }

    const onVisibilityChange = () => {
      section.dataset.documentVisible = document.hidden ? 'false' : 'true';
      if (!document.hidden) requestUpdate();
    };
    requestUpdate();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [reduceMotion, tools]);

  const resetPointer = useCallback((item: HTMLElement) => {
    item.style.setProperty('--lab-tilt-x', '0deg');
    item.style.setProperty('--lab-tilt-y', '0deg');
    item.style.setProperty('--lab-glint-x', '50%');
    item.style.setProperty('--lab-glint-y', '44%');
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (reduceMotion || event.pointerType === 'touch' || !hasFinePointer()) return;
    const item = event.currentTarget.closest<HTMLElement>('[data-lab-tool]');
    if (!item || item.dataset.active !== 'true') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max((event.clientX - rect.left) / Math.max(rect.width, 1), 0), 1);
    const y = Math.min(Math.max((event.clientY - rect.top) / Math.max(rect.height, 1), 0), 1);
    item.style.setProperty('--lab-tilt-x', `${((0.5 - y) * 7).toFixed(3)}deg`);
    item.style.setProperty('--lab-tilt-y', `${((x - 0.5) * 8).toFixed(3)}deg`);
    item.style.setProperty('--lab-glint-x', `${(x * 100).toFixed(2)}%`);
    item.style.setProperty('--lab-glint-y', `${(y * 100).toFixed(2)}%`);
  }, [reduceMotion]);

  const renderCard = (tool: SelfBuiltTool) => {
    const number = toolNumber(tool.order);
    const cardContent = (
      <div className={styles.cardFrame}>
        <span className={styles.cardAfterimage} aria-hidden="true" />
        <span className={styles.cardScan} aria-hidden="true" />
        <div className={styles.cardTopline}><span>TOOL {number}</span><span>{tool.status === 'published' ? 'LAB FILE / LIVE' : 'LAB FILE / PENDING'}</span></div>
        <div className={styles.cardViewport}>
          {tool.thumbnailSrc && tool.thumbnailAlt ? (
            <Image className={styles.thumbnail} src={tool.thumbnailSrc} alt={tool.thumbnailAlt} fill sizes="(max-width: 720px) 88vw, 42vw" />
          ) : (
            <div className={styles.schematic} aria-hidden="true">
              <span className={styles.schematicGrid} />
              <span className={styles.schematicOrbit} />
              <span className={styles.schematicCore}>LAB / {number}</span>
              <span className={`${styles.schematicNode} ${styles.schematicNodeOne}`} />
              <span className={`${styles.schematicNode} ${styles.schematicNodeTwo}`} />
              <span className={`${styles.schematicNode} ${styles.schematicNodeThree}`} />
              <span className={styles.schematicWave} />
            </div>
          )}
        </div>
        <div className={styles.cardBottomline}><span>PERSONAL PROTOTYPE SLOT</span><strong>{tool.status === 'published' ? 'VIEW TOOL FILE ↗' : 'DETAIL PREPARING'}</strong></div>
        <i className={`${styles.corner} ${styles.cornerTl}`} aria-hidden="true" /><i className={`${styles.corner} ${styles.cornerTr}`} aria-hidden="true" /><i className={`${styles.corner} ${styles.cornerBl}`} aria-hidden="true" /><i className={`${styles.corner} ${styles.cornerBr}`} aria-hidden="true" />
      </div>
    );

    if (tool.status === 'published' && tool.slug) {
      return <a className={styles.cardLink} data-lab-detail-link href={`/lab/${tool.slug}`} aria-label={`${tool.title}の詳細を見る`} onPointerMove={handlePointerMove} onPointerLeave={(event) => resetPointer(event.currentTarget.closest<HTMLElement>('[data-lab-tool]') ?? event.currentTarget)}>{cardContent}</a>;
    }
    return <div className={styles.cardSurface} onPointerMove={handlePointerMove} onPointerLeave={(event) => resetPointer(event.currentTarget.closest<HTMLElement>('[data-lab-tool]') ?? event.currentTarget)}>{cardContent}</div>;
  };

  return (
    <section
      ref={sectionRef}
      id="lab"
      className={styles.labSection}
      aria-labelledby="lab-title"
      data-reduced-motion={reduceMotion ? 'true' : 'false'}
      data-lab-progress="0.0000"
      data-lab-phase="intro"
      data-viewport-active="false"
      data-document-visible="true"
    >
      <div className={styles.stickyStage}>
        <div className={styles.atmosphere} aria-hidden="true">
          <span className={styles.gridPlane} />
          <span className={styles.signalBeam} />
          <span className={styles.horizonGlow} />
          <span className={styles.scanPlane} />
          {Array.from({ length: 12 }, (_, index) => (
            <span
              className={styles.particle}
              style={{
                '--particle-x': `${6 + (index * 7.6)}%`,
                '--particle-y': `${16 + ((index % 5) * 15)}%`,
                '--particle-size': `${2 + (index % 3)}px`,
                '--particle-opacity': (0.18 + ((index % 4) * 0.09)).toFixed(2),
                '--particle-duration': `${5 + (index * 0.35)}s`,
              } as CSSVars}
              key={index}
            />
          ))}
        </div>

        <div className={`section-marker ${styles.marker}`}><span>05</span><span>SELF-BUILT TOOLS</span></div>

        <header className={styles.intro}>
          <p className={styles.eyebrow}>PERSONAL LAB / BUILT FROM CURIOSITY</p>
          <h2 id="lab-title" data-echo="自己開発">自己開発</h2>
          <p className={styles.lead}>気になったことを、そのままにしない。日々の小さな不便や、試してみたいアイデアを起点に、ツールやプロトタイプを自分で設計・開発しています。</p>
        </header>

        <div className={styles.signalRail} aria-hidden="true">
          <span className={styles.signalRailTrack} />
          <span className={styles.signalRailFill} />
          {tools.map((tool, index) => <span ref={(node) => { nodeRefs.current[index] = node; }} className={styles.signalNode} style={{ '--node-top': `${13 + (index * 24)}%` } as CSSVars} data-active="false" key={tool.id} />)}
        </div>

        <div className={styles.toolStage} aria-label="自己開発ツール">
          {tools.map((tool, index) => {
            const accent = ACCENTS[tool.accent];
            const number = toolNumber(tool.order);
            const published = tool.status === 'published';
            const itemStyle: CSSVars = {
              '--lab-accent': accent.hex,
              '--lab-accent-rgb': accent.rgb,
              '--lab-index': index,
              '--lab-tilt-x': '0deg',
              '--lab-tilt-y': '0deg',
              '--lab-glint-x': '50%',
              '--lab-glint-y': '44%',
            };
            return (
              <article
                ref={(node) => { itemRefs.current[index] = node; }}
                className={styles.toolRow}
                data-lab-tool={tool.id}
                data-lab-order={tool.order}
                data-side={index % 2 === 0 ? 'left' : 'right'}
                data-status={tool.status}
                data-active="false"
                aria-labelledby={`lab-tool-${number}`}
                style={itemStyle}
                key={tool.id}
              >
                <span className={styles.portal} aria-hidden="true"><i /><i /></span>
                <div className={styles.visualColumn}>{renderCard(tool)}</div>
                <div className={styles.toolCopy}>
                  <p className={styles.toolCategory}>{tool.category} / {number}</p>
                  <h3 id={`lab-tool-${number}`}>{tool.title}</h3>
                  <p className={styles.toolSummary}>
                    {tool.status === 'placeholder' ? (
                      <>ツールの目的、解決したい課題、<span className={styles.keepPhrase}>主な機能をここに掲載します。</span></>
                    ) : tool.summary}
                  </p>
                  <dl className={styles.toolMeta}>
                    <div><dt>STATUS</dt><dd>{published ? 'PUBLISHED' : 'DETAIL PREPARING'}</dd></div>
                    <div><dt>STACK</dt><dd>{tool.tags.length ? tool.tags.join(' / ') : 'DETAILS PENDING'}</dd></div>
                  </dl>
                </div>
              </article>
            );
          })}
        </div>

        <div className={styles.cues} aria-hidden="true"><span>SCROLL TO ACTIVATE LAB</span><span>SCROLL TO PROFILE</span></div>
      </div>
    </section>
  );
}

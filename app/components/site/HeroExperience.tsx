'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { getHeroTimeline } from './hero-timeline';

const HeroCosmosCanvas = dynamic(() => import('../visual/HeroCosmosCanvas'), {
  ssr: false,
  loading: () => <div className="hero-cosmos hero-cosmos--loading" data-fallback="canvas2d" aria-hidden="true" />,
});

type HeroExperienceProps = {
  entranceReady: boolean;
  entranceSequence: number;
};

export default function HeroExperience({ entranceReady, entranceSequence }: HeroExperienceProps) {
  const heroRef = useRef<HTMLElement>(null);
  const motionReduced = useReducedMotion();
  const [visualStatic, setVisualStatic] = useState(false);
  const [ctaInteractive, setCtaInteractive] = useState(false);
  const ctaInteractiveRef = useRef(false);
  const formationAnimationRef = useRef<{ stop: () => void } | null>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end end'] });
  const progress = useSpring(scrollYProgress, { stiffness: 115, damping: 28, mass: 0.24 });
  const formationProgress = useMotionValue(0);
  const fdeOpacity = useTransform(progress, (value) => getHeroTimeline(value).fdeOpacity);
  const statementOpacity = useTransform(progress, (value) => getHeroTimeline(value).statementOpacity);
  const statementFirstOpacity = useTransform(progress, (value) => getHeroTimeline(value).statementFirstOpacity);
  const statementSecondOpacity = useTransform(progress, (value) => getHeroTimeline(value).statementSecondOpacity);
  const ctaOpacity = useTransform(progress, (value) => getHeroTimeline(value).ctaOpacity);
  const coordinateOpacity = useTransform(progress, (value) => getHeroTimeline(value).coordinateOpacity);
  const fdeShift = useTransform(fdeOpacity, [0, 1], ['2.3rem', '0rem']);
  const statementShift = useTransform(statementOpacity, [0, 1], ['2.2rem', '0rem']);
  const ctaShift = useTransform(ctaOpacity, [0, 1], ['1.5rem', '0rem']);
  const fdeBlur = useTransform(fdeOpacity, [0, 1], ['blur(14px)', 'blur(0px)']);
  const fdeTracking = useTransform(fdeOpacity, [0, 1], ['.18em', '-.04em']);
  const fdeMask = useTransform(fdeOpacity, [0, 1], ['inset(0 100% 0 0)', 'inset(0 0% 0 0)']);
  const statementBlur = useTransform(statementOpacity, [0, 1], ['blur(11px)', 'blur(0px)']);
  const statementTracking = useTransform(statementOpacity, [0, 1], ['.12em', '0em']);
  const statementMask = useTransform(statementOpacity, [0, 1], ['inset(0 0 100% 0)', 'inset(0 0 0% 0)']);
  const handleStaticChange = useCallback((staticMode: boolean) => {
    setVisualStatic(staticMode);
  }, []);
  const staticMode = motionReduced === true || visualStatic;
  const ctaIsInteractive = staticMode || ctaInteractive;
  useEffect(() => {
    formationAnimationRef.current?.stop();
    formationAnimationRef.current = null;
    if (motionReduced === true) {
      formationProgress.set(1);
      return;
    }
    // Replaying the intro from a later act must not leave visible copy floating
    // over a temporarily empty scene. Only reset at the Hero's opening act.
    const scrollAlreadyAdvanced = progress.get() >= 0.14;
    if (!entranceReady) {
      formationProgress.set(scrollAlreadyAdvanced ? 1 : 0);
      return;
    }
    if (scrollAlreadyAdvanced) {
      formationProgress.set(1);
      return;
    }
    formationProgress.set(0);
    const controls = animate(formationProgress, 1, {
      // Let the intro dissolve into the background field before the first
      // particles ignite; the empty beat is part of the requested handoff.
      delay: 0.32,
      duration: 2.25,
      ease: [0.16, 0.84, 0.22, 1],
    });
    formationAnimationRef.current = controls;
    return () => {
      controls.stop();
      if (formationAnimationRef.current === controls) formationAnimationRef.current = null;
    };
  }, [entranceReady, entranceSequence, formationProgress, motionReduced, progress]);
  useMotionValueEvent(progress, 'change', (value) => {
    // Fast scrolling may overtake the time-driven entrance. Complete the
    // structure before the FDE copy enters at the same 0.14 boundary.
    if (value >= 0.14 && formationProgress.get() < 1) {
      formationAnimationRef.current?.stop();
      formationAnimationRef.current = null;
      formationProgress.set(1);
    }
    const nextInteractive = staticMode || (value >= 0.8 && value < 0.94);
    if (ctaInteractiveRef.current === nextInteractive) return;
    ctaInteractiveRef.current = nextInteractive;
    setCtaInteractive(nextInteractive);
  });

  return (
    <section ref={heroRef} id="top" className="hero-story" data-static={staticMode ? 'true' : 'false'} aria-labelledby="hero-title">
      <div className="hero-story__sticky">
        <motion.div className="hero-story__coordinates" aria-hidden="true" style={{ opacity: staticMode ? 1 : coordinateOpacity }}>
          <span>FIELD / SYSTEM 001</span>
          <span>ROUTE / OBSERVE → SHIP</span>
        </motion.div>

        <div className="hero-story__cosmos" aria-hidden="true">
          <HeroCosmosCanvas progress={progress} formationProgress={formationProgress} forceStatic={motionReduced === true} onStaticChange={handleStaticChange} />
        </div>

        <div className="hero-story__copy">
          <motion.div className="hero-story__fde-copy" data-echo="Forward Deployed Engineer" style={{ opacity: staticMode ? 1 : fdeOpacity, y: staticMode ? 0 : fdeShift, filter: staticMode ? 'none' : fdeBlur, letterSpacing: staticMode ? '-.04em' : fdeTracking, clipPath: staticMode ? 'inset(0 0% 0 0)' : fdeMask }}>
            <p className="eyebrow eyebrow--mint">Forward deployed practice / 001</p>
            <h1 id="hero-title" aria-label="Forward Deployed Engineer — Business × AI × Software" className="hero-story__title">
              <span className="hero-story__line hero-story__line--primary" aria-hidden="true">
                <span><span className="hero-story__initial hero-story__initial--forward">F</span>orward <span className="hero-story__initial hero-story__initial--deployed">D</span>eployed</span>
                <span><span className="hero-story__initial hero-story__initial--engineer">E</span>ngineer</span>
              </span>
              <span className="hero-story__line hero-story__line--accent">Business × AI × Software</span>
            </h1>
          </motion.div>

          <motion.div className="hero-story__statement" aria-label="Crelo value proposition" style={{ opacity: staticMode ? 1 : statementOpacity, y: staticMode ? 0 : statementShift, filter: staticMode ? 'none' : statementBlur, letterSpacing: staticMode ? '0em' : statementTracking, clipPath: staticMode ? 'inset(0 0 0% 0)' : statementMask }}>
            <motion.p className="hero-story__statement-line" style={{ opacity: staticMode ? 1 : statementFirstOpacity }}>課題整理から設計・開発・導入まで。</motion.p>
            <motion.p className="hero-story__statement-line" style={{ opacity: staticMode ? 1 : statementSecondOpacity }}>事業の課題を、技術で解決します。</motion.p>
          </motion.div>

          <motion.a className="hero-story__cta" href="#selected-work" aria-hidden={!ctaIsInteractive} tabIndex={ctaIsInteractive ? 0 : -1} style={{ opacity: staticMode ? 1 : ctaOpacity, y: staticMode ? 0 : ctaShift, pointerEvents: ctaIsInteractive ? 'auto' : 'none' }}>
            <span className="hero-story__cta-line" aria-hidden="true" />
            Inspect selected work
            <span aria-hidden="true">↘</span>
          </motion.a>
        </div>

        <div className="hero-story__progress" aria-hidden="true">
          <motion.span style={{ scaleX: progress }} />
        </div>
      </div>
    </section>
  );
}

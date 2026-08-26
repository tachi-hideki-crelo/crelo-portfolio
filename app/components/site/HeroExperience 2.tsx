'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { motion, useReducedMotion } from 'motion/react';

export default function HeroExperience() {
  const heroRef = useRef<HTMLElement>(null);
  const frameRef = useRef<number | null>(null);
  const [progress, setProgress] = useState(0);
  const motionReduced = useReducedMotion();

  useEffect(() => {
    if (motionReduced) return;

    const update = () => {
      frameRef.current = null;
      const element = heroRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const travel = Math.max(1, element.offsetHeight - window.innerHeight);
      setProgress(Math.max(0, Math.min(1, -rect.top / travel)));
    };
    const schedule = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(update);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    return () => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [motionReduced]);

  const style = { '--hero-progress': progress } as CSSProperties;
  const reduced = motionReduced === true;
  const firstStatementProgress = reduced ? 1 : Math.max(0, Math.min(1, (progress - 0.12) / 0.22));
  const secondStatementProgress = reduced ? 1 : Math.max(0, Math.min(1, (progress - 0.42) / 0.22));
  return (
    <section ref={heroRef} id="top" className="hero-story" aria-labelledby="hero-title" style={style}>
      <div className="hero-story__sticky">
        <div className="hero-story__coordinates" aria-hidden="true">
          <span>FIELD / SYSTEM 001</span>
          <span>ROUTE / OBSERVE → SHIP</span>
        </div>
        <div className="hero-story__copy">
          <motion.p className="eyebrow eyebrow--mint" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionReduced ? 0.01 : 0.7, delay: motionReduced ? 0 : 0.15 }}>Forward deployed practice / 001</motion.p>
          <motion.h1 id="hero-title" aria-label="Forward Deployed Engineer — Business × AI × Software" className="hero-story__title" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: motionReduced ? 0.01 : 0.85, delay: motionReduced ? 0 : 0.25 }}>
            <span className="hero-story__line hero-story__line--primary"><span>Forward Deployed</span>{' '}<span>Engineer</span></span>{' '}
            <span className="hero-story__line hero-story__line--accent">Business × AI × Software</span>
          </motion.h1>
          <motion.div className="hero-story__statement" aria-label="Crelo value proposition" initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: motionReduced ? 0.01 : 0.7, delay: motionReduced ? 0 : 0.55 }}>
            <p className="hero-story__statement-line" style={{ opacity: firstStatementProgress, transform: `translate3d(0, ${(1 - firstStatementProgress) * 1.2}rem, 0)` }}>課題整理から設計・開発・導入まで。</p>
            <p className="hero-story__statement-line" style={{ opacity: secondStatementProgress, transform: `translate3d(0, ${(1 - secondStatementProgress) * 1.2}rem, 0)` }}>事業の課題を、技術で解決します。</p>
          </motion.div>
          <a className="hero-story__cta" href="#selected-work"><span className="hero-story__cta-line" aria-hidden="true" /> Inspect selected work <span aria-hidden="true">↘</span></a>
        </div>
        <div className="hero-story__instrument" aria-hidden="true">
          <span className="instrument__label">LIVE FIELD MAP</span>
          <div className="instrument__map"><span className="instrument__orbit instrument__orbit--outer" /><span className="instrument__orbit instrument__orbit--inner" /><span className="instrument__route instrument__route--one" /><span className="instrument__route instrument__route--two" /><span className="instrument__pulse" /><span className="instrument__axis instrument__axis--x" /><span className="instrument__axis instrument__axis--y" /></div>
          <div className="instrument__readout"><span>OBSERVE</span><span>ALIGN</span><span>SHIP</span></div>
        </div>
        <div className="hero-story__progress" aria-hidden="true"><span style={{ transform: `scaleX(${progress})` }} /></div>
      </div>
    </section>
  );
}

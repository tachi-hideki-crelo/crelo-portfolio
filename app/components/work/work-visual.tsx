import type { CSSProperties } from 'react';

import styles from './work-visual.module.css';

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

type WorkVisualProps = {
  accent: string;
  compact?: boolean;
  label?: string;
};

const NODES = ['SIGNAL', 'FRAME', 'BUILD', 'LAND'] as const;

/**
 * A deliberately abstract route map. It communicates the FDE hand-off without
 * presenting an unapproved client screenshot or an invented metric.
 */
export function WorkVisual({ accent, compact = false, label = 'SYSTEM ROUTE' }: WorkVisualProps) {
  const style: ThemeStyle = {
    '--work-accent': accent,
  };

  return (
    <div className={`${styles.visual} ${compact ? styles.compact : ''}`} style={style} role="img" aria-label={label}>
      <div className={styles.scanline} aria-hidden="true" />
      <div className={styles.visualHeader} aria-hidden="true">
        <span>{label}</span>
        <span>LIVE / 04</span>
      </div>
      <div className={styles.route} aria-hidden="true">
        {NODES.map((node, index) => (
          <span className={styles.nodeWrap} key={node}>
            <span className={styles.node}>
              <span className={styles.nodePulse} />
              <span className={styles.nodeLabel}>{node}</span>
              <span className={styles.nodeCode}>0{index + 1}</span>
            </span>
            {index < NODES.length - 1 ? <span className={styles.connector} /> : null}
          </span>
        ))}
      </div>
      <div className={styles.readout} aria-hidden="true">
        <span className={styles.readoutBar} />
        <span>CONTEXT → INTERFACE → DEPLOYMENT</span>
      </div>
      <span className={styles.corner} aria-hidden="true" />
    </div>
  );
}

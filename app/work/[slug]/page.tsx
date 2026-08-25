/* eslint-disable @next/next/no-html-link-for-pages -- plain anchors keep static detail routes resilient in Vinext previews. */
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';

import { caseStudies, getCaseStudy } from '../../lib/content';

import { getPublicOrigin } from '../../seo-config';
import { WorkVisual } from '../../components/work/work-visual';
import { getApprovedMedia, getApprovedOgMedia, isPublicCaseStudy } from '../../components/work/work-metadata';
import styles from '../../components/work/work-detail.module.css';

type WorkPageProps = {
  params: Promise<{ slug: string }>;
};

const FIELD_LABELS = [
  ['課題', 'challenge'],
  ['制約', 'constraints'],
  ['担当', 'role'],
  ['発見', 'discovery'],
  ['設計', 'design'],
  ['実装', 'implementation'],
  ['導入', 'rollout'],
  ['定性成果', 'qualitativeOutcome'],
  ['技術', 'technologies'],
  ['承認媒体', 'media'],
] as const;

function approvedText(value: string | null): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function displayTitle(displayOrder: number, title: string | null, approved: boolean): string {
  if (approved) return approvedText(title) ?? 'Case study';
  return `CASE ${String(displayOrder).padStart(2, '0')} / PRIVATE SLOT`;
}

function pendingValue(): string {
  return '公開承認後に反映';
}

function displayValue(value: unknown, approved: boolean): string {
  if (!approved) return pendingValue();
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.join(' / ');
  }
  if (typeof value === 'string' && value.trim()) return value;
  return '—';
}

function getThemeAccent(theme: string): string {
  return {
    mint: '#a6ffdb',
    cyan: '#7bdcff',
    violet: '#c5a8ff',
    amber: '#ffd28a',
    rose: '#ff9fcb',
  }[theme] ?? '#a6ffdb';
}

export const dynamicParams = false;

export function generateStaticParams() {
  return caseStudies.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: WorkPageProps): Promise<Metadata> {
  const { slug } = await params;
  const caseStudy = getCaseStudy(slug);
  if (!caseStudy) return { title: 'Case not found | Crelo', robots: { index: false, follow: false } };

  const title = displayTitle(caseStudy.displayOrder, caseStudy.title, caseStudy.approved);
  const description = caseStudy.approved
    ? approvedText(caseStudy.challenge) ?? approvedText(caseStudy.role) ?? 'Crelo case study.'
    : '公開承認後に反映されるCreloのケーススタディ。';
  const publicCase = isPublicCaseStudy(caseStudy);
  const publicOrigin = publicCase ? getPublicOrigin()?.origin ?? null : null;
  const approvedOgMedia = publicCase ? getApprovedOgMedia(caseStudy) : undefined;
  const canonical = publicOrigin ? `${publicOrigin}/work/${caseStudy.slug}` : undefined;
  return {
    title: `${title} | Crelo`,
    description,
    robots: publicCase ? { index: true, follow: true } : { index: false, follow: false },
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: `${title} | Crelo`,
      description,
      ...(approvedOgMedia ? { images: [{ url: approvedOgMedia.src, alt: approvedOgMedia.alt }] } : {}),
    },
    twitter: {
      card: approvedOgMedia ? 'summary_large_image' : 'summary',
      title: `${title} | Crelo`,
      description,
      ...(approvedOgMedia ? { images: [approvedOgMedia.src] } : {}),
    },
  };
}

export default async function WorkDetailPage({ params }: WorkPageProps) {
  const { slug } = await params;
  const caseStudy = getCaseStudy(slug);
  if (!caseStudy) notFound();

  const currentIndex = caseStudies.findIndex((item) => item.slug === caseStudy.slug);
  const previous = caseStudies[(currentIndex - 1 + caseStudies.length) % caseStudies.length];
  const next = caseStudies[(currentIndex + 1) % caseStudies.length];
  const title = displayTitle(caseStudy.displayOrder, caseStudy.title, caseStudy.approved);
  const accent = getThemeAccent(caseStudy.theme);
  const approvedMedia = getApprovedMedia(caseStudy);
  const heroLead = caseStudy.approved
    ? approvedText(caseStudy.challenge) ?? approvedText(caseStudy.role) ?? 'このケースの公開要約です。'
    : 'このケースの公開情報は、承認済みの文章・媒体が揃い次第、ここへ反映します。';
  const processDetails = {
    Frame: caseStudy.discovery,
    Prove: caseStudy.design,
    Build: caseStudy.implementation,
    Land: caseStudy.rollout,
  } as const;

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={styles.page}
      style={{ '--detail-accent': accent } as CSSProperties & Record<'--detail-accent', string>}
    >
      <div className={styles.noise} aria-hidden="true" />
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Crelo home">
          <Image className={styles.brandMark} src="/assets/crelo-logo.png" alt="Crelo" width={32} height={32} priority />
          <span>CRELO / WORK</span>
        </a>
        <a className={styles.headerLink} href="/#selected-work">
          <span>Selected Work</span>
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <div className={styles.content}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <a href="/">Crelo</a>
          <span aria-hidden="true">/</span>
          <a href="/#selected-work">Selected Work</a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{String(caseStudy.displayOrder).padStart(2, '0')}</span>
        </nav>

        <section className={styles.hero} aria-labelledby="work-detail-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>
              CASE {String(caseStudy.displayOrder).padStart(2, '0')} / {caseStudy.approved ? 'PUBLISHED CASE' : 'PRIVATE PREVIEW'}
            </p>
            <h1 id="work-detail-title">{title}</h1>
            <p className={styles.heroLead}>{heroLead}</p>
            <div className={styles.heroMeta}>
              <span>STATUS</span>
              <strong>{caseStudy.approved ? 'APPROVED' : 'PENDING APPROVAL'}</strong>
            </div>
          </div>
          <div className={styles.heroVisual}>
            <WorkVisual accent={accent} label={`CASE ${String(caseStudy.displayOrder).padStart(2, '0')} / FDE ROUTE`} />
          </div>
        </section>

        <section className={styles.factGrid} aria-labelledby="work-facts-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>CASE FILE / PUBLICATION GATE</p>
            <h2 id="work-facts-title">承認された事実だけを、公開する。</h2>
          </div>
          <div className={styles.facts}>
            {FIELD_LABELS.map(([label, key]) => {
              const value = key === 'media'
                ? approvedMedia.map((media) => media.alt)
                : caseStudy[key];
              return (
                <article className={styles.fact} key={key}>
                  <h3>{label}</h3>
                  <p>{displayValue(value, caseStudy.approved)}</p>
                </article>
              );
            })}
          </div>
        </section>

        {approvedMedia.length > 0 ? (
          <section className={styles.mediaSection} aria-labelledby="work-media-title">
            <div className={styles.sectionHeading}>
              <p className={styles.eyebrow}>APPROVED MEDIA / PUBLIC MATERIAL</p>
              <h2 id="work-media-title">公開承認された媒体。</h2>
            </div>
            <div className={styles.mediaGallery}>
              {approvedMedia.map((media, index) => (
                <figure className={styles.mediaItem} key={`${media.kind}-${media.src}-${index}`}>
                  {media.kind === 'image' ? (
                    <Image
                      className={styles.mediaImage}
                      src={media.src}
                      alt={media.alt}
                      width={media.width}
                      height={media.height}
                      sizes="(max-width: 620px) 100vw, 60vw"
                    />
                  ) : (
                    <video
                      className={styles.mediaVideo}
                      controls
                      playsInline
                      preload="metadata"
                      poster={media.poster || undefined}
                      aria-label={media.alt}
                    >
                      <source src={media.src} />
                      {media.captionsSrc ? (
                        <track kind="captions" src={media.captionsSrc} srcLang="ja" label="日本語" />
                      ) : null}
                    </video>
                  )}
                  <figcaption>{media.alt}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.process} aria-labelledby="work-process-title">
          <div className={styles.sectionHeading}>
            <p className={styles.eyebrow}>FDE METHOD / 04 STEPS</p>
            <h2 id="work-process-title">Frame → Prove → Build → Land</h2>
          </div>
          <div className={styles.processGrid}>
            {(['Frame', 'Prove', 'Build', 'Land'] as const).map((step, index) => (
              <div className={styles.processStep} key={step}>
                <span>0{index + 1}</span>
                <strong>{step}</strong>
                <p>{caseStudy.approved ? approvedText(processDetails[step]) ?? 'Case detail.' : pendingValue()}</p>
              </div>
            ))}
          </div>
        </section>

        <nav className={styles.caseNav} aria-label="Case study navigation">
          <a href={`/work/${previous.slug}`} className={styles.caseNavLink}>
            <span className={styles.caseNavLabel}>Previous case</span>
            <strong>← {displayTitle(previous.displayOrder, previous.title, previous.approved)}</strong>
          </a>
          <a href="/#selected-work" className={`${styles.caseNavLink} ${styles.caseNavCenter}`}>
            <span className={styles.caseNavLabel}>All cases</span>
            <strong>Selected Work</strong>
          </a>
          <a href={`/work/${next.slug}`} className={`${styles.caseNavLink} ${styles.caseNavRight}`}>
            <span className={styles.caseNavLabel}>Next case</span>
            <strong>{displayTitle(next.displayOrder, next.title, next.approved)} →</strong>
          </a>
        </nav>

        <section className={styles.contactCta} aria-labelledby="work-contact-title">
          <div>
            <p className={styles.eyebrow}>NEXT / TALK IN CONTEXT</p>
            <h2 id="work-contact-title">課題の輪郭から、話しましょう。</h2>
          </div>
          <a className={styles.contactLink} href="/#contact">
            <span>Start a conversation</span>
            <span aria-hidden="true">↗</span>
          </a>
        </section>
      </div>
    </main>
  );
}

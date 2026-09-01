/* eslint-disable @next/next/no-html-link-for-pages -- plain anchors keep Vinext static detail routes resilient. */
import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { CSSProperties } from 'react';

import { getPublishedSelfBuiltTool, getPublishedSelfBuiltTools } from '../../components/site/self-development-data';
import { getPublicOrigin } from '../../seo-config';
import styles from './self-built-tool-detail.module.css';

type LabDetailPageProps = {
  params: Promise<{ slug: string }>;
};

const ACCENTS = {
  mint: '#a6ffdb',
  cyan: '#79dcff',
  amber: '#ffc779',
  violet: '#c5a8ff',
} as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return getPublishedSelfBuiltTools().flatMap((tool) => tool.slug ? [{ slug: tool.slug }] : []);
}

export async function generateMetadata({ params }: LabDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const tool = getPublishedSelfBuiltTool(slug);
  if (!tool) return { title: 'Tool not found | Crelo', robots: { index: false, follow: false } };
  const publicOrigin = getPublicOrigin()?.origin ?? null;
  const canonical = publicOrigin ? `${publicOrigin}/lab/${slug}` : undefined;
  const socialImage = publicOrigin && tool.thumbnailSrc && tool.thumbnailAlt
    ? { url: `${publicOrigin}${tool.thumbnailSrc}`, alt: tool.thumbnailAlt }
    : null;
  return {
    title: `${tool.title} | Crelo Personal Lab`,
    description: tool.summary,
    robots: publicOrigin ? { index: true, follow: true } : { index: false, follow: false },
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      title: `${tool.title} | Crelo Personal Lab`,
      description: tool.summary,
      ...(socialImage ? { images: [socialImage] } : {}),
    },
    twitter: {
      card: socialImage ? 'summary_large_image' : 'summary',
      title: `${tool.title} | Crelo Personal Lab`,
      description: tool.summary,
      ...(socialImage ? { images: [socialImage.url] } : {}),
    },
  };
}

export default async function LabDetailPage({ params }: LabDetailPageProps) {
  const { slug } = await params;
  const tool = getPublishedSelfBuiltTool(slug);
  if (!tool || !tool.detail) notFound();
  const accent = ACCENTS[tool.accent];

  return (
    <main className={styles.page} style={{ '--lab-detail-accent': accent } as CSSProperties & Record<'--lab-detail-accent', string>}>
      <div className={styles.grid} aria-hidden="true" />
      <header className={styles.header}>
        <a className={styles.brand} href="/" aria-label="Crelo home"><Image src="/assets/crelo-logo.png" alt="Crelo" width={32} height={32} priority /><span>Crelo / Personal Lab</span></a>
        <a href="/#lab">Back to Lab ↗</a>
      </header>
      <div className={styles.content}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb"><a href="/">Crelo</a><span>/</span><a href="/#lab">自己開発</a><span>/</span><span aria-current="page">{tool.title}</span></nav>
        <section className={styles.hero} aria-labelledby="tool-detail-title">
          <div>
            <p className={styles.eyebrow}>TOOL {String(tool.order).padStart(2, '0')} / PERSONAL LAB</p>
            <h1 id="tool-detail-title">{tool.title}</h1>
            <p className={styles.lead}>{tool.summary}</p>
          </div>
          <div className={styles.visual}>
            {tool.thumbnailSrc && tool.thumbnailAlt ? <Image src={tool.thumbnailSrc} alt={tool.thumbnailAlt} fill sizes="(max-width: 720px) 100vw, 46vw" /> : null}
          </div>
        </section>
        <section className={styles.details} aria-label="Tool details">
          {[['概要', tool.detail.overview], ['課題', tool.detail.problem], ['アプローチ', tool.detail.approach]].map(([label, value]) => <article key={label}><span>{label}</span><p>{value}</p></article>)}
          <article><span>主な機能</span><ul>{tool.detail.features.map((feature) => <li key={feature}>{feature}</li>)}</ul></article>
          <article><span>使用技術</span><ul>{tool.detail.technologies.map((technology) => <li key={technology}>{technology}</li>)}</ul></article>
        </section>
        <a className={styles.back} href="/#lab">← 自己開発一覧へ戻る</a>
      </div>
    </main>
  );
}

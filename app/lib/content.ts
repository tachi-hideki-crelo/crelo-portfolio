import type { CaseStudy, SiteContent } from './types.ts';
import { CASE_STUDY_SLUGS } from './types.ts';

export const HERO_COPY = {
  title: 'Forward Deployed Engineer',
  discipline: 'Business × AI × Software',
  lead: '課題整理から設計・開発・導入まで。',
  statement: '事業の課題を、技術で解決します。',
} as const;

const CASE_APPROVAL_DATE = '2026-09-04';

function privateCaseStudy(slug: (typeof CASE_STUDY_SLUGS)[number], index: number): CaseStudy {
  return {
    slug,
    displayOrder: index + 1,
    title: null,
    industry: null,
    periodLabel: null,
    challenge: null,
    constraints: [],
    role: null,
    discovery: null,
    design: null,
    implementation: null,
    rollout: null,
    qualitativeOutcome: null,
    technologies: [],
    tags: [],
    theme: ['mint', 'cyan', 'violet', 'amber', 'rose'][index],
    approved: false,
    approvedAt: null,
    media: [],
  };
}

/**
 * Only the explicitly approved first case is populated. The remaining slots
 * stay empty so no industry, outcome, or media is invented for them.
 */
export const caseStudies: readonly CaseStudy[] = [
  {
    ...privateCaseStudy('field-signal', 0),
    title: '宣伝動画の制作',
    role: 'AIを用いた動画の作成',
    approved: true,
    approvedAt: CASE_APPROVAL_DATE,
    media: [
      {
        src: '/assets/cases/ai-promo-preview.mp4',
        alt: '宣伝動画の制作の一覧用プレビュー',
        kind: 'video',
        role: 'preview',
        approved: true,
        approvedAt: CASE_APPROVAL_DATE,
        poster: '/assets/cases/ai-promo-poster.jpg',
        hasAudio: false,
        captionsSrc: null,
      },
      {
        src: '/assets/cases/ai-promo-feature.mp4',
        alt: '宣伝動画の制作の本編',
        kind: 'video',
        role: 'full',
        approved: true,
        approvedAt: CASE_APPROVAL_DATE,
        poster: '/assets/cases/ai-promo-poster.jpg',
        hasAudio: false,
        captionsSrc: null,
      },
    ],
  },
  ...CASE_STUDY_SLUGS.slice(1).map((slug, index) => privateCaseStudy(slug, index + 1)),
];

export const siteContent: SiteContent = {
  profile: {
    name: '舘 秀樹',
    portraitSrc: '/assets/profile/hideki-tachi.webp',
    portraitAlt: '舘 秀樹のプロフィール写真',
    career: 'ただ創造するだけでなく、「なぜそうするのか」\n論理、根拠、設計思想をもって形にします。',
    approved: true,
    approvedAt: '2026-09-03',
  },
  privacy: {
    operator: null,
    version: null,
    effectiveDate: null,
    collectedItems: [],
    purposes: [],
    retentionPeriod: null,
    processors: null,
    overseasTransfer: null,
    rightsContact: null,
  },
  contactEmail: null,
};

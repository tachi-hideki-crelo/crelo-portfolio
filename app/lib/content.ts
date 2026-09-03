import type { CaseStudy, SiteContent } from './types.ts';
import { CASE_STUDY_SLUGS } from './types.ts';

export const HERO_COPY = {
  title: 'Forward Deployed Engineer',
  discipline: 'Business × AI × Software',
  lead: '課題整理から設計・開発・導入まで。',
  statement: '事業の課題を、技術で解決します。',
} as const;

/**
 * Preview records are deliberately empty. Production content must be supplied
 * from approved public material; a placeholder string is never rendered as a
 * case-study fact.
 */
export const caseStudies: readonly CaseStudy[] = CASE_STUDY_SLUGS.map(
  (slug, index) => ({
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
  }),
);

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

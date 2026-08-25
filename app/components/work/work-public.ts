import type { CaseStudy, CaseStudySlug } from '../../lib/types';

/**
 * The only case-study shape allowed across the server/client boundary.
 * Preview records retain their stable routing and visual identity, while all
 * potentially sensitive publication fields are empty until the server has
 * both an approved record and a public production build.
 */
export type PublicCaseStudy = {
  slug: CaseStudySlug;
  displayOrder: number;
  title: string | null;
  industry: string | null;
  challenge: string | null;
  role: string | null;
  qualitativeOutcome: string | null;
  theme: string;
  approved: boolean;
};

function redactedCaseStudy(caseStudy: CaseStudy): PublicCaseStudy {
  return {
    slug: caseStudy.slug,
    displayOrder: caseStudy.displayOrder,
    title: null,
    industry: null,
    challenge: null,
    role: null,
    qualitativeOutcome: null,
    theme: caseStudy.theme,
    approved: false,
  };
}

function approvedCaseStudy(caseStudy: CaseStudy): PublicCaseStudy {
  return {
    slug: caseStudy.slug,
    displayOrder: caseStudy.displayOrder,
    title: caseStudy.title,
    industry: caseStudy.industry,
    challenge: caseStudy.challenge,
    role: caseStudy.role,
    qualitativeOutcome: caseStudy.qualitativeOutcome,
    theme: caseStudy.theme,
    approved: true,
  };
}

/**
 * Project content on the server before it reaches HomeExperience. This is
 * intentionally environment-aware: an approved record is public only in a
 * production build with the public-origin gate already satisfied.
 */
export function projectPublicCaseStudies(
  records: readonly CaseStudy[],
  publicBuild: boolean,
): readonly PublicCaseStudy[] {
  return records.map((caseStudy) => (
    publicBuild && caseStudy.approved
      ? approvedCaseStudy(caseStudy)
      : redactedCaseStudy(caseStudy)
  ));
}

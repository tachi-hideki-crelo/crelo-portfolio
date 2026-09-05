import type {
  CaseStudy,
  CaseStudyDetail,
  CaseStudyImageMedia,
  CaseStudyMedia,
  CaseStudySlug,
  CaseStudyVideoMedia,
} from '../../lib/types';

/**
 * The only case-study shape allowed across the server/client boundary.
 * Preview records retain their stable routing and visual identity, while all
 * potentially sensitive publication fields are empty until the server has an
 * explicitly approved record. Approved content may be shown in the owner-only
 * noindex preview, so this projection never relies on the build mode for
 * redaction.
 */
export type PublicCaseStudyImageMedia = Pick<
  CaseStudyImageMedia,
  'src' | 'alt' | 'kind' | 'width' | 'height'
>;

export type PublicCaseStudyVideoMedia = Pick<
  CaseStudyVideoMedia,
  'src' | 'alt' | 'kind' | 'role' | 'poster' | 'hasAudio' | 'captionsSrc'
>;

export type PublicCaseStudyMedia = PublicCaseStudyImageMedia | PublicCaseStudyVideoMedia;

export type PublicCaseStudyDetail = Pick<
  CaseStudyDetail,
  'projectName' | 'overview' | 'outcomesLabel' | 'outcomes'
>;

export type PublicCaseStudy = {
  slug: CaseStudySlug;
  displayOrder: number;
  title: string | null;
  industry: string | null;
  challenge: string | null;
  role: string | null;
  qualitativeOutcome: string | null;
  detail: PublicCaseStudyDetail | null;
  theme: string;
  approved: boolean;
  media: readonly PublicCaseStudyMedia[];
};

function projectApprovedMedia(media: readonly CaseStudyMedia[]): readonly PublicCaseStudyMedia[] {
  return media.flatMap((item): PublicCaseStudyMedia[] => {
    if (!item.approved) return [];
    if (item.kind === 'video') {
      return [{
        src: item.src,
        alt: item.alt,
        kind: item.kind,
        role: item.role,
        poster: item.poster,
        hasAudio: item.hasAudio,
        captionsSrc: item.captionsSrc,
      }];
    }
    return [{
      src: item.src,
      alt: item.alt,
      kind: item.kind,
      width: item.width,
      height: item.height,
    }];
  });
}

function redactedCaseStudy(caseStudy: CaseStudy): PublicCaseStudy {
  return {
    slug: caseStudy.slug,
    displayOrder: caseStudy.displayOrder,
    title: null,
    industry: null,
    challenge: null,
    role: null,
    qualitativeOutcome: null,
    detail: null,
    theme: caseStudy.theme,
    approved: false,
    media: [],
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
    detail: caseStudy.detail
      ? {
          projectName: caseStudy.detail.projectName,
          overview: caseStudy.detail.overview,
          outcomesLabel: caseStudy.detail.outcomesLabel,
          outcomes: caseStudy.detail.outcomes.map(({ title, description }) => ({ title, description })),
        }
      : null,
    theme: caseStudy.theme,
    approved: true,
    media: projectApprovedMedia(caseStudy.media),
  };
}

/**
 * Project content on the server before it reaches HomeExperience. Explicitly
 * approved records are safe for the owner-only noindex preview as well as the
 * production build; unapproved records never expose their private fields.
 */
export function projectPublicCaseStudies(
  records: readonly CaseStudy[],
  _publicBuild: boolean,
): readonly PublicCaseStudy[] {
  // Keep the page-level build-mode argument for API stability. Approval is the
  // publication boundary because this projection is also used by noindex owner
  // previews.
  void _publicBuild;
  return records.map((caseStudy) => (
    caseStudy.approved
      ? approvedCaseStudy(caseStudy)
      : redactedCaseStudy(caseStudy)
  ));
}

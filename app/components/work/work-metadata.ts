import type { CaseStudy, CaseStudyMedia } from '../../lib/types';
import { parsePublicOrigin } from '../../seo-config.ts';

export type WorkMetadataEnvironment = {
  contentMode?: string;
  siteOrigin?: string;
};

export function isPublicCaseStudy(
  caseStudy: CaseStudy,
  environment: WorkMetadataEnvironment = {
    contentMode: process.env.CONTENT_MODE,
    siteOrigin: process.env.SITE_ORIGIN,
  },
): boolean {
  return environment.contentMode === 'production'
    && caseStudy.approved
    && parsePublicOrigin(environment.siteOrigin) !== null;
}

/**
 * Media is a publication unit, not merely an asset attached to a draft.
 * Keep this gate shared by the detail gallery and metadata so an unapproved
 * draft can never leak a source URL or alt text into the rendered page.
 */
export function getApprovedMedia(caseStudy: CaseStudy): CaseStudyMedia[] {
  if (!caseStudy.approved) return [];

  return caseStudy.media.filter((media) => (
    media.approved
    && media.src.trim().length > 0
    && media.alt.trim().length > 0
  ));
}

export function getApprovedOgMedia(caseStudy: CaseStudy): CaseStudyMedia | undefined {
  return getApprovedMedia(caseStudy).find((media) => media.kind === 'image');
}

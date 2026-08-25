import type { ProfileContent } from '../../lib/types.ts';

const EMPTY_PROFILE: ProfileContent = {
  name: null,
  portraitSrc: null,
  portraitAlt: null,
  career: null,
  approved: false,
  approvedAt: null,
};

/**
 * Keep unpublished identity drafts out of the RSC payload as well as the UI.
 * A preview build must never serialize a future profile merely because the
 * component would hide it after hydration.
 */
export function projectProfileForClient(profile: ProfileContent, publicBuild: boolean): ProfileContent {
  if (!publicBuild || !profile.approved) return { ...EMPTY_PROFILE };
  return {
    name: profile.name,
    portraitSrc: profile.portraitSrc,
    portraitAlt: profile.portraitAlt,
    career: profile.career,
    approved: true,
    approvedAt: profile.approvedAt,
  };
}

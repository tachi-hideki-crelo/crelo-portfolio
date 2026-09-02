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
 * Explicitly approved identity content may be reviewed in an owner-only
 * preview before the rest of the site is ready for public indexing.
 */
export function projectProfileForClient(profile: ProfileContent): ProfileContent {
  if (!profile.approved) return { ...EMPTY_PROFILE };
  return {
    name: profile.name,
    portraitSrc: profile.portraitSrc,
    portraitAlt: profile.portraitAlt,
    career: profile.career,
    approved: true,
    approvedAt: profile.approvedAt,
  };
}

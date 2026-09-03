import { caseStudies, siteContent } from './content.ts';
import { hasSufficientContactHashSecret } from './contact-crypto.ts';
import { isAllowedContentAssetExtension, type ContentAssetKind } from './content-assets.ts';
import type { CaseStudy, SiteContent } from './types.ts';

const REQUIRED_CASE_FIELDS = [
  'title',
  'industry',
  'periodLabel',
  'challenge',
  'role',
  'discovery',
  'design',
  'implementation',
  'rollout',
  'qualitativeOutcome',
] as const satisfies readonly (keyof CaseStudy)[];

const PLACEHOLDER_PATTERN =
  /(TBD|TODO|FIXME|EXAMPLE\.COM|TITLE TBD|PROFILE NAME|仮|未提供|公開承認待ち|差し替え|架空)/i;
const PLACEHOLDER_EMAIL_PATTERN = /(example\.(com|test|org)|hello@|test@|noreply@)/i;
const LOCAL_CASE_ASSET_PATTERN = /^\/assets\/cases\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const LOCAL_PROFILE_ASSET_PATTERN = /^\/assets\/profile\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;
// Outcomes are intentionally qualitative in the public portfolio.  Reject
// both ASCII/full-width digits and common currency/ratio markers here so an
// unreviewed KPI cannot slip into production as prose. `periodLabel` is not
// checked by this pattern because dates and year labels are expected there.
const QUANTITATIVE_OUTCOME_PATTERN = /[0-9０-９]|[%％]|(?:円|万円|億円|ドル|USD|倍)/u;

export type ProductionGateEnvironment = {
  SITE_ORIGIN?: string;
  CONTACT_TO_EMAIL?: string;
  CONTACT_FROM_EMAIL?: string;
  RESEND_API_KEY?: string;
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  CONTACT_HASH_SECRET?: string;
};

export type ProductionGateResult = {
  ok: boolean;
  errors: string[];
};

export type ProductionGateOptions = {
  /** Require HTTPS for non-local production origins. Defaults to true. */
  requireHttps?: boolean;
};

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidEmail(value: string | null | undefined): value is string {
  return isNonEmpty(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isSafeLocalAssetPath(
  value: string | null | undefined,
  pattern: RegExp,
): value is string {
  return Boolean(
    isNonEmpty(value) &&
      pattern.test(value) &&
      !value.includes('..') &&
      !value.includes('\\') &&
      !value.includes('//'),
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validateAssetExtension(
  value: string,
  kind: ContentAssetKind,
  label: string,
): string | undefined {
  return isAllowedContentAssetExtension(value, kind)
    ? undefined
    : `${label} must use an allowed ${kind} asset extension`;
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '[::1]';
}

function validateSiteOrigin(value: string | undefined, requireHttps: boolean): string | undefined {
  if (!isNonEmpty(value)) return 'SITE_ORIGIN is missing';
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'SITE_ORIGIN must be a valid http(s) URL';
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'SITE_ORIGIN must use http or https';
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    return 'SITE_ORIGIN must contain a hostname and no credentials';
  }
  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    return 'SITE_ORIGIN must be an origin without a path, query, or fragment';
  }
  if (requireHttps && parsed.protocol !== 'https:' && !isLocalHostname(parsed.hostname)) {
    return 'SITE_ORIGIN must use https in production (localhost is allowed for local verification)';
  }
  return undefined;
}

function inspectCaseStudy(caseStudy: CaseStudy, index: number): string[] {
  const errors: string[] = [];
  const prefix = `caseStudies[${index}](${caseStudy.slug})`;

  if (!caseStudy.approved) errors.push(`${prefix}.approved must be true`);
  if (!isNonEmpty(caseStudy.approvedAt)) {
    errors.push(`${prefix}.approvedAt is missing`);
  } else if (PLACEHOLDER_PATTERN.test(caseStudy.approvedAt)) {
    errors.push(`${prefix}.approvedAt contains placeholder content`);
  } else if (!isValidIsoDate(caseStudy.approvedAt)) {
    errors.push(`${prefix}.approvedAt must be a valid YYYY-MM-DD date`);
  }
  if (caseStudy.displayOrder !== index + 1) {
    errors.push(`${prefix}.displayOrder must be ${index + 1}`);
  }

  for (const field of REQUIRED_CASE_FIELDS) {
    const value = caseStudy[field];
    if (!isNonEmpty(value as string | null)) {
      errors.push(`${prefix}.${field} is missing`);
    } else if (PLACEHOLDER_PATTERN.test(value as string)) {
      errors.push(`${prefix}.${field} contains placeholder content`);
    }
    if (
      field === 'qualitativeOutcome' &&
      isNonEmpty(value as string | null) &&
      QUANTITATIVE_OUTCOME_PATTERN.test(value as string)
    ) {
      errors.push(`${prefix}.qualitativeOutcome contains quantitative KPI content`);
    }
  }

  if (caseStudy.constraints.length === 0) errors.push(`${prefix}.constraints is empty`);
  if (caseStudy.technologies.length === 0) errors.push(`${prefix}.technologies is empty`);
  if (caseStudy.tags.length === 0) errors.push(`${prefix}.tags is empty`);
  if (!isNonEmpty(caseStudy.theme) || PLACEHOLDER_PATTERN.test(caseStudy.theme)) {
    errors.push(`${prefix}.theme is invalid`);
  }

  if (!Array.isArray(caseStudy.media)) {
    errors.push(`${prefix}.media must be an array`);
    return errors;
  }

  for (const [mediaIndex, media] of caseStudy.media.entries()) {
    const mediaPrefix = `${prefix}.media[${mediaIndex}]`;
    if (!media || typeof media !== 'object') {
      errors.push(`${mediaPrefix} must be an object`);
      continue;
    }
    if (!media.approved) errors.push(`${mediaPrefix}.approved must be true`);
    if (!isValidIsoDate(media.approvedAt)) errors.push(`${mediaPrefix}.approvedAt is missing or invalid`);
    if (!isNonEmpty(media.src)) errors.push(`${mediaPrefix}.src is missing`);
    else if (!isSafeLocalAssetPath(media.src, LOCAL_CASE_ASSET_PATTERN)) {
      errors.push(`${mediaPrefix}.src must be a local /assets/cases/ path`);
    }
    if (!isNonEmpty(media.alt)) errors.push(`${mediaPrefix}.alt is missing`);
    if (isNonEmpty(media.alt) && PLACEHOLDER_PATTERN.test(media.alt)) {
      errors.push(`${mediaPrefix}.alt contains placeholder content`);
    }
    if (media.kind === 'image') {
      if (isNonEmpty(media.src)) {
        const extensionError = validateAssetExtension(media.src, 'image', `${mediaPrefix}.src`);
        if (extensionError) errors.push(extensionError);
      }
      if (!isPositiveInteger(media.width)) errors.push(`${mediaPrefix}.width must be a positive integer`);
      if (!isPositiveInteger(media.height)) errors.push(`${mediaPrefix}.height must be a positive integer`);
    } else if (media.kind === 'video') {
      if (media.role !== 'preview' && media.role !== 'full') {
        errors.push(`${mediaPrefix}.role must be preview or full`);
      }
      if (isNonEmpty(media.src)) {
        const extensionError = validateAssetExtension(media.src, 'video', `${mediaPrefix}.src`);
        if (extensionError) errors.push(extensionError);
      }
      if (!isSafeLocalAssetPath(media.poster, LOCAL_CASE_ASSET_PATTERN)) {
        errors.push(`${mediaPrefix}.poster must be a local /assets/cases/ path`);
      } else {
        const extensionError = validateAssetExtension(media.poster, 'image', `${mediaPrefix}.poster`);
        if (extensionError) errors.push(extensionError);
      }
      if (typeof media.hasAudio !== 'boolean') {
        errors.push(`${mediaPrefix}.hasAudio must be boolean`);
      } else if (media.hasAudio && !isNonEmpty(media.captionsSrc)) {
        errors.push(`${mediaPrefix}.captionsSrc is required when video has audio`);
      }
      if (isNonEmpty(media.captionsSrc) && !isSafeLocalAssetPath(media.captionsSrc, LOCAL_CASE_ASSET_PATTERN)) {
        errors.push(`${mediaPrefix}.captionsSrc must be a local /assets/cases/ path`);
      } else if (isNonEmpty(media.captionsSrc)) {
        const extensionError = validateAssetExtension(media.captionsSrc, 'captions', `${mediaPrefix}.captionsSrc`);
        if (extensionError) errors.push(extensionError);
      }
    } else {
      errors.push(`${mediaPrefix}.kind must be image or video`);
    }
  }

  return errors;
}

function inspectPrivacy(content: SiteContent): string[] {
  const errors: string[] = [];
  const privacy = content.privacy;
  if (!privacy) return ['privacy is missing'];

  const requiredTextFields = [
    'operator',
    'version',
    'retentionPeriod',
    'processors',
    'overseasTransfer',
  ] as const;
  for (const field of requiredTextFields) {
    const value = privacy[field];
    if (!isNonEmpty(value)) {
      errors.push(`privacy.${field} is missing`);
    } else if (PLACEHOLDER_PATTERN.test(value)) {
      errors.push(`privacy.${field} contains placeholder content`);
    }
  }

  if (!isNonEmpty(privacy.effectiveDate)) {
    errors.push('privacy.effectiveDate is missing');
  } else if (PLACEHOLDER_PATTERN.test(privacy.effectiveDate)) {
    errors.push('privacy.effectiveDate contains placeholder content');
  } else if (!isValidIsoDate(privacy.effectiveDate)) {
    errors.push('privacy.effectiveDate must be a valid YYYY-MM-DD date');
  }
  for (const field of ['collectedItems', 'purposes'] as const) {
    const values = privacy[field];
    if (!Array.isArray(values) || values.length === 0) {
      errors.push(`privacy.${field} must contain at least one approved item`);
      continue;
    }
    values.forEach((value, index) => {
      if (!isNonEmpty(value)) errors.push(`privacy.${field}[${index}] is missing`);
      else if (PLACEHOLDER_PATTERN.test(value)) {
        errors.push(`privacy.${field}[${index}] contains placeholder content`);
      }
    });
  }

  if (!isNonEmpty(privacy.rightsContact)) {
    errors.push('privacy.rightsContact is missing');
  } else if (PLACEHOLDER_PATTERN.test(privacy.rightsContact)) {
    errors.push('privacy.rightsContact contains placeholder content');
  } else if (PLACEHOLDER_EMAIL_PATTERN.test(privacy.rightsContact)) {
    errors.push('privacy.rightsContact contains a placeholder address');
  } else if (!isValidEmail(privacy.rightsContact)) {
    errors.push('privacy.rightsContact must be a valid contact email');
  }

  return errors;
}

export function validateProductionContent(
  records: readonly CaseStudy[] = caseStudies,
  content: SiteContent = siteContent,
  environment: ProductionGateEnvironment = process.env as ProductionGateEnvironment,
  options: ProductionGateOptions = {},
): ProductionGateResult {
  const errors: string[] = [];
  if (records.length !== 5) errors.push(`exactly 5 case studies are required (received ${records.length})`);

  const slugs = records.map((record) => record.slug);
  if (new Set(slugs).size !== slugs.length) errors.push('case study slugs must be unique');

  for (const [index, caseStudy] of records.entries()) {
    errors.push(...inspectCaseStudy(caseStudy, index));
  }

  if (!isNonEmpty(content.profile.name)) errors.push('profile.name is missing');
  if (!isNonEmpty(content.profile.career)) errors.push('profile.career is missing');
  if (!isNonEmpty(content.profile.portraitSrc)) errors.push('profile.portraitSrc is missing');
  else if (!isSafeLocalAssetPath(content.profile.portraitSrc, LOCAL_PROFILE_ASSET_PATTERN)) {
    errors.push('profile.portraitSrc must be a local /assets/profile/ path');
  } else {
    const extensionError = validateAssetExtension(content.profile.portraitSrc, 'image', 'profile.portraitSrc');
    if (extensionError) errors.push(extensionError);
  }
  if (!isNonEmpty(content.profile.portraitAlt)) errors.push('profile.portraitAlt is missing');
  if (isNonEmpty(content.profile.portraitAlt) && PLACEHOLDER_PATTERN.test(content.profile.portraitAlt)) {
    errors.push('profile.portraitAlt contains placeholder content');
  }
  for (const field of ['name', 'career'] as const) {
    const value = content.profile[field];
    if (isNonEmpty(value) && PLACEHOLDER_PATTERN.test(value)) {
      errors.push(`profile.${field} contains placeholder content`);
    }
  }
  if (!content.profile.approved) errors.push('profile.approved must be true');
  if (!isNonEmpty(content.profile.approvedAt)) {
    errors.push('profile.approvedAt is missing');
  } else if (PLACEHOLDER_PATTERN.test(content.profile.approvedAt)) {
    errors.push('profile.approvedAt contains placeholder content');
  } else if (!isValidIsoDate(content.profile.approvedAt)) {
    errors.push('profile.approvedAt must be a valid YYYY-MM-DD date');
  }
  errors.push(...inspectPrivacy(content));
  if (!isValidEmail(content.contactEmail)) errors.push('contactEmail is missing or invalid');
  if (isValidEmail(content.contactEmail) && PLACEHOLDER_EMAIL_PATTERN.test(content.contactEmail)) {
    errors.push('contactEmail contains a placeholder address');
  }

  const requiredEnvironment: (keyof ProductionGateEnvironment)[] = [
    'SITE_ORIGIN',
    'CONTACT_TO_EMAIL',
    'CONTACT_FROM_EMAIL',
    'RESEND_API_KEY',
    'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
    'TURNSTILE_SECRET_KEY',
    'CONTACT_HASH_SECRET',
  ];
  for (const key of requiredEnvironment) {
    if (!isNonEmpty(environment[key])) errors.push(`${key} is missing`);
  }
  if (
    isNonEmpty(environment.CONTACT_HASH_SECRET) &&
    !hasSufficientContactHashSecret(environment.CONTACT_HASH_SECRET)
  ) {
    errors.push('CONTACT_HASH_SECRET must be at least 32 characters');
  }
  const siteOriginError = validateSiteOrigin(environment.SITE_ORIGIN, options.requireHttps ?? true);
  if (siteOriginError && !errors.includes(siteOriginError)) errors.push(siteOriginError);
  if (!isValidEmail(environment.CONTACT_TO_EMAIL)) errors.push('CONTACT_TO_EMAIL is invalid');
  if (!isValidEmail(environment.CONTACT_FROM_EMAIL)) errors.push('CONTACT_FROM_EMAIL is invalid');
  if (isValidEmail(environment.CONTACT_TO_EMAIL) && PLACEHOLDER_EMAIL_PATTERN.test(environment.CONTACT_TO_EMAIL)) {
    errors.push('CONTACT_TO_EMAIL contains a placeholder address');
  }
  if (isValidEmail(environment.CONTACT_FROM_EMAIL) && PLACEHOLDER_EMAIL_PATTERN.test(environment.CONTACT_FROM_EMAIL)) {
    errors.push('CONTACT_FROM_EMAIL contains a placeholder address');
  }

  return { ok: errors.length === 0, errors };
}

export function assertProductionContent(
  records: readonly CaseStudy[] = caseStudies,
  content: SiteContent = siteContent,
  environment: ProductionGateEnvironment = process.env as ProductionGateEnvironment,
  options: ProductionGateOptions = {},
): void {
  const result = validateProductionContent(records, content, environment, options);
  if (!result.ok) {
    throw new Error(`PRODUCTION_CONTENT_GATE_FAILED\n${result.errors.map((error) => `- ${error}`).join('\n')}`);
  }
}

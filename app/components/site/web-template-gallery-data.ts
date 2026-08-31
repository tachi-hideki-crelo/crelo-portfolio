export const WEB_TEMPLATE_ACCENTS = ['mint', 'cyan', 'amber', 'violet', 'rose'] as const;

export type WebTemplateAccent = (typeof WEB_TEMPLATE_ACCENTS)[number];

export type WebTemplate = {
  id: string;
  order: number;
  title: string;
  accent: WebTemplateAccent;
  url: string | null;
  thumbnailSrc: string | null;
  thumbnailAlt: string | null;
};

export type WebTemplateGalleryConfig = {
  galleryUrl: string | null;
  templates: readonly WebTemplate[];
};

/**
 * Keep every external destination in this data object. The rendering layer
 * only receives the result of the pure HTTPS validation helpers below, so a
 * future URL change cannot accidentally create an unsafe external link.
 */
export const webTemplateGallery: WebTemplateGalleryConfig = {
  galleryUrl: null,
  templates: [
    { id: '01', order: 1, title: 'Template 01', accent: 'mint', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '02', order: 2, title: 'Template 02', accent: 'cyan', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '03', order: 3, title: 'Template 03', accent: 'amber', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '04', order: 4, title: 'Template 04', accent: 'violet', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '05', order: 5, title: 'Template 05', accent: 'rose', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '06', order: 6, title: 'Template 06', accent: 'mint', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '07', order: 7, title: 'Template 07', accent: 'cyan', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '08', order: 8, title: 'Template 08', accent: 'amber', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '09', order: 9, title: 'Template 09', accent: 'violet', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '10', order: 10, title: 'Template 10', accent: 'rose', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '11', order: 11, title: 'Template 11', accent: 'mint', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '12', order: 12, title: 'Template 12', accent: 'cyan', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '13', order: 13, title: 'Template 13', accent: 'amber', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '14', order: 14, title: 'Template 14', accent: 'violet', url: null, thumbnailSrc: null, thumbnailAlt: null },
    { id: '15', order: 15, title: 'Template 15', accent: 'rose', url: null, thumbnailSrc: null, thumbnailAlt: null },
  ],
};

/** Return true only for an absolute HTTPS URL without user credentials. */
export function isValidHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.length > 0 && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

/** Return a safe normalized href, or null for unset/invalid destinations. */
export function getSafeHttpsUrl(value: unknown): string | null {
  return isValidHttpsUrl(value) ? new URL(value).toString() : null;
}

export function getSafeGalleryUrl(config: WebTemplateGalleryConfig): string | null {
  return getSafeHttpsUrl(config.galleryUrl);
}

export function getSafeTemplateUrl(template: WebTemplate): string | null {
  return getSafeHttpsUrl(template.url);
}

export function getSafeTemplateThumbnail(template: WebTemplate): string | null {
  return isValidLocalThumbnailPath(template.thumbnailSrc) && typeof template.thumbnailAlt === 'string' && template.thumbnailAlt.trim() !== ''
    ? template.thumbnailSrc
    : null;
}

/** Local public assets are intentionally stricter than external hrefs. */
export function isValidLocalThumbnailPath(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\/assets\/templates\/[A-Za-z0-9][A-Za-z0-9._/-]*\.(?:avif|webp|png|jpe?g|gif|svg)$/.test(value)) return false;
  const relativePath = value.slice('/assets/templates/'.length);
  return !relativePath.includes('//') && !relativePath.split('/').some((segment) => segment === '.' || segment === '..');
}

export type WebTemplateGalleryValidation = { ok: true; errors: [] } | { ok: false; errors: string[] };

export function validateWebTemplateGalleryConfig(config: WebTemplateGalleryConfig): WebTemplateGalleryValidation {
  const errors: string[] = [];
  const galleryUrl = config?.galleryUrl;
  const templates = Array.isArray(config?.templates) ? config.templates : [];
  if (galleryUrl !== null && !isValidHttpsUrl(galleryUrl)) {
    errors.push('galleryUrl must be an HTTPS URL without credentials or null.');
  }
  if (!Array.isArray(config?.templates) || templates.length !== 15) {
    errors.push('templates must contain exactly 15 entries.');
  }

  const orders = new Set<number>();
  const ids = new Set<string>();
  templates.forEach((template, index) => {
    const label = `templates[${index}]`;
    if (!template || typeof template !== 'object') {
      errors.push(`${label} must be an object.`);
      return;
    }
    if (!Number.isInteger(template.order) || template.order < 1 || template.order > 15 || orders.has(template.order)) {
      errors.push(`${label}.order must be a unique integer from 1 to 15.`);
    }
    orders.add(template.order);
    if (typeof template.id !== 'string' || template.id.trim() === '' || ids.has(template.id)) errors.push(`${label}.id must be unique and non-empty.`);
    ids.add(template.id);
    if (typeof template.title !== 'string' || template.title.trim() === '') errors.push(`${label}.title must be non-empty.`);
    if (!WEB_TEMPLATE_ACCENTS.includes(template.accent)) errors.push(`${label}.accent is invalid.`);
    if (!isValidHttpsUrl(template.url) && template.url !== null) errors.push(`${label}.url must be an HTTPS URL without credentials or null.`);
    const hasSrc = template.thumbnailSrc !== null;
    const hasAlt = template.thumbnailAlt !== null;
    if (hasSrc !== hasAlt) errors.push(`${label}.thumbnailSrc and thumbnailAlt must be set together.`);
    if (hasSrc && !isValidLocalThumbnailPath(template.thumbnailSrc)) errors.push(`${label}.thumbnailSrc must be a local /assets/templates path.`);
    if (hasAlt && (typeof template.thumbnailAlt !== 'string' || template.thumbnailAlt.trim() === '')) errors.push(`${label}.thumbnailAlt must be non-empty.`);
  });

  return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
}

export function getPendingTemplateMessage(template: WebTemplate): string {
  return `${template.title} のURLは準備中です。`;
}

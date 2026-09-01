import type { SelfBuiltTool, SelfBuiltToolAccent } from '../../lib/types';

export type SelfBuiltToolValidationResult = {
  ok: boolean;
  errors: string[];
};

const PLACEHOLDER_SUMMARY = 'ツールの目的、解決したい課題、主な機能をここに掲載します。';
const ACCENTS: readonly SelfBuiltToolAccent[] = ['mint', 'cyan', 'amber', 'violet'];
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_THUMBNAIL = /^\/assets\/lab\/[a-zA-Z0-9][a-zA-Z0-9._/-]*\.(?:avif|gif|jpe?g|png|webp)$/i;

export const selfBuiltTools: readonly SelfBuiltTool[] = ACCENTS.map((accent, index) => ({
  id: `tool-slot-${index + 1}`,
  order: index + 1,
  title: '名称準備中',
  category: 'PERSONAL LAB / SLOT',
  summary: PLACEHOLDER_SUMMARY,
  tags: [],
  accent,
  status: 'placeholder',
  slug: null,
  thumbnailSrc: null,
  thumbnailAlt: null,
  detail: null,
}));

export function isValidSelfBuiltToolSlug(value: string): boolean {
  return SAFE_SLUG.test(value);
}

export function isValidLabThumbnailPath(value: string): boolean {
  return SAFE_THUMBNAIL.test(value) && !value.includes('..') && !value.includes('//');
}

export function validateSelfBuiltTools(tools: readonly SelfBuiltTool[]): SelfBuiltToolValidationResult {
  const errors: string[] = [];
  const ids = new Set<string>();
  const orders = new Set<number>();
  const slugs = new Set<string>();

  tools.forEach((tool, index) => {
    const label = `selfBuiltTools[${index}]`;
    if (!tool.id.trim() || ids.has(tool.id)) errors.push(`${label}.id must be non-empty and unique`);
    ids.add(tool.id);
    if (!Number.isInteger(tool.order) || tool.order < 1 || orders.has(tool.order)) errors.push(`${label}.order must be a unique positive integer`);
    orders.add(tool.order);

    if ((tool.thumbnailSrc === null) !== (tool.thumbnailAlt === null)) {
      errors.push(`${label}.thumbnailSrc and thumbnailAlt must be set together`);
    }
    if (tool.thumbnailSrc && !isValidLabThumbnailPath(tool.thumbnailSrc)) {
      errors.push(`${label}.thumbnailSrc must use a safe local /assets/lab image path`);
    }
    if (tool.thumbnailAlt !== null && !tool.thumbnailAlt.trim()) errors.push(`${label}.thumbnailAlt must not be empty`);

    if (tool.status === 'placeholder') {
      if (tool.slug !== null || tool.detail !== null) errors.push(`${label} placeholder entries cannot expose a slug or detail`);
      return;
    }

    if (!tool.slug || !isValidSelfBuiltToolSlug(tool.slug)) errors.push(`${label}.slug must be a safe lowercase slug`);
    if (tool.slug && slugs.has(tool.slug)) errors.push(`${label}.slug must be unique`);
    if (tool.slug) slugs.add(tool.slug);
    if (!tool.detail) errors.push(`${label}.detail is required for published entries`);
    if (!tool.title.trim() || tool.title === '名称準備中') errors.push(`${label}.title must be final before publishing`);
    if (!tool.summary.trim()) errors.push(`${label}.summary is required for published entries`);
  });

  return { ok: errors.length === 0, errors };
}

export function getPublishedSelfBuiltTools(tools: readonly SelfBuiltTool[] = selfBuiltTools): readonly SelfBuiltTool[] {
  return tools.filter((tool) => tool.status === 'published' && tool.slug && tool.detail);
}

export function getPublishedSelfBuiltTool(slug: string, tools: readonly SelfBuiltTool[] = selfBuiltTools): SelfBuiltTool | undefined {
  return getPublishedSelfBuiltTools(tools).find((tool) => tool.slug === slug);
}

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getPendingTemplateMessage,
  isValidHttpsUrl,
  isValidLocalThumbnailPath,
  validateWebTemplateGalleryConfig,
  webTemplateGallery,
} from '../app/components/site/web-template-gallery-data.ts';
import {
  damp,
  DRAG_CLICK_SUPPRESSION_THRESHOLD,
  getTemplateBurstTransform,
  hasExceededDragThreshold,
  modulo,
  NORMALIZED_TEMPLATE_PLACEMENTS,
  TEMPLATE_COUNT,
  wrapNormalized,
} from '../app/components/site/web-template-gallery-field.ts';
import {
  getTemplateGalleryTimeline,
  TEMPLATE_GALLERY_BURST_END,
  TEMPLATE_GALLERY_COMPACT_END,
} from '../app/components/site/web-template-gallery-motion.ts';

const homeSource = readFileSync(new URL('../app/components/site/HomeExperience.tsx', import.meta.url), 'utf8');
const gallerySource = readFileSync(new URL('../app/components/site/WebTemplateGallery.tsx', import.meta.url), 'utf8');
const galleryStyles = readFileSync(new URL('../app/components/site/web-template-gallery.module.css', import.meta.url), 'utf8');
const navSource = readFileSync(new URL('../app/components/site/SiteChrome.tsx', import.meta.url), 'utf8');

test('modulo and normalized wrapping handle all four field edges', () => {
  assert.equal(modulo(0, 1), 0);
  assert.equal(modulo(1, 1), 0);
  assert.equal(modulo(-1, 1), 0);
  assert.equal(modulo(-0.25, 1), 0.75);
  assert.equal(wrapNormalized(0), 0);
  assert.equal(wrapNormalized(1), 0);
  assert.equal(wrapNormalized(-0.01), 0.99);
  assert.ok(Math.abs(wrapNormalized(1.01) - 0.01) < Number.EPSILON * 8);
});

test('template field is deterministic and contains exactly fifteen normalized placements', () => {
  assert.equal(TEMPLATE_COUNT, 15);
  assert.equal(NORMALIZED_TEMPLATE_PLACEMENTS.length, 15);
  NORMALIZED_TEMPLATE_PLACEMENTS.forEach((placement) => {
    assert.ok(placement.x >= 0 && placement.x < 1);
    assert.ok(placement.y >= 0 && placement.y < 1);
  });
  assert.deepEqual(NORMALIZED_TEMPLATE_PLACEMENTS, [...NORMALIZED_TEMPLATE_PLACEMENTS]);
  assert.deepEqual(getTemplateBurstTransform(0, 0), getTemplateBurstTransform(0, 0));
  assert.equal(getTemplateBurstTransform(0, 0).opacity, 0);
  assert.equal(getTemplateBurstTransform(0, 1).opacity, 1);
});

test('gallery reveal follows title, reveal, burst, explore, and settle boundaries', () => {
  const title = getTemplateGalleryTimeline(0);
  const reveal = getTemplateGalleryTimeline(0.3);
  const burstEnd = getTemplateGalleryTimeline(TEMPLATE_GALLERY_BURST_END);
  assert.equal(title.titleOpacity, 1);
  assert.equal(title.bodyOpacity, 0);
  assert.equal(title.burst, 0);
  assert.ok(reveal.bodyOpacity > 0);
  assert.ok(reveal.burst > 0);
  assert.equal(burstEnd.burst, 1);
  assert.equal(burstEnd.compact, 0);
  assert.equal(getTemplateGalleryTimeline(TEMPLATE_GALLERY_COMPACT_END).compact, 1);
  assert.ok(getTemplateGalleryTimeline(0.54).compact > burstEnd.compact);
  assert.ok(getTemplateGalleryTimeline(0.54).compact < getTemplateGalleryTimeline(TEMPLATE_GALLERY_COMPACT_END).compact);
  const compactSamples = [0.48, 0.5, 0.54, 0.58, 0.6].map((progress) => getTemplateGalleryTimeline(progress).compact);
  compactSamples.slice(1).forEach((sample, index) => assert.ok(sample >= compactSamples[index]));
  assert.equal(burstEnd.explore, 0);
  assert.equal(getTemplateGalleryTimeline(0.9).settle > 0, true);
});

test('damping is bounded and drag suppression starts at eight pixels', () => {
  assert.equal(DRAG_CLICK_SUPPRESSION_THRESHOLD, 8);
  assert.equal(damp(0, 1, 8, 0), 0);
  assert.ok(damp(0, 1, 8, 0.1) > 0 && damp(0, 1, 8, 0.1) < 1);
  assert.equal(hasExceededDragThreshold(0, 0, 8, 0), true);
  assert.equal(hasExceededDragThreshold(0, 0, 7.99, 0), false);
});

test('HTTPS validation rejects credentials and local thumbnail validation is strict', () => {
  assert.equal(isValidHttpsUrl('https://example.com/templates'), true);
  assert.equal(isValidHttpsUrl('http://example.com/templates'), false);
  assert.equal(isValidHttpsUrl('https://user:secret@example.com/templates'), false);
  assert.equal(isValidHttpsUrl('https://user@example.com/templates'), false);
  assert.equal(isValidHttpsUrl('javascript:alert(1)'), false);
  assert.equal(isValidLocalThumbnailPath('/assets/templates/01.webp'), true);
  assert.equal(isValidLocalThumbnailPath('https://example.com/01.webp'), false);
  assert.equal(isValidLocalThumbnailPath('/uploads/01.webp'), false);
  assert.equal(isValidLocalThumbnailPath('/assets/templates/../01.webp'), false);
  assert.equal(isValidLocalThumbnailPath('/assets/templates//01.webp'), false);
});

test('gallery data has exactly fifteen ordered pending cards and passes the config gate', () => {
  assert.equal(webTemplateGallery.galleryUrl, null);
  assert.equal(webTemplateGallery.templates.length, 15);
  assert.deepEqual(webTemplateGallery.templates.map((template) => template.title), Array.from({ length: 15 }, (_, index) => `Template ${String(index + 1).padStart(2, '0')}`));
  assert.deepEqual(webTemplateGallery.templates.map((template) => template.order), Array.from({ length: 15 }, (_, index) => index + 1));
  webTemplateGallery.templates.forEach((template) => {
    assert.equal(template.url, null);
    assert.equal(template.thumbnailSrc, null);
    assert.equal(template.thumbnailAlt, null);
  });
  assert.equal(validateWebTemplateGalleryConfig(webTemplateGallery).ok, true);
  assert.equal(getPendingTemplateMessage(webTemplateGallery.templates[0]), 'Template 01 のURLは準備中です。');
});

test('gallery config gate catches URL, duplicate order, and thumbnail/alt mistakes', () => {
  const invalid = structuredClone(webTemplateGallery);
  invalid.galleryUrl = 'https://user:secret@example.com/gallery';
  invalid.templates[1].order = invalid.templates[0].order;
  invalid.templates[2].thumbnailSrc = '/assets/templates/03.webp';
  invalid.templates[3].thumbnailSrc = '/assets/templates/../03.webp';
  const result = validateWebTemplateGalleryConfig(invalid);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.some((error) => error.includes('galleryUrl')));
  assert.ok(result.errors.some((error) => error.includes('order')));
  assert.ok(result.errors.some((error) => error.includes('thumbnailSrc and thumbnailAlt')));
  assert.ok(result.errors.some((error) => error.includes('local /assets/templates path')));
});

test('template section replaces the old capability section and keeps CTA/link safety branches', () => {
  assert.match(homeSource, /<WebTemplateGallery \/>/);
  assert.doesNotMatch(homeSource, /CAPABILITY MAP|SYSTEM LAYERS|capabilities-section|const capabilities/);
  assert.match(gallerySource, /id="templates"/);
  assert.match(gallerySource, /<article\s+key=\{template\.id\}/);
  assert.match(gallerySource, /START SMALL \/ CHOOSE A DIRECTION/);
  assert.match(gallerySource, /まずは簡単なWEBサイトから。/);
  assert.match(gallerySource, /大がかりな開発でなくても構いません。まずはお気軽に、シンプルなWebサイトの制作だけお受けすることも可能です。公開済みのテンプレートから、目的や雰囲気に合うものを選んで始められます。/);
  assert.match(gallerySource, /テンプレート一覧を見る/);
  assert.match(gallerySource, /VIEW ALL TEMPLATES ↗/);
  assert.match(gallerySource, /一覧URL準備中/);
  assert.match(gallerySource, /galleryUrl \?/);
  assert.match(gallerySource, /target="_blank" rel="noopener noreferrer"/);
  assert.match(gallerySource, /role="status" data-pending-message="Template 01 のURLは準備中です。"/);
  assert.doesNotMatch(gallerySource, /<button[^>]+className=\{styles\.cta\}/);
});

test('gallery keeps native scroll while trackpad input moves cards with the gesture on both axes', () => {
  assert.match(gallerySource, /requestAnimationFrame/);
  assert.match(gallerySource, /event\.deltaX/);
  assert.match(gallerySource, /event\.deltaY/);
  assert.match(gallerySource, /passive: true/);
  const wheelSource = gallerySource.slice(gallerySource.indexOf('const onWheel'), gallerySource.indexOf('stage.addEventListener(\'wheel\''));
  assert.doesNotMatch(wheelSource, /preventDefault/);
  assert.match(wheelSource, /targetX\s*-=\s*event\.deltaX\s*\*\s*0\.0014/);
  assert.match(wheelSource, /targetY\s*-=\s*event\.deltaY\s*\*\s*0\.00075/);
  assert.doesNotMatch(wheelSource, /targetY\s*\+=\s*event\.deltaY/);
  assert.match(galleryStyles, /touch-action: pan-y/);
  assert.match(gallerySource, /IntersectionObserver/);
  assert.match(gallerySource, /visibilitychange/);
  assert.match(gallerySource, /fieldStage\.inert/);
  assert.doesNotMatch(gallerySource, /scrollIntoView/);
  assert.match(gallerySource, /0\.5 - placement\.x/);
  assert.match(gallerySource, /0\.5 - placement\.y/);
  assert.match(gallerySource, /SCROLL TO CONTINUE/);
  assert.match(gallerySource, /timeline\.compact/);
  assert.match(galleryStyles, /--gallery-compact/);
  assert.match(galleryStyles, /max-height: calc\(8rem \* \(1 - var\(--gallery-compact\)\)\)/);
  assert.match(galleryStyles, /--gallery-compact-title-size/);
  assert.match(galleryStyles, /min-height: 300vh/);
  assert.match(galleryStyles, /translate3d\([\s\S]*-50%/);
  assert.match(galleryStyles, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)/);
});

test('responsive title and all fifteen action hit areas stay within their contracts', () => {
  const mobileContentWidth = 390 - (2 * 20);
  const mobileStartTitleSize = Math.min(1.85 * 16, 390 * 0.08, 3.2 * 16);
  const compactTitleSizes = [...galleryStyles.matchAll(/--gallery-compact-title-size: ([\d.]+)rem/g)].map((match) => Number(match[1]) * 16);
  const compactTitleSize = Math.min(...compactTitleSizes);
  assert.ok(mobileStartTitleSize <= mobileContentWidth);
  assert.ok(compactTitleSize <= mobileStartTitleSize);
  assert.equal(getTemplateGalleryTimeline(0).compact, 0);
  assert.equal(getTemplateGalleryTimeline(0.35).compact, 0);
  assert.equal(getTemplateGalleryTimeline(0.6).compact, 1);
  assert.match(galleryStyles, /\.titleLine \{ display: block; white-space: nowrap; \}/);

  const actionMinHeight = Number(galleryStyles.match(/\.cardAction \{[\s\S]*?min-height: (\d+)px/)?.[1] ?? 0);
  const actionMinWidth = Number(galleryStyles.match(/\.cardAction \{[\s\S]*?min-width: (\d+)px/)?.[1] ?? 0);
  const minimumRenderedCardScale = Math.min(...NORMALIZED_TEMPLATE_PLACEMENTS.map(({ scale, z }) => scale * (1100 / (1100 - z))));
  assert.equal(TEMPLATE_COUNT, 15);
  assert.ok(actionMinHeight * minimumRenderedCardScale >= 44);
  assert.ok(actionMinWidth * minimumRenderedCardScale >= 44);
  assert.match(galleryStyles, /flex-shrink: 0/);
});

test('primary navigation includes the requested anchors including Personal Lab', () => {
  ['Selected Work', 'Method', 'Templates', 'Lab', 'Profile', 'Contact'].forEach((label) => assert.match(navSource, new RegExp(`label: '${label}'`)));
  assert.match(navSource, /href: '#templates'/);
  assert.match(navSource, /href: '#lab'/);
});

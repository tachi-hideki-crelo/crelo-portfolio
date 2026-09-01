import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  getPublishedSelfBuiltTools,
  isValidLabThumbnailPath,
  isValidSelfBuiltToolSlug,
  selfBuiltTools,
  validateSelfBuiltTools,
} from '../app/components/site/self-development-data.ts';
import {
  getSelfDevelopmentItemTimeline,
  getSelfDevelopmentStageTimeline,
  SELF_DEVELOPMENT_WINDOWS,
} from '../app/components/site/self-development-motion.ts';

const componentSource = readFileSync(new URL('../app/components/site/SelfDevelopmentLab.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/components/site/self-development-lab.module.css', import.meta.url), 'utf8');
const homeSource = readFileSync(new URL('../app/components/site/HomeExperience.tsx', import.meta.url), 'utf8');
const navSource = readFileSync(new URL('../app/components/site/SiteChrome.tsx', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../app/lab/[slug]/page.tsx', import.meta.url), 'utf8');

test('personal lab starts with four honest, ordered, non-routable placeholders', () => {
  assert.equal(selfBuiltTools.length, 4);
  assert.deepEqual(selfBuiltTools.map((tool) => tool.order), [1, 2, 3, 4]);
  assert.deepEqual(selfBuiltTools.map((tool) => tool.accent), ['mint', 'cyan', 'amber', 'violet']);
  selfBuiltTools.forEach((tool) => {
    assert.equal(tool.title, '名称準備中');
    assert.equal(tool.summary, 'ツールの目的、解決したい課題、主な機能をここに掲載します。');
    assert.equal(tool.status, 'placeholder');
    assert.equal(tool.slug, null);
    assert.equal(tool.thumbnailSrc, null);
    assert.equal(tool.thumbnailAlt, null);
    assert.equal(tool.detail, null);
  });
  assert.equal(getPublishedSelfBuiltTools().length, 0);
  assert.deepEqual(validateSelfBuiltTools(selfBuiltTools), { ok: true, errors: [] });
});

test('lab validation rejects unsafe slugs, duplicates, and incomplete media or details', () => {
  assert.equal(isValidSelfBuiltToolSlug('field-console'), true);
  assert.equal(isValidSelfBuiltToolSlug('../field-console'), false);
  assert.equal(isValidSelfBuiltToolSlug('Field Console'), false);
  assert.equal(isValidLabThumbnailPath('/assets/lab/tool-01.webp'), true);
  assert.equal(isValidLabThumbnailPath('https://example.com/tool.webp'), false);
  assert.equal(isValidLabThumbnailPath('/assets/lab/../private.webp'), false);

  const invalid = structuredClone(selfBuiltTools);
  invalid[0].id = invalid[1].id;
  invalid[0].status = 'published';
  invalid[0].slug = 'Unsafe Slug';
  invalid[0].thumbnailSrc = '/assets/lab/missing.webp';
  invalid[0].thumbnailAlt = null;
  const result = validateSelfBuiltTools(invalid);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('.id')));
  assert.ok(result.errors.some((error) => error.includes('.slug')));
  assert.ok(result.errors.some((error) => error.includes('.detail')));
  assert.ok(result.errors.some((error) => error.includes('thumbnailSrc and thumbnailAlt')));
});

test('four overlapping scroll windows rise from below, center, and exit above', () => {
  assert.deepEqual(SELF_DEVELOPMENT_WINDOWS, [
    { start: 0.12, end: 0.38 },
    { start: 0.30, end: 0.56 },
    { start: 0.48, end: 0.74 },
    { start: 0.66, end: 0.92 },
  ]);
  SELF_DEVELOPMENT_WINDOWS.forEach((window, index) => {
    const before = getSelfDevelopmentItemTimeline(window.start - 0.01, index);
    const centered = getSelfDevelopmentItemTimeline((window.start + window.end) / 2, index);
    const after = getSelfDevelopmentItemTimeline(window.end, index);
    assert.equal(before.opacity, 0);
    assert.ok(before.yVh > 80);
    assert.ok(centered.opacity > 0.99);
    assert.ok(Math.abs(centered.yVh) < 0.01);
    assert.ok(centered.copyReveal > 0.9);
    assert.ok(after.yVh < -90);
    assert.equal(after.interactive, false);
  });
  const leftArrival = getSelfDevelopmentItemTimeline(0.14, 0);
  const rightArrival = getSelfDevelopmentItemTimeline(0.32, 1);
  assert.ok(leftArrival.xVw < 0);
  assert.ok(rightArrival.xVw > 0);

  for (const checkpoint of [0.36, 0.54, 0.72]) {
    const visible = selfBuiltTools.map((_, index) => getSelfDevelopmentItemTimeline(checkpoint, index));
    assert.ok(
      visible.some((item) => item.opacity > 0.9 && Math.abs(item.yVh) < 8 && item.copyReveal > 0.85),
      `a readable tool should bridge the ${checkpoint} handoff`,
    );
  }
});

test('stage reveals the title, activates tools, and ends with the profile cue', () => {
  assert.equal(getSelfDevelopmentStageTimeline(0).titleReveal, 0);
  assert.equal(getSelfDevelopmentStageTimeline(0.12).bodyReveal, 1);
  assert.equal(getSelfDevelopmentStageTimeline(0.18).phase, 'tool-1');
  assert.equal(getSelfDevelopmentStageTimeline(0.36).phase, 'tool-2');
  assert.equal(getSelfDevelopmentStageTimeline(0.54).phase, 'tool-3');
  assert.equal(getSelfDevelopmentStageTimeline(0.72).phase, 'tool-4');
  assert.equal(getSelfDevelopmentStageTimeline(0.96).phase, 'outro');
  assert.ok(getSelfDevelopmentStageTimeline(0.96).outro > 0);
});

test('lab source keeps semantic placeholders, offscreen pausing, and future detail links safe', () => {
  assert.match(componentSource, /id="lab"/);
  assert.match(componentSource, /05<\/span><span>SELF-BUILT TOOLS/);
  assert.match(componentSource, /PERSONAL LAB \/ BUILT FROM CURIOSITY/);
  assert.match(componentSource, /<article/);
  assert.match(componentSource, /tool\.status === 'published' && tool\.slug/);
  assert.doesNotMatch(componentSource, /<button/);
  assert.match(componentSource, /IntersectionObserver/);
  assert.match(componentSource, /visibilitychange/);
  assert.match(componentSource, /item\.inert/);
  assert.match(componentSource, /pointerType === 'touch'/);
  assert.match(styles, /min-height: 460vh/);
  assert.match(styles, /position: sticky/);
  assert.match(styles, /data-side='right'/);
  assert.match(styles, /data-reduced-motion='true'/);
  assert.match(styles, /animation-play-state: paused/);
});

test('home, navigation, and future detail route use the requested structure', () => {
  assert.match(homeSource, /<WebTemplateGallery \/>[\s\S]*<SelfDevelopmentLab \/>[\s\S]*id="profile"/);
  assert.match(homeSource, /<span>06<\/span><span>\{profileReady/);
  assert.match(homeSource, /<span>07<\/span><span>CONTACT \/ START A FIELD LOOP/);
  assert.match(navSource, /href: '#lab', label: 'Lab'/);
  assert.match(routeSource, /export const dynamicParams = false/);
  assert.match(routeSource, /getPublishedSelfBuiltTools/);
  assert.match(routeSource, /if \(!tool \|\| !tool\.detail\) notFound\(\)/);
  assert.match(routeSource, /socialImage \?/);
});

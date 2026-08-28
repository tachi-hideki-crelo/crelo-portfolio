import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { caseStudies } from '../app/lib/content.ts';
import { parsePublicOrigin } from '../app/seo-config.ts';
import {
  CARD_LAYOUT,
  STATIC_CARD_LAYOUT,
  getOrbitProgress,
  getOrbitStageVisuals,
  getOrbitalCardMotion,
  getPointerCardMotion,
  getScatterEntryProgress,
} from '../app/components/work/work-motion.ts';
import { getApprovedMedia, getApprovedOgMedia, isPublicCaseStudy } from '../app/components/work/work-metadata.ts';
import { projectPublicCaseStudies } from '../app/components/work/work-public.ts';

const selectedWorkSource = await readFile(new URL('../app/components/work/selected-work.tsx', import.meta.url), 'utf8');
const selectedWorkStyles = await readFile(new URL('../app/components/work/selected-work.module.css', import.meta.url), 'utf8');
const detailSource = await readFile(new URL('../app/work/[slug]/page.tsx', import.meta.url), 'utf8');
const detailStyles = await readFile(new URL('../app/components/work/work-detail.module.css', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const homeSource = await readFile(new URL('../app/components/site/HomeExperience.tsx', import.meta.url), 'utf8');
const publicProjectionSource = await readFile(new URL('../app/components/work/work-public.ts', import.meta.url), 'utf8');

test('selected work exposes all five approved-safe slots without inventing case facts', () => {
  assert.deepEqual(caseStudies.map(({ slug }) => slug), [
    'field-signal',
    'workflow-atlas',
    'decision-lens',
    'ops-interface',
    'delivery-orbit',
  ]);
  assert.equal(new Set(caseStudies.map(({ slug }) => slug)).size, 5);
  assert.ok(caseStudies.every(({ approved, title, media }) => !approved && title === null && media.length === 0));
});

test('selected work keyboard contract and detail CTAs are source-visible', () => {
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) assert.match(selectedWorkSource, new RegExp(key));
  assert.match(selectedWorkSource, /role="tablist"/);
  assert.match(selectedWorkSource, /role="tab"/);
  assert.match(selectedWorkSource, /tabIndex=\{active \? 0 : -1\}/);
  assert.match(selectedWorkSource, /data-tab-group/);
  assert.match(selectedWorkSource, /href=\{`\/work\/\$\{caseStudy\.slug\}`\}/);
  assert.match(selectedWorkSource, /max-width: 768px/);
  assert.match(selectedWorkStyles, /min-height: 4\.25rem/);
  assert.match(selectedWorkSource, /data-index=\{index\}/);
  assert.match(selectedWorkSource, /querySelector<HTMLButtonElement>\(`button\[data-tab-group=/);
  assert.match(selectedWorkSource, /focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(selectedWorkSource, /keyboardScrollLockRef/);
  assert.doesNotMatch(selectedWorkSource, /shouldHoldKeyboardSelection/);
  assert.match(selectedWorkSource, /HOVER TO SELECT/);
  assert.match(selectedWorkSource, /TAP TO SELECT/);
});

test('client SelectedWork receives only a server-redacted projection', () => {
  assert.doesNotMatch(selectedWorkSource, /from ['"]\.\.\/\.\.\/lib\/content/);
  assert.match(selectedWorkSource, /cases: readonly PublicCaseStudy\[\]/);
  assert.match(pageSource, /projectPublicCaseStudies\(caseStudies, publicBuild\)/);
  assert.match(pageSource, /workCases=\{workCases\}/);
  assert.match(homeSource, /workCases: readonly PublicCaseStudy\[\]/);
  assert.match(homeSource, /<SelectedWork cases=\{workCases\} \/>/);
  assert.doesNotMatch(publicProjectionSource, /from ['"]\.\.\/\.\.\/lib\/content/);
  assert.doesNotMatch(publicProjectionSource, /CaseStudyMedia|media:/);

  const draft = {
    ...caseStudies[0],
    title: 'UNAPPROVED TITLE',
    industry: 'UNAPPROVED INDUSTRY',
    challenge: 'UNAPPROVED CHALLENGE',
    constraints: ['UNAPPROVED CONSTRAINT'],
    role: 'UNAPPROVED ROLE',
    technologies: ['UNAPPROVED TECH'],
    media: [{
      src: '/assets/cases/private.mp4',
      alt: 'UNAPPROVED MEDIA',
      kind: 'video',
      approved: true,
      approvedAt: '2026-08-25',
      poster: '/assets/cases/private-poster.png',
      hasAudio: false,
      captionsSrc: null,
    }],
  };
  const redacted = projectPublicCaseStudies([draft], true)[0];
  assert.equal(redacted.approved, false);
  assert.equal(redacted.title, null);
  assert.equal(redacted.challenge, null);
  assert.equal('constraints' in redacted, false);
  assert.equal('technologies' in redacted, false);
  assert.equal('media' in redacted, false);
  assert.doesNotMatch(JSON.stringify(redacted), /UNAPPROVED|private\.mp4/i);

  const approved = projectPublicCaseStudies([{
    ...draft,
    approved: true,
    title: 'Approved case',
    challenge: 'Approved challenge',
    media: draft.media,
  }], true)[0];
  assert.equal(approved.approved, true);
  assert.equal(approved.title, 'Approved case');
  assert.equal('constraints' in approved, false);
  assert.equal('media' in approved, false);
  assert.doesNotMatch(JSON.stringify(approved), /private\.mp4|UNAPPROVED MEDIA/i);

  const approvedPreview = projectPublicCaseStudies([{
    ...draft,
    approved: true,
    title: 'Approved case',
    challenge: 'Approved challenge',
  }], false)[0];
  assert.equal(approvedPreview.approved, false);
  assert.equal(approvedPreview.title, null);
  assert.equal('media' in approvedPreview, false);
});

test('selected work keeps motion browser-safe and has a static reduced-motion path', () => {
  assert.match(selectedWorkSource, /useReducedMotion/);
  assert.match(selectedWorkSource, /initial=\{reduceMotion \? false/);
  assert.match(selectedWorkSource, /--card-x-px/);
  assert.match(selectedWorkSource, /--card-pointer-x/);
  assert.match(selectedWorkSource, /--work-rotation/);
  assert.match(selectedWorkSource, /updateScatterFromScroll\(section, reduceMotion\)/);
  assert.match(selectedWorkSource, /getScatterEntryProgress\([\s\S]*rect\.top,[\s\S]*stageFlowTop,[\s\S]*window\.innerHeight,[\s\S]*reduceMotion/);
  assert.match(selectedWorkSource, /data-work-stage-anchor/);
  assert.match(selectedWorkSource, /stageAnchor\.getBoundingClientRect\(\)\.top - rect\.top/);
  assert.match(selectedWorkSource, /getOrbitStageVisuals\(entryProgress, reduceMotion\)/);
  assert.match(selectedWorkSource, /getOrbitalCardMotion/);
  assert.match(selectedWorkSource, /dataset\.orbitReady/);
  assert.match(selectedWorkSource, /toggleAttribute\('inert', !ready\)/);
  assert.match(selectedWorkSource, /setAttribute\('aria-hidden', 'true'\)/);
  assert.match(selectedWorkSource, /querySelectorAll<HTMLElement>\('button, a\[href\]'\)/);
  assert.match(selectedWorkSource, /setDesktopTabListReady\(desktopTabList, orbitReady\)/);
  assert.doesNotMatch(selectedWorkSource, /getBurstProgress|card-burst-progress|dataset\.burstReady/);
  assert.doesNotMatch(selectedWorkSource, /getActiveCaseIndex/);
  const scatterSource = selectedWorkSource.slice(
    selectedWorkSource.indexOf('function updateScatterFromScroll'),
    selectedWorkSource.indexOf('function CaseCard'),
  );
  assert.doesNotMatch(scatterSource, /stage\.getBoundingClientRect\(\)/);
  assert.doesNotMatch(scatterSource, /setActive|handleSelect/);
  assert.match(selectedWorkSource, /className=\{styles\.stageVisual\}/);
  assert.match(selectedWorkSource, /className=\{styles\.mobilePanelVisual\}/);
  assert.match(selectedWorkSource, /onPointerLeave=\{handleStagePointerLeave\}/);
  assert.match(selectedWorkSource, /getPointerCardMotion/);
  assert.match(selectedWorkSource, /requestAnimationFrame/);
  assert.match(selectedWorkSource, /data-work-stage/);
  assert.match(selectedWorkSource, /hoveredIndex/);
  assert.match(selectedWorkSource, /if \(index === sample\.hoveredIndex\) return;/);
  assert.doesNotMatch(selectedWorkSource, /className=\{styles\.cursor\}/);
  assert.doesNotMatch(selectedWorkSource, /--cursor-[xy]/);
  assert.doesNotMatch(selectedWorkSource, /dataset\.cursor(?:Inside|Hover|Focus)/);
  assert.doesNotMatch(selectedWorkSource, /cursor\.style\.opacity/);
  assert.doesNotMatch(selectedWorkSource, /window\.addEventListener\('pointermove'/);
  assert.match(selectedWorkStyles, /perspective: 1100px/);
  assert.match(selectedWorkStyles, /--work-entry-scale/);
  assert.match(selectedWorkStyles, /data-orbit-ready='false'/);
  assert.match(selectedWorkStyles, /translate3d\(calc\(var\(--card-x-px\) \+ var\(--card-pointer-x\)\)/);
  assert.match(selectedWorkStyles, /rotate\(var\(--work-rotation\)\)/);
  assert.match(selectedWorkStyles, /z-index: calc\(3 - var\(--card-order\)\)/);
  assert.match(selectedWorkStyles, /\.card\[data-active='true'\][\s\S]*z-index: 8/);
  assert.match(selectedWorkStyles, /\.summaryPanel[\s\S]*z-index: 10/);
  assert.match(selectedWorkStyles, /rgb\(5 12 14 \/ 98%\)/);
  assert.match(selectedWorkStyles, /\.cardArrow[\s\S]*height: 2\.8rem[\s\S]*width: 2\.8rem/);
  assert.match(selectedWorkStyles, /\.cardArrow::before[\s\S]*transform: scale\(0\.55\)/);
  assert.match(selectedWorkStyles, /\.cardArrow > span[\s\S]*transform: scale\(0\.55\)/);
  assert.match(selectedWorkSource, /<h2 id="selected-work-title">実績例<\/h2>/);
  assert.match(selectedWorkSource, /実際の例をご紹介します。<br \/>/);
  assert.match(selectedWorkSource, />WEBサイト、<\/span><span[^>]*>チラシ制作、<\/span><span[^>]*>SNSデータ運用化、<\/span><span[^>]*>アプリ開発など<\/span><br \/>/);
  assert.match(selectedWorkSource, />様々な企業の悩みに合った<\/span><span[^>]*>技術を用いて<\/span><span[^>]*>解決を目指します。<\/span>/);
  assert.equal((selectedWorkSource.match(/<br \/>/g) ?? []).length, 2);
  assert.doesNotMatch(selectedWorkSource, /現場に入り、|解像度|5つの匿名ケースを選択できます。/);
  assert.match(selectedWorkStyles, /\.introCopy[\s\S]*max-width: 42rem/);
  assert.match(selectedWorkStyles, /\.introCopyChunk[\s\S]*display: inline-block[\s\S]*white-space: nowrap/);
  assert.match(selectedWorkStyles, /\.stageVisual > div[\s\S]*min-height: 0/);
  assert.doesNotMatch(selectedWorkStyles, /stageShell > \.visual/);
  assert.doesNotMatch(selectedWorkStyles, /\.cursor\s*\{/);
  assert.doesNotMatch(selectedWorkStyles, /data-cursor-(?:inside|hover|focus)/);
  assert.match(selectedWorkStyles, /prefers-reduced-motion: reduce\) and \(min-width: 769px\)/);
  assert.match(selectedWorkStyles, /\.selectedWork \{[\s\S]*?min-height: 200vh/);
  assert.match(selectedWorkStyles, /prefers-reduced-motion: reduce\) and \(min-width: 769px\)[\s\S]*?min-height: 190vh/);
  assert.match(selectedWorkStyles, /min-width: 769px\) and \(max-height: 688px\)[\s\S]*?\.desktopStage,[\s\S]*?\.stageShell[\s\S]*?min-height: 100vh/);
  assert.doesNotMatch(selectedWorkStyles, /calc\([^)]*\*/);
  assert.match(detailSource, /className=\{styles\.heroVisual\}/);
});

test('selected work bleeds the active case theme into its black background without replacing card accents', () => {
  assert.match(selectedWorkSource, /AnimatePresence/);
  assert.match(selectedWorkSource, /data-active-theme=\{activeCase\.theme\}/);
  assert.match(selectedWorkSource, /data-theme-bleed=\{caseStudy\.theme\}/);
  assert.match(selectedWorkSource, /--bleed-rgb/);
  assert.match(selectedWorkSource, /key=\{`theme-bleed-\$\{caseStudy\.slug\}`\}/);
  assert.match(selectedWorkSource, /className=\{styles\.desktopThemeBleed\}/);
  assert.match(selectedWorkSource, /className=\{styles\.mobileThemeBleed\}/);
  assert.match(selectedWorkStyles, /\.themeBleed[\s\S]*pointer-events: none[\s\S]*z-index: 0/);
  assert.doesNotMatch(selectedWorkStyles, /\.themeBleed[\s\S]{0,240}will-change/);
  assert.match(selectedWorkStyles, /\.themeBleed::before[\s\S]*radial-gradient[\s\S]*--bleed-rgb/);
  assert.match(selectedWorkStyles, /\.desktopThemeBleed[\s\S]*inset: -8% -8vw/);
  assert.match(selectedWorkStyles, /\.mobileThemeBleed[\s\S]*inset: -3rem -1\.25rem -4rem/);
  assert.match(selectedWorkStyles, /\.cardButton[\s\S]*border: 1px solid rgb\(var\(--case-accent-rgb\) \/ 42%\)/);
  assert.match(selectedWorkStyles, /\.mobileItemActive[\s\S]*border-color: var\(--case-accent\)/);
  assert.match(selectedWorkStyles, /prefers-reduced-motion: reduce\)[\s\S]*\.themeBleed/);

  const cardMarkup = selectedWorkSource.slice(selectedWorkSource.indexOf('<article'), selectedWorkSource.indexOf('function MobileCaseItem'));
  assert.ok(cardMarkup.indexOf('onPointerEnter=') < cardMarkup.indexOf('<button'));

  const themeRgbValues = [...selectedWorkSource.matchAll(/accentSoft: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(themeRgbValues.length, 5);
  assert.equal(new Set(themeRgbValues).size, 5);
  assert.ok(themeRgbValues.every((value) => /^\d+ \d+ \d+$/.test(value)));
});

test('detail route has static params, notFound handling, noindex metadata and all publication fields', () => {
  assert.match(detailSource, /generateStaticParams/);
  assert.match(detailSource, /notFound\(\)/);
  assert.match(detailSource, /index: false/);
  for (const heading of ['課題', '制約', '担当', '発見', '設計', '実装', '導入', '定性成果', '技術', '承認媒体']) {
    assert.match(detailSource, new RegExp(heading));
  }
  assert.match(detailSource, /公開承認後に反映/);
  assert.match(detailSource, /id="main-content"/);
  assert.match(detailSource, /tabIndex=\{-1\}/);
  assert.match(detailSource, /isPublicCaseStudy/);
  assert.match(detailSource, /alternates: canonical/);
  assert.match(detailSource, /approvedOgMedia/);
  assert.match(detailSource, /getApprovedMedia/);
  assert.match(detailSource, /approvedMedia\.map\(\(media\) => media\.alt\)/);
  assert.match(detailSource, /controls[\s\S]*playsInline[\s\S]*preload="metadata"/);
  assert.match(detailSource, /kind="captions"/);
  assert.doesNotMatch(detailSource, /autoPlay/);
  assert.doesNotMatch(detailSource, /caseStudy\.media\.map\(\(media\) => media\.alt\)/);
  assert.match(detailSource, /function displayValue\(value: unknown, approved: boolean\)[\s\S]*if \(!approved\) return pendingValue\(\)/);
  assert.match(detailStyles, /\.breadcrumb a[\s\S]*display: inline-flex[\s\S]*min-height: 2\.75rem[\s\S]*min-width: 2\.75rem/);
  assert.match(detailStyles, /\.headerLink[\s\S]*min-width: 2\.75rem/);
  assert.match(detailStyles, /\.headerLink:focus-visible[\s\S]*outline/);
});

test('detail metadata indexes only approved production cases with a valid HTTPS origin', () => {
  const preview = caseStudies[0];
  assert.equal(parsePublicOrigin('http://localhost:3011'), null);
  assert.equal(parsePublicOrigin('https://crelo.example/')?.origin, 'https://crelo.example');
  assert.equal(parsePublicOrigin('https://crelo.example/work?preview=1'), null);
  assert.equal(isPublicCaseStudy(preview, { contentMode: 'production', siteOrigin: 'https://crelo.example' }), false);

  const approved = {
    ...preview,
    approved: true,
    approvedAt: '2026-08-25',
    media: [
      { src: '/assets/cases/approved.png', alt: 'Approved case visual', kind: 'image', approved: true, approvedAt: '2026-08-25', width: 1200, height: 630 },
      { src: '/assets/cases/private.png', alt: 'Private draft visual', kind: 'image', approved: false, approvedAt: '2026-08-25', width: 1200, height: 630 },
    ],
  };
  assert.equal(isPublicCaseStudy(approved, { contentMode: 'preview', siteOrigin: 'https://crelo.example' }), false);
  assert.equal(isPublicCaseStudy(approved, { contentMode: 'production', siteOrigin: 'https://crelo.example' }), true);
  assert.deepEqual(getApprovedOgMedia(approved), approved.media[0]);
  assert.equal(getApprovedOgMedia(preview), undefined);
  assert.deepEqual(getApprovedMedia(approved), [approved.media[0]]);

  const draftWithPrivateFacts = {
    ...preview,
    title: 'UNAPPROVED DRAFT TITLE',
    industry: 'UNAPPROVED INDUSTRY',
    challenge: 'UNAPPROVED CHALLENGE',
    approved: false,
    media: [{
      src: '/assets/cases/private.mp4',
      alt: 'UNAPPROVED MEDIA ALT',
      kind: 'video',
      approved: true,
      approvedAt: '2026-08-25',
      poster: '/assets/cases/private-poster.png',
      hasAudio: false,
      captionsSrc: null,
    }],
  };
  assert.deepEqual(getApprovedMedia(draftWithPrivateFacts), []);
  assert.equal(getApprovedOgMedia(draftWithPrivateFacts), undefined);
});

test('scroll orbit keeps its start, expands as a tornado, and preserves pointer magnetism', () => {
  assert.equal(CARD_LAYOUT[0].x, '0vw');
  for (const layout of CARD_LAYOUT.slice(1)) {
    assert.ok(Math.abs(Number.parseFloat(layout.x)) >= 30);
    assert.ok(Math.abs(Number.parseFloat(layout.x)) <= 32);
    assert.ok(Math.abs(Number.parseFloat(layout.y)) >= 21);
    assert.ok(Math.abs(Number.parseFloat(layout.y)) <= 25);
  }
  assert.ok(Math.abs(Number.parseFloat(STATIC_CARD_LAYOUT[1].x)) < 30);
  assert.equal(getOrbitProgress(0, 0), 0);
  assert.ok(getOrbitProgress(0.2, 0) > 0);
  assert.ok(getOrbitProgress(0.2, 0) < 0.2);
  assert.ok(getOrbitProgress(0.2, 4) < getOrbitProgress(0.2, 0));
  assert.equal(getOrbitProgress(1, 4), 1);
  assert.equal(getOrbitProgress(0, 4, true), 1);

  assert.equal(getScatterEntryProgress(0, 531, 900), 0);
  assert.equal(getScatterEntryProgress(-171, 531, 900), 0);
  assert.ok(getScatterEntryProgress(-180, 531, 900) > 0);
  assert.ok(getScatterEntryProgress(-180, 531, 900) < 0.03);
  assert.equal(getScatterEntryProgress(-486, 531, 900), 0.5);
  assert.equal(getScatterEntryProgress(-801, 531, 900), 1);
  assert.equal(getScatterEntryProgress(0, 531, 900, true), 1);

  for (const { viewportHeight, stageFlowTop } of [
    { viewportHeight: 600, stageFlowTop: 366.375 },
    { viewportHeight: 768, stageFlowTop: 516.891 },
    { viewportHeight: 900, stageFlowTop: 534.594 },
    { viewportHeight: 1080, stageFlowTop: 534.594 },
  ]) {
    const startDistance = stageFlowTop - viewportHeight * 0.4;
    assert.equal(getScatterEntryProgress(-startDistance, stageFlowTop, viewportHeight), 0);
    assert.ok(getScatterEntryProgress(-(startDistance + 1), stageFlowTop, viewportHeight) > 0);
    assert.equal(getScatterEntryProgress(-viewportHeight * 0.89, stageFlowTop, viewportHeight), 1);
    assert.ok(getScatterEntryProgress(-viewportHeight * 0.88, stageFlowTop, viewportHeight) < 1);
  }

  assert.deepEqual(getOrbitStageVisuals(0), { opacity: 0, scale: 0.72, blur: 20 });
  const middleVisuals = getOrbitStageVisuals(0.5);
  assert.ok(middleVisuals.opacity > 0.7 && middleVisuals.opacity < 0.9);
  assert.ok(middleVisuals.scale > 0.85 && middleVisuals.scale < 0.95);
  assert.ok(middleVisuals.blur > 0 && middleVisuals.blur < 6);
  assert.deepEqual(getOrbitStageVisuals(1), { opacity: 1, scale: 1, blur: 0 });
  assert.deepEqual(getOrbitStageVisuals(0, true), { opacity: 1, scale: 1, blur: 0 });

  const orbitInput = {
    index: 2,
    targetX: 400,
    targetY: -200,
    targetZ: 40,
    targetRotate: 11,
    viewportWidth: 1440,
    viewportHeight: 900,
  };
  const orbitStart = getOrbitalCardMotion({ ...orbitInput, progress: 0 });
  assert.equal(orbitStart.progress, 0);
  assert.ok(Math.abs(orbitStart.x) < 0.0001);
  assert.ok(Math.abs(orbitStart.y) < 0.0001);
  assert.ok(Math.abs(orbitStart.z) < 0.0001);

  const orbitMiddle = getOrbitalCardMotion({ ...orbitInput, progress: 0.5 });
  assert.ok(orbitMiddle.progress > 0.45 && orbitMiddle.progress < 0.65);
  assert.ok(Math.hypot(orbitMiddle.x, orbitMiddle.y) > 100);
  assert.ok(orbitMiddle.z > orbitInput.targetZ);
  assert.ok(Math.abs(orbitMiddle.rotate) > 90);

  const orbitEnd = getOrbitalCardMotion({ ...orbitInput, progress: 1 });
  assert.ok(Math.abs(orbitEnd.x - orbitInput.targetX) < 0.0001);
  assert.ok(Math.abs(orbitEnd.y - orbitInput.targetY) < 0.0001);
  assert.ok(Math.abs(orbitEnd.z - orbitInput.targetZ) < 0.0001);
  assert.ok(Math.abs(orbitEnd.rotate - orbitInput.targetRotate) < 0.0001);
  assert.equal(orbitEnd.progress, 1);

  assert.deepEqual(
    getOrbitalCardMotion({ ...orbitInput, progress: 0, reduceMotion: true }),
    { x: 400, y: -200, z: 40, rotate: 11, progress: 1 },
  );

  const tornadoSamples = [0.16, 0.24, 0.32, 0.4, 0.48, 0.56, 0.64, 0.72, 0.8, 0.88]
    .map((progress) => getOrbitalCardMotion({ ...orbitInput, progress }));
  let tornadoSweep = 0;
  for (let index = 1; index < tornadoSamples.length; index += 1) {
    const previousAngle = Math.atan2(tornadoSamples[index - 1].y, tornadoSamples[index - 1].x);
    const currentAngle = Math.atan2(tornadoSamples[index].y, tornadoSamples[index].x);
    let angleDelta = currentAngle - previousAngle;
    while (angleDelta > Math.PI) angleDelta -= Math.PI * 2;
    while (angleDelta < -Math.PI) angleDelta += Math.PI * 2;
    tornadoSweep += angleDelta;
  }
  assert.ok(tornadoSweep > Math.PI * 2, 'representative card must complete more than one tornado turn');

  const middleQuadrants = new Set();
  CARD_LAYOUT.forEach((layout, index) => {
    const targetX = Number.parseFloat(layout.x) * 14.4;
    const targetY = Number.parseFloat(layout.y) * 9;
    const middle = getOrbitalCardMotion({
      progress: 0.5,
      index,
      targetX,
      targetY,
      targetZ: layout.z,
      targetRotate: Number.parseFloat(layout.rotate),
      viewportWidth: 1440,
      viewportHeight: 900,
    });
    const crossProduct = middle.x * targetY - middle.y * targetX;

    assert.ok(Number.isFinite(middle.x));
    assert.ok(Number.isFinite(middle.y));
    assert.ok(Number.isFinite(middle.z));
    assert.ok(Math.abs(crossProduct) > 1, `card ${index} must travel on a curved path`);
    middleQuadrants.add(`${middle.x >= 0 ? 'right' : 'left'}-${middle.y >= 0 ? 'bottom' : 'top'}`);
  });
  assert.ok(middleQuadrants.size >= 3, 'tornado phase offsets must distribute cards around the axis');

  const farMotion = getPointerCardMotion({
    baseX: 520,
    baseY: 0,
    pointerX: 0,
    pointerY: 0,
    viewportWidth: 1440,
    viewportHeight: 900,
    depth: 100,
  });
  assert.ok(Math.abs(farMotion.x) < 0.001);
  assert.ok(Math.abs(farMotion.y) < 0.001);
  assert.ok(Math.abs(farMotion.rotateX) < 0.001);
  assert.ok(Math.abs(farMotion.rotateY) < 0.001);

  const nearMotion = getPointerCardMotion({
    baseX: 320,
    baseY: 0,
    pointerX: 420,
    pointerY: 0,
    viewportWidth: 1440,
    viewportHeight: 900,
    depth: 100,
  });
  assert.ok(Math.abs(nearMotion.x) > Math.abs(farMotion.x));
  assert.ok(nearMotion.x > 0);
  assert.ok(Math.abs(nearMotion.x) > 20);
  assert.ok(Math.abs(nearMotion.x) < 100);

  const directionalMotion = getPointerCardMotion({
    baseX: 160,
    baseY: 100,
    pointerX: 280,
    pointerY: 0,
    viewportWidth: 1440,
    viewportHeight: 900,
    depth: 120,
  });
  assert.ok(directionalMotion.x > 0);
  assert.ok(directionalMotion.y < 0);
  assert.ok(directionalMotion.rotateX > 0);
  assert.ok(directionalMotion.rotateY > 0);
  assert.deepEqual(getPointerCardMotion({
    baseX: 1000,
    baseY: 500,
    pointerX: 0,
    pointerY: 0,
    viewportWidth: 1440,
    viewportHeight: 900,
    depth: 100,
    reduceMotion: true,
  }), { x: 0, y: 0, rotateX: 0, rotateY: 0 });
});

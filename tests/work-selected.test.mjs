import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { caseStudies } from '../app/lib/content.ts';
import {
  CARD_LAYOUT,
  STATIC_CARD_LAYOUT,
  getOrbitProgress,
  getOrbitStageVisuals,
  getOrbitalCardMotion,
  getPointerCardMotion,
  getScatterEntryProgress,
} from '../app/components/work/work-motion.ts';
import { projectPublicCaseStudies } from '../app/components/work/work-public.ts';

const selectedWorkSource = await readFile(new URL('../app/components/work/selected-work.tsx', import.meta.url), 'utf8');
const selectedWorkStyles = await readFile(new URL('../app/components/work/selected-work.module.css', import.meta.url), 'utf8');
const pageSource = await readFile(new URL('../app/page.tsx', import.meta.url), 'utf8');
const homeSource = await readFile(new URL('../app/components/site/HomeExperience.tsx', import.meta.url), 'utf8');
const publicProjectionSource = await readFile(new URL('../app/components/work/work-public.ts', import.meta.url), 'utf8');
const sitemapSource = await readFile(new URL('../app/sitemap.ts', import.meta.url), 'utf8');

test('selected work exposes approved video and flyer cases and redacts the remaining slots', () => {
  assert.deepEqual(caseStudies.map(({ slug }) => slug), [
    'field-signal',
    'workflow-atlas',
    'decision-lens',
    'ops-interface',
    'delivery-orbit',
  ]);
  assert.equal(new Set(caseStudies.map(({ slug }) => slug)).size, 5);
  assert.equal(caseStudies[0].approved, true);
  assert.equal(caseStudies[0].title, '宣伝動画の制作');
  assert.equal(caseStudies[0].role, 'AIを用いた動画の作成');
  assert.deepEqual(caseStudies[0].detail, {
    projectName: 'AIフル活用によるプロモーション動画の企画・制作・実装',
    overview: '企画・絵コンテ作成・ビジュアル生成・動画化・BGM/ナレーション付与までを一気通貫でAIワークフロー化。従来の映像制作に比べ、制作コストとリードタイムを大幅に圧縮しながら、高品質な宣伝動画を構築しました。',
    outcomesLabel: '成果',
    outcomes: [
      { title: '制作コスト削減', description: '従来の外注実写・アニメーション制作と比較し、コストを大幅に削減' },
      { title: '短納期納品', description: '企画から完成まで最短数日での高速デプロイを実現' },
      { title: '柔軟なPDCA', description: '素材の差し替えやABテスト用パターンの量産が容易になり、広告・LP運用の改善スピードが向上' },
    ],
  });
  assert.deepEqual(caseStudies[0].media.map(({ src, role, poster, hasAudio }) => ({ src, role, poster, hasAudio })), [
    {
      src: '/assets/cases/ai-promo-preview.mp4',
      role: 'preview',
      poster: '/assets/cases/ai-promo-poster.jpg',
      hasAudio: false,
    },
    {
      src: '/assets/cases/ai-promo-feature.mp4',
      role: 'full',
      poster: '/assets/cases/ai-promo-poster.jpg',
      hasAudio: false,
    },
  ]);
  assert.equal(caseStudies[1].approved, true);
  assert.equal(caseStudies[1].title, 'チラシのデザイン制作');
  assert.equal(caseStudies[1].role, '印刷依頼代行まで対応');
  assert.deepEqual(caseStudies[1].detail, {
    projectName: 'オフライン集客・成約率を最大化する販促チラシ／リーフレット制作・印刷代行',
    overview: 'ターゲット層や配布目的に合わせ、ペルソナ設計からキャッチコピー考案、ビジュアル作成、印刷所への入稿手配までを一貫して担当。標準的なA4片面・両面チラシはもちろん、情報量の多い3つ折りパンフレットなど、用途に応じた最適な判型・折り加工に幅広く対応しました。オフラインからオンラインへの動線構築も含めて設計・制作を行っています。',
    outcomesLabel: '効果',
    outcomes: [
      { title: '用途に合わせた最適フォーマットの提供', description: '卓上置き、ポスティング、対面手渡しなど、配布シーンに最も適した形状（両面・3つ折り等）を選択し、受取手の可読性・保存性を向上。' },
      { title: '事業主の負担軽減', description: '印刷会社ごとの仕様確認・トンボ付け・色調確認などの専門的な入稿工程を代行し、納品まで安心・スムーズに完了。' },
      { title: 'Web動線とのシームレスな統合', description: 'チラシ内のQRコードやキャンペーン導線を精緻に配置し、紙から自社Webサイトや公式LINEへの登録率向上に寄与。' },
    ],
  });
  assert.deepEqual(caseStudies[1].media, [{
    src: '/assets/cases/flyer-design-print.jpg',
    alt: 'コーヒー商品の両面チラシデザイン',
    kind: 'image',
    approved: true,
    approvedAt: '2026-09-05',
    width: 800,
    height: 565,
  }]);
  assert.equal(existsSync(new URL('../public/assets/cases/flyer-design-print.jpg', import.meta.url)), true);
  assert.ok(caseStudies.slice(2).every(({ approved, title, media }) => !approved && title === null && media.length === 0));
});

test('selected work keyboard contract opens accessible inline details instead of separate pages', () => {
  for (const key of ['ArrowRight', 'ArrowLeft', 'Home', 'End']) assert.match(selectedWorkSource, new RegExp(key));
  assert.match(selectedWorkSource, /role="list"/);
  assert.match(selectedWorkSource, /role="listitem"/);
  assert.match(selectedWorkSource, /data-work-trigger="true"/);
  assert.doesNotMatch(selectedWorkSource, /role="tab(?:list)?"/);
  assert.match(selectedWorkSource, /data-tab-group/);
  assert.match(selectedWorkSource, /aria-haspopup="dialog"/);
  assert.match(selectedWorkSource, /aria-expanded=\{expanded\}/);
  assert.match(selectedWorkSource, /createPortal\(/);
  assert.match(selectedWorkSource, /role="dialog"/);
  assert.match(selectedWorkSource, /aria-modal="true"/);
  assert.match(selectedWorkSource, /data-work-detail-overlay/);
  assert.match(selectedWorkSource, /data-work-image-role="preview"/);
  assert.match(selectedWorkSource, /data-work-feature-image/);
  assert.match(selectedWorkSource, /alt=\{featureImage\.alt\}/);
  assert.match(selectedWorkSource, /<dt>\{detail\.outcomesLabel\}：<\/dt>/);
  assert.match(selectedWorkStyles, /\.featureImage/);
  assert.match(selectedWorkSource, /data-expanded-case=\{caseStudy\.slug\}/);
  assert.match(selectedWorkSource, /event\.key === 'Escape'/);
  assert.match(selectedWorkSource, /event\.key !== 'Tab'/);
  assert.match(selectedWorkSource, /document\.body\.style\.overflow = 'hidden'/);
  assert.match(selectedWorkSource, /expansionTriggerRef\.current\?\.focus/);
  assert.doesNotMatch(selectedWorkSource, /href=\{`\/work\//);
  assert.match(selectedWorkSource, /max-width: 768px/);
  assert.match(selectedWorkStyles, /min-height: 4\.25rem/);
  assert.match(selectedWorkSource, /data-index=\{index\}/);
  assert.match(selectedWorkSource, /querySelector<HTMLButtonElement>\(`button\[data-tab-group=/);
  assert.match(selectedWorkSource, /focus\(\{ preventScroll: true \}\)/);
  assert.doesNotMatch(selectedWorkSource, /keyboardScrollLockRef/);
  assert.doesNotMatch(selectedWorkSource, /shouldHoldKeyboardSelection/);
  assert.match(selectedWorkSource, /HOVER TO SELECT \/ CLICK TO EXPAND/);
  assert.match(selectedWorkSource, /TAP TO EXPAND/);
});

test('client SelectedWork receives a safe projection with approved media only', () => {
  assert.doesNotMatch(selectedWorkSource, /from ['"]\.\.\/\.\.\/lib\/content/);
  assert.match(selectedWorkSource, /cases: readonly PublicCaseStudy\[\]/);
  assert.match(pageSource, /projectPublicCaseStudies\(caseStudies, publicBuild\)/);
  assert.match(pageSource, /workCases=\{workCases\}/);
  assert.match(homeSource, /workCases: readonly PublicCaseStudy\[\]/);
  assert.match(homeSource, /<SelectedWork cases=\{workCases\} \/>/);
  assert.doesNotMatch(publicProjectionSource, /from ['"]\.\.\/\.\.\/lib\/content/);
  assert.match(publicProjectionSource, /projectApprovedMedia/);
  assert.match(publicProjectionSource, /if \(!item\.approved\) return \[\]/);
  assert.match(publicProjectionSource, /media: projectApprovedMedia\(caseStudy\.media\)/);

  const draft = {
    ...caseStudies[0],
    approved: false,
    title: 'UNAPPROVED TITLE',
    industry: 'UNAPPROVED INDUSTRY',
    challenge: 'UNAPPROVED CHALLENGE',
    constraints: ['UNAPPROVED CONSTRAINT'],
    role: 'UNAPPROVED ROLE',
    detail: {
      projectName: 'UNAPPROVED PROJECT',
      overview: 'UNAPPROVED OVERVIEW',
      outcomes: [{ title: 'UNAPPROVED OUTCOME', description: 'UNAPPROVED DESCRIPTION' }],
    },
    technologies: ['UNAPPROVED TECH'],
    media: [{
      src: '/assets/cases/private.mp4',
      alt: 'UNAPPROVED MEDIA',
      kind: 'video',
      role: 'preview',
      approved: true,
      approvedAt: '2026-08-25',
      poster: '/assets/cases/private-poster.png',
      hasAudio: false,
      captionsSrc: null,
    }],
  };
  const redacted = projectPublicCaseStudies([draft], true)[0];
  assert.equal(redacted.approved, false);
  assert.equal(Array.isArray(redacted.media), true);
  assert.deepEqual(redacted.media, []);
  assert.equal(redacted.title, null);
  assert.equal(redacted.challenge, null);
  assert.equal(redacted.detail, null);
  assert.equal('constraints' in redacted, false);
  assert.equal('technologies' in redacted, false);
  assert.equal('media' in redacted, true);
  assert.doesNotMatch(JSON.stringify(redacted), /UNAPPROVED|private\.mp4/i);

  const approved = projectPublicCaseStudies([{
    ...draft,
    approved: true,
    title: 'Approved case',
    challenge: 'Approved challenge',
    media: draft.media,
  }], true)[0];
  assert.equal(approved.approved, true);
  assert.equal(Array.isArray(approved.media), true);
  assert.equal(approved.title, 'Approved case');
  assert.equal(approved.detail?.projectName, 'UNAPPROVED PROJECT');
  assert.deepEqual(approved.detail?.outcomes, [
    { title: 'UNAPPROVED OUTCOME', description: 'UNAPPROVED DESCRIPTION' },
  ]);
  assert.equal('constraints' in approved, false);
  assert.equal(approved.media.length, 1);
  assert.deepEqual(approved.media[0], {
    src: '/assets/cases/private.mp4',
    alt: 'UNAPPROVED MEDIA',
    kind: 'video',
    role: 'preview',
    poster: '/assets/cases/private-poster.png',
    hasAudio: false,
    captionsSrc: null,
  });

  const approvedPreview = projectPublicCaseStudies([{
    ...draft,
    approved: true,
    title: 'Approved case',
    challenge: 'Approved challenge',
    media: [],
  }], false)[0];
  assert.equal(approvedPreview.approved, true);
  assert.equal(Array.isArray(approvedPreview.media), true);
  assert.equal(approvedPreview.title, 'Approved case');
  assert.deepEqual(approvedPreview.media, []);

  const mixedMedia = projectPublicCaseStudies([{
    ...draft,
    approved: true,
    title: 'Approved case',
    media: [
      ...draft.media,
      {
        src: '/assets/cases/secret.mp4',
        alt: 'PRIVATE MEDIA',
        kind: 'video',
        role: 'full',
        approved: false,
        approvedAt: '2026-08-25',
        poster: '/assets/cases/secret-poster.png',
        hasAudio: false,
        captionsSrc: null,
      },
    ],
  }], true)[0];
  assert.equal(mixedMedia.media.length, 1);
  assert.doesNotMatch(JSON.stringify(mixedMedia), /secret\.mp4|PRIVATE MEDIA/i);
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
  assert.match(selectedWorkSource, /querySelectorAll<HTMLElement>\('button'\)/);
  assert.match(selectedWorkSource, /setDesktopCardListReady\(desktopCardList, orbitReady\)/);
  assert.doesNotMatch(selectedWorkSource, /getBurstProgress|card-burst-progress|dataset\.burstReady/);
  assert.doesNotMatch(selectedWorkSource, /getActiveCaseIndex/);
  const scatterSource = selectedWorkSource.slice(
    selectedWorkSource.indexOf('function updateScatterFromScroll'),
    selectedWorkSource.indexOf('function CaseCard'),
  );
  assert.doesNotMatch(scatterSource, /stage\.getBoundingClientRect\(\)/);
  assert.doesNotMatch(scatterSource, /setActive|handleSelect/);
  assert.match(selectedWorkSource, /className=\{styles\.stageVisual\}/);
  assert.match(selectedWorkSource, /function ExpandedCaseDialog/);
  assert.match(selectedWorkSource, /className=\{styles\.expandedVisual\}/);
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
  assert.match(selectedWorkStyles, /\.cardExpandIcon[\s\S]*height: 2\.8rem[\s\S]*width: 2\.8rem/);
  assert.match(selectedWorkStyles, /\.cardExpandIcon::before[\s\S]*transform: scale\(0\.55\)/);
  assert.match(selectedWorkStyles, /\.cardExpandIcon > span[\s\S]*transform: scale\(0\.55\)/);
  assert.match(selectedWorkStyles, /\.detailOverlay[\s\S]*position: fixed[\s\S]*z-index: 10000/);
  assert.match(selectedWorkStyles, /\.expandedCard[\s\S]*height: min\(86svh, 47rem\)[\s\S]*width: min\(92vw, 34rem\)/);
  assert.match(selectedWorkStyles, /\.expandedClose[\s\S]*min-height: 2\.75rem[\s\S]*min-width: 2\.75rem/);
  assert.match(selectedWorkStyles, /\.expandedScan[\s\S]*animation: expandedCardScan/);
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
  assert.match(selectedWorkStyles, /prefers-reduced-motion: reduce\)[\s\S]*\.expandedScan[\s\S]*animation: none/);
});

test('selected work video roles attach only at the right interaction boundary', () => {
  const featureSource = selectedWorkSource.slice(
    selectedWorkSource.indexOf('function CaseFeatureVideo'),
    selectedWorkSource.indexOf('\nfunction clampIndex'),
  );
  assert.match(selectedWorkSource, /function getVideoMedia/);
  assert.match(selectedWorkSource, /role: PublicCaseStudyVideoMedia\['role'\]/);
  assert.match(selectedWorkSource, /function CasePreviewVideo/);
  assert.match(selectedWorkSource, /IntersectionObserver/);
  assert.match(selectedWorkSource, /element\.src = video\.src/);
  assert.match(selectedWorkSource, /element\.load\(\)/);
  assert.match(selectedWorkSource, /if \(entry\?\.isIntersecting\) attachAndPlay\(\)/);
  assert.match(selectedWorkSource, /else element\.pause\(\)/);
  assert.match(selectedWorkSource, /autoPlay=\{!reduceMotion\}/);
  assert.match(selectedWorkSource, /muted/);
  assert.match(selectedWorkSource, /loop/);
  assert.match(selectedWorkSource, /playsInline/);
  assert.match(selectedWorkSource, /function CaseFeatureVideo/);
  assert.match(featureSource, /reduceMotion: boolean/);
  assert.match(featureSource, /element\.src = video\.src/);
  assert.match(featureSource, /element\.load\(\)/);
  assert.match(featureSource, /if \(!reduceMotion\) \{[\s\S]*void element\.play\(\)\.catch\(\(\) => undefined\)/);
  assert.match(featureSource, /autoPlay=\{!reduceMotion\}/);
  assert.match(featureSource, /muted/);
  assert.match(featureSource, /loop/);
  assert.match(featureSource, /playsInline/);
  assert.match(featureSource, /releaseLoadedVideo\(element\)/);
  assert.match(selectedWorkSource, /data-work-feature-video/);
  assert.doesNotMatch(featureSource, /\scontrols(?:\s|=|>)/);
  assert.match(featureSource, /data-work-feature-video-shell/);
  assert.match(featureSource, /data-work-feature-playback/);
  assert.match(featureSource, /playbackFeedback/);
  assert.match(featureSource, /showPlaybackFeedback\('play'\)/);
  assert.match(featureSource, /showPlaybackFeedback\('pause'\)/);
  assert.match(featureSource, /window\.setTimeout/);
  assert.match(featureSource, /data-playback-feedback=\{playbackFeedback\}/);
  assert.match(featureSource, /aria-label=\{isPlaying \? `\$\{video\.alt\}を一時停止` : `\$\{video\.alt\}を再生`\}/);
  assert.match(featureSource, /onPointerDown=\{\(\) => \{[\s\S]*pointerActivatedAtRef\.current = Date\.now\(\)/);
  assert.match(featureSource, /const isPointerActivation = event\.detail > 0[\s\S]*event\.currentTarget\.blur\(\)/);
  assert.match(featureSource, /if \(element\.paused\)/);
  assert.match(featureSource, /element\.pause\(\)/);
  assert.doesNotMatch(featureSource, />PAUSE</);
  assert.doesNotMatch(featureSource, />PLAY</);
  assert.match(selectedWorkSource, /releaseLoadedVideo\(featureVideoRef\.current\)/);
  assert.match(selectedWorkSource, /video\.removeAttribute\('src'\)/);
  assert.match(selectedWorkSource, /className=\{styles\.featureVideo\}/);
  assert.match(selectedWorkSource, /data-work-feature-frame/);
  assert.match(selectedWorkStyles, /\.cardMediaVideo[\s\S]*object-fit: cover/);
  assert.match(selectedWorkStyles, /\.expandedMediaFrame[\s\S]*aspect-ratio: 16 \/ 9/);
  assert.match(selectedWorkStyles, /\.featureVideo[\s\S]*object-fit: cover/);
  assert.match(selectedWorkStyles, /\.featurePlaybackSurface[\s\S]*inset: 0/);
  assert.match(selectedWorkStyles, /\.featurePlaybackIndicator[\s\S]*border-radius: 50%/);
  assert.match(selectedWorkStyles, /grid-template-rows: auto minmax\(19\.25rem, 0\.95fr\)/);
  assert.match(selectedWorkStyles, /grid-template-rows: auto minmax\(13rem, 0\.7fr\)/);
  assert.match(selectedWorkStyles, /\.mobileMediaVideo/);
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

test('inline expanded cards replace the removed case-study routes', () => {
  assert.equal(existsSync(new URL('../app/work/[slug]/page.tsx', import.meta.url)), false);
  assert.equal(existsSync(new URL('../app/components/work/work-detail.module.css', import.meta.url)), false);
  assert.equal(existsSync(new URL('../app/components/work/work-metadata.ts', import.meta.url)), false);
  assert.doesNotMatch(selectedWorkSource, /\/work\//);
  assert.doesNotMatch(selectedWorkSource, /href=/);
  assert.doesNotMatch(sitemapSource, /caseStudies|\/work\//);
  assert.match(selectedWorkSource, /const summaryRows[\s\S]*label: '課題'[\s\S]*label: '担当'[\s\S]*label: '成果'/);
  assert.doesNotMatch(selectedWorkSource, /公開承認済みの実績内容を簡潔に表示しています。/);
  assert.match(selectedWorkSource, /<dt>プロジェクト名：<\/dt>/);
  assert.match(selectedWorkSource, /<dt>概要：<\/dt>/);
  assert.match(selectedWorkSource, /<dt>\{detail\.outcomesLabel\}：<\/dt>/);
  assert.match(selectedWorkSource, /detail\.outcomes\.map/);
  assert.match(selectedWorkStyles, /\.expandedDetail/);
  assert.match(selectedWorkStyles, /\.expandedOutcomes/);
  assert.match(selectedWorkSource, /caseStudy\.approved \? \([\s\S]*className=\{styles\.expandedFacts\}/);
  assert.match(selectedWorkSource, /\['課題', '担当', '成果'\][\s\S]*公開承認後に反映/);
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

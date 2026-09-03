import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { caseStudies, siteContent } from '../app/lib/content.ts';
import { validateProductionContent } from '../app/lib/content-gate.ts';

const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

const productionEnv = {
  SITE_ORIGIN: 'https://crelo.example',
  CONTACT_TO_EMAIL: 'inbox@crelo.example',
  CONTACT_FROM_EMAIL: 'no-reply@crelo.example',
  RESEND_API_KEY: 'secret',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key',
  TURNSTILE_SECRET_KEY: 'secret-key',
  CONTACT_HASH_SECRET: '0123456789abcdef0123456789abcdef',
};

const approvedContent = {
  profile: {
    name: '公開プロフィール',
    portraitSrc: '/assets/profile/profile.png',
    portraitAlt: 'プロフィール写真',
    career: 'Forward Deployed Engineer',
    approved: true,
    approvedAt: '2026-08-25',
  },
  privacy: {
    operator: 'Crelo / 公開運用主体',
    version: '2026-08-25.1',
    effectiveDate: '2026-08-25',
    collectedItems: ['氏名、会社名、メールアドレス、相談内容'],
    purposes: ['問い合わせへの回答と相談対応'],
    retentionPeriod: '対応終了から90日後に削除',
    processors: 'Resend（メール配送）を利用し、委託先にも同等の管理を求めます',
    overseasTransfer: '国外移転はありません。発生時は事前に扱いを明記します',
    rightsContact: 'privacy@crelo.example',
  },
  contactEmail: 'contact@crelo.example',
};

function approvedRecords() {
  return caseStudies.map((item, index) => ({
    ...item,
    displayOrder: index + 1,
    title: `公開ケース ${index + 1}`,
    industry: 'ソフトウェア',
    periodLabel: '2026年度',
    challenge: '公開可能な課題の説明',
    role: 'FDEとして設計と導入を担当',
    discovery: '関係者と課題を整理',
    design: '実装方針を設計',
    implementation: '検証可能な形で実装',
    rollout: '運用チームへ導入',
    qualitativeOutcome: '意思決定と運用の流れを整理',
    constraints: ['公開可能な制約'],
    technologies: ['TypeScript'],
    tags: ['FDE'],
    approved: true,
    approvedAt: '2026-08-25',
  }));
}

test('provides one explicitly approved video case and four stable private preview slots', () => {
  assert.equal(caseStudies.length, 5);
  assert.equal(new Set(caseStudies.map((item) => item.slug)).size, 5);
  assert.deepEqual(caseStudies.map((item) => item.displayOrder), [1, 2, 3, 4, 5]);
  assert.equal(caseStudies[0].approved, true);
  assert.equal(caseStudies[0].title, '宣伝動画の制作');
  assert.equal(caseStudies[0].role, 'AIを用いた動画の作成');
  assert.deepEqual(caseStudies[0].media.map((item) => item.kind === 'video' ? item.role : null), ['preview', 'full']);
  assert.deepEqual(caseStudies[0].media.map((item) => item.src), [
    '/assets/cases/ai-promo-preview.mp4',
    '/assets/cases/ai-promo-feature.mp4',
  ]);
  for (const item of caseStudies.slice(1)) {
    assert.equal(item.approved, false);
    assert.equal(item.title, null);
    assert.deepEqual(item.media, []);
  }
});

test('preview data fails production gate with explicit reasons', () => {
  const result = validateProductionContent(caseStudies, siteContent, productionEnv);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('approved must be true')));
  assert.ok(result.errors.every((error) => !error.includes('profile.name is missing')));
  assert.ok(result.errors.some((error) => error.includes('privacy.operator is missing')));
  assert.ok(result.errors.some((error) => error.includes('contactEmail is missing or invalid')));
});

test('production build script cannot bypass the content and asset gate', () => {
  assert.equal(packageJson.scripts.prebuild, 'node --experimental-strip-types scripts/validate-content.ts');
  assert.equal(packageJson.scripts['build:production'], 'CONTENT_MODE=production npm run build');
  assert.match(packageJson.scripts['validate:content'], /scripts\/validate-content\.ts/);
});

test('production gate catches duplicate slugs, placeholders, missing alt, and env gaps', () => {
  const draft = structuredClone(caseStudies);
  draft[0] = {
    ...draft[0],
    title: 'TITLE TBD',
    industry: 'industry',
    periodLabel: 'period',
    challenge: 'challenge',
    role: 'role',
    discovery: 'discovery',
    design: 'design',
    implementation: 'implementation',
    rollout: 'rollout',
    qualitativeOutcome: 'outcome',
    constraints: ['constraint'],
    technologies: ['technology'],
    tags: ['tag'],
    approved: true,
    approvedAt: '2026-08-25',
    media: [{ src: '/assets/cases/case.png', alt: '', kind: 'image', approved: false, approvedAt: '2026-01-01', width: 1200, height: 630 }],
  };
  draft[1] = { ...draft[1], slug: draft[0].slug };
  const result = validateProductionContent(draft, siteContent, { ...productionEnv, SITE_ORIGIN: '' });
  assert.ok(result.errors.some((error) => error.includes('slugs must be unique')));
  assert.ok(result.errors.some((error) => error.includes('contains placeholder content')));
  assert.ok(result.errors.some((error) => error.includes('media[0].alt is missing')));
  assert.ok(result.errors.some((error) => error === 'SITE_ORIGIN is missing'));

  const invalidApprovalDate = approvedRecords();
  invalidApprovalDate[0].approvedAt = '2026-02-30';
  const approvalDateResult = validateProductionContent(invalidApprovalDate, approvedContent, productionEnv);
  assert.ok(approvalDateResult.errors.includes('caseStudies[0](field-signal).approvedAt must be a valid YYYY-MM-DD date'));
});

test('production gate rejects ASCII and full-width quantitative outcomes but permits period labels', () => {
  const ascii = approvedRecords();
  ascii[0].qualitativeOutcome = '売上30%増を達成';
  const asciiResult = validateProductionContent(ascii, approvedContent, productionEnv);
  assert.ok(asciiResult.errors.some((error) => error.includes('qualitativeOutcome contains quantitative KPI')));

  const fullWidth = approvedRecords();
  fullWidth[0].qualitativeOutcome = 'コスト３００万円削減';
  const fullWidthResult = validateProductionContent(fullWidth, approvedContent, productionEnv);
  assert.ok(fullWidthResult.errors.some((error) => error.includes('qualitativeOutcome contains quantitative KPI')));

  const periodOnly = approvedRecords();
  periodOnly[0].periodLabel = '2026年度';
  const periodResult = validateProductionContent(periodOnly, approvedContent, productionEnv);
  assert.equal(periodResult.errors.some((error) => error.includes('qualitativeOutcome contains quantitative KPI')), false);
});

test('production gate validates SITE_ORIGIN scheme and HTTPS policy', () => {
  const records = approvedRecords();
  const invalidScheme = validateProductionContent(
    records,
    approvedContent,
    { ...productionEnv, SITE_ORIGIN: 'ftp://crelo.example' },
  );
  assert.ok(invalidScheme.errors.some((error) => error === 'SITE_ORIGIN must use http or https'));

  const insecureProduction = validateProductionContent(
    records,
    approvedContent,
    { ...productionEnv, SITE_ORIGIN: 'http://crelo.example' },
    { requireHttps: true },
  );
  assert.ok(insecureProduction.errors.some((error) => error.includes('SITE_ORIGIN must use https in production')));

  const pathOrigin = validateProductionContent(
    records,
    approvedContent,
    { ...productionEnv, SITE_ORIGIN: 'https://crelo.example/portfolio?preview=1#top' },
  );
  assert.ok(pathOrigin.errors.some((error) => error === 'SITE_ORIGIN must be an origin without a path, query, or fragment'));

  const localhost = validateProductionContent(
    records,
    approvedContent,
    { ...productionEnv, SITE_ORIGIN: 'http://localhost:3010' },
    { requireHttps: true },
  );
  assert.equal(localhost.ok, true);

  const weakSecret = validateProductionContent(
    records,
    approvedContent,
    { ...productionEnv, CONTACT_HASH_SECRET: 'too-short' },
  );
  assert.ok(weakSecret.errors.some((error) => error === 'CONTACT_HASH_SECRET must be at least 32 characters'));
});

test('production gate requires approved profile photo and operational privacy facts', () => {
  const missingApproval = structuredClone(approvedContent);
  missingApproval.profile.approved = false;
  missingApproval.profile.approvedAt = 'not-a-date';
  const profileResult = validateProductionContent(approvedRecords(), missingApproval, productionEnv);
  assert.ok(profileResult.errors.includes('profile.approved must be true'));
  assert.ok(profileResult.errors.includes('profile.approvedAt must be a valid YYYY-MM-DD date'));

  const invalidPrivacy = structuredClone(approvedContent);
  invalidPrivacy.privacy = {
    ...invalidPrivacy.privacy,
    operator: '未提供',
    effectiveDate: '2026-02-30',
    collectedItems: [],
    purposes: ['TODO'],
    processors: '未提供',
    overseasTransfer: '未提供',
    rightsContact: 'privacy@example.com',
  };
  const privacyResult = validateProductionContent(approvedRecords(), invalidPrivacy, productionEnv);
  assert.ok(privacyResult.errors.includes('privacy.operator contains placeholder content'));
  assert.ok(privacyResult.errors.includes('privacy.effectiveDate must be a valid YYYY-MM-DD date'));
  assert.ok(privacyResult.errors.includes('privacy.collectedItems must contain at least one approved item'));
  assert.ok(privacyResult.errors.includes('privacy.purposes[0] contains placeholder content'));
  assert.ok(privacyResult.errors.includes('privacy.processors contains placeholder content'));
  assert.ok(privacyResult.errors.includes('privacy.overseasTransfer contains placeholder content'));
  assert.ok(privacyResult.errors.includes('privacy.rightsContact contains placeholder content'));

  const externalPortrait = structuredClone(approvedContent);
  externalPortrait.profile.portraitSrc = 'https://cdn.example/profile.png';
  const portraitResult = validateProductionContent(approvedRecords(), externalPortrait, productionEnv);
  assert.ok(portraitResult.errors.includes('profile.portraitSrc must be a local /assets/profile/ path'));
});

test('production gate requires safe approved media metadata and local asset paths', () => {
  const externalImage = approvedRecords();
  externalImage[0].media = [{
    src: 'https://cdn.example/case.png',
    alt: '公開ケース画像',
    kind: 'image',
    approved: true,
    approvedAt: '2026-08-25',
    width: 1200,
    height: 630,
  }];
  const externalResult = validateProductionContent(externalImage, approvedContent, productionEnv);
  assert.ok(externalResult.errors.includes('caseStudies[0](field-signal).media[0].src must be a local /assets/cases/ path'));

  const invalidImageExtension = approvedRecords();
  invalidImageExtension[0].media = [{
    src: '/assets/cases/case.exe',
    alt: '公開ケース画像',
    kind: 'image',
    approved: true,
    approvedAt: '2026-08-25',
    width: 1200,
    height: 630,
  }];
  const invalidImageExtensionResult = validateProductionContent(invalidImageExtension, approvedContent, productionEnv);
  assert.ok(invalidImageExtensionResult.errors.some((error) => error.includes('src must use an allowed image asset extension')));

  const traversal = approvedRecords();
  traversal[0].media = [{
    src: '/assets/cases/../private.png',
    alt: '公開ケース画像',
    kind: 'image',
    approved: true,
    approvedAt: '2026-08-25',
    width: 1200,
    height: 630,
  }];
  const traversalResult = validateProductionContent(traversal, approvedContent, productionEnv);
  assert.ok(traversalResult.errors.some((error) => error.includes('src must be a local /assets/cases/ path')));

  const invalidDimensions = approvedRecords();
  invalidDimensions[0].media = [{
    src: '/assets/cases/case.png',
    alt: '公開ケース画像',
    kind: 'image',
    approved: true,
    approvedAt: '2026-08-25',
    width: 0,
    height: 630.5,
  }];
  const dimensionsResult = validateProductionContent(invalidDimensions, approvedContent, productionEnv);
  assert.ok(dimensionsResult.errors.some((error) => error.includes('width must be a positive integer')));
  assert.ok(dimensionsResult.errors.some((error) => error.includes('height must be a positive integer')));

  const audioVideo = approvedRecords();
  audioVideo[0].media = [{
    src: '/assets/cases/demo.mp4',
    alt: '公開ケース動画',
    kind: 'video',
    role: 'full',
    approved: true,
    approvedAt: '2026-08-25',
    poster: '/assets/cases/demo-poster.png',
    hasAudio: true,
    captionsSrc: null,
  }];
  const audioVideoResult = validateProductionContent(audioVideo, approvedContent, productionEnv);
  assert.ok(audioVideoResult.errors.some((error) => error.includes('captionsSrc is required when video has audio')));

  const unsafeCaptions = approvedRecords();
  unsafeCaptions[0].media = [{
    src: '/assets/cases/demo.mp4',
    alt: '公開ケース動画',
    kind: 'video',
    role: 'full',
    approved: true,
    approvedAt: '2026-08-25',
    poster: '/assets/cases/demo-poster.png',
    hasAudio: false,
    captionsSrc: 'https://cdn.example/demo.vtt',
  }];
  const captionsResult = validateProductionContent(unsafeCaptions, approvedContent, productionEnv);
  assert.ok(captionsResult.errors.some((error) => error.includes('captionsSrc must be a local /assets/cases/ path')));

  const invalidVideoTypes = approvedRecords();
  invalidVideoTypes[0].media = [{
    src: '/assets/cases/demo.png',
    alt: '公開ケース動画',
    kind: 'video',
    role: 'full',
    approved: true,
    approvedAt: '2026-08-25',
    poster: '/assets/cases/demo.mp4',
    hasAudio: true,
    captionsSrc: '/assets/cases/demo.txt',
  }];
  const invalidVideoTypesResult = validateProductionContent(invalidVideoTypes, approvedContent, productionEnv);
  assert.ok(invalidVideoTypesResult.errors.some((error) => error.includes('src must use an allowed video asset extension')));
  assert.ok(invalidVideoTypesResult.errors.some((error) => error.includes('poster must use an allowed image asset extension')));
  assert.ok(invalidVideoTypesResult.errors.some((error) => error.includes('captionsSrc must use an allowed captions asset extension')));

  const invalidPortraitExtension = structuredClone(approvedContent);
  invalidPortraitExtension.profile.portraitSrc = '/assets/profile/profile.exe';
  const invalidPortraitExtensionResult = validateProductionContent(approvedRecords(), invalidPortraitExtension, productionEnv);
  assert.ok(invalidPortraitExtensionResult.errors.some((error) => error.includes('profile.portraitSrc must use an allowed image asset extension')));
});

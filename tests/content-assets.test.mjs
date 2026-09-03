import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { caseStudies, siteContent } from '../app/lib/content.ts';
import { validatePublicContentAssets } from '../scripts/validate-public-assets.ts';

const contentValidationSource = await readFile(new URL('../scripts/validate-content.ts', import.meta.url), 'utf8');

function approvedRecords() {
  return caseStudies.map((caseStudy, index) => ({
    ...caseStudy,
    title: `公開ケース ${index + 1}`,
    industry: 'ソフトウェア',
    periodLabel: '2026年度',
    challenge: '公開可能な課題',
    role: 'FDEとして担当',
    discovery: '課題を整理',
    design: '設計',
    implementation: '実装',
    rollout: '導入',
    qualitativeOutcome: '運用を整理',
    constraints: ['公開可能な制約'],
    technologies: ['TypeScript'],
    tags: ['FDE'],
    approved: true,
    approvedAt: '2026-08-25',
  }));
}

function approvedContent() {
  return {
    ...siteContent,
    profile: {
      name: '公開プロフィール',
      portraitSrc: '/assets/profile/person.png',
      portraitAlt: 'プロフィール写真',
      career: 'Forward Deployed Engineer',
      approved: true,
      approvedAt: '2026-08-25',
    },
  };
}

test('build asset gate accepts regular local image/video/caption files', async () => {
  const publicRoot = await mkdtemp(join(tmpdir(), 'crelo-public-'));
  try {
    await mkdir(join(publicRoot, 'assets', 'profile'), { recursive: true });
    await mkdir(join(publicRoot, 'assets', 'cases'), { recursive: true });
    await writeFile(join(publicRoot, 'assets', 'profile', 'person.png'), 'profile');
    await writeFile(join(publicRoot, 'assets', 'cases', 'case.webp'), 'image');
    await writeFile(join(publicRoot, 'assets', 'cases', 'demo.webm'), 'video');
    await writeFile(join(publicRoot, 'assets', 'cases', 'demo-poster.jpg'), 'poster');
    await writeFile(join(publicRoot, 'assets', 'cases', 'demo.vtt'), 'WEBVTT');

    const records = approvedRecords();
    records[0].media = [
      {
        src: '/assets/cases/case.webp',
        alt: '公開ケース画像',
        kind: 'image',
        approved: true,
        approvedAt: '2026-08-25',
        width: 1200,
        height: 630,
      },
      {
        src: '/assets/cases/demo.webm',
        alt: '公開ケース動画',
        kind: 'video',
        role: 'full',
        approved: true,
        approvedAt: '2026-08-25',
        poster: '/assets/cases/demo-poster.jpg',
        hasAudio: true,
        captionsSrc: '/assets/cases/demo.vtt',
      },
    ];
    assert.deepEqual(validatePublicContentAssets(records, approvedContent(), publicRoot), { ok: true, errors: [] });
  } finally {
    await rm(publicRoot, { recursive: true, force: true });
  }
});

test('preview builds validate approved assets without requiring all five cases', () => {
  assert.match(contentValidationSource, /const approvedPreviewCases = caseStudies\.filter\(\(caseStudy\) => caseStudy\.approved\)/);
  assert.match(contentValidationSource, /validatePublicContentAssets\(approvedPreviewCases, siteContent/);
  assert.match(contentValidationSource, /PREVIEW_ASSET_GATE_FAILED/);
  assert.match(contentValidationSource, /unapproved case-study slots remain redacted/);
});

test('build asset gate rejects missing files and directories masquerading as files', async () => {
  const publicRoot = await mkdtemp(join(tmpdir(), 'crelo-public-'));
  try {
    await mkdir(join(publicRoot, 'assets', 'profile'), { recursive: true });
    await mkdir(join(publicRoot, 'assets', 'cases', 'case.png'), { recursive: true });
    const records = approvedRecords();
    records[0].media = [{
      src: '/assets/cases/missing.webp',
      alt: '公開ケース画像',
      kind: 'image',
      approved: true,
      approvedAt: '2026-08-25',
      width: 1200,
      height: 630,
    }];
    const missing = validatePublicContentAssets(records, approvedContent(), publicRoot);
    assert.ok(missing.errors.some((error) => error.includes('caseStudies[field-signal].media[0].src file does not exist')));

    records[0].media[0].src = '/assets/cases/case.png';
    const directory = validatePublicContentAssets(records, approvedContent(), publicRoot);
    assert.ok(directory.errors.some((error) => error.includes('must resolve to a regular file')));
  } finally {
    await rm(publicRoot, { recursive: true, force: true });
  }
});

test('build asset gate rejects paths outside their designated public directory', async () => {
  const publicRoot = await mkdtemp(join(tmpdir(), 'crelo-public-'));
  try {
    const records = approvedRecords();
    records[0].media = [{
      src: '/assets/cases/../private.webp',
      alt: '公開ケース画像',
      kind: 'image',
      approved: true,
      approvedAt: '2026-08-25',
      width: 1200,
      height: 630,
    }];
    const outside = validatePublicContentAssets(records, approvedContent(), publicRoot);
    assert.ok(outside.errors.some((error) => error.includes('resolves outside public/assets/cases')));
  } finally {
    await rm(publicRoot, { recursive: true, force: true });
  }
});

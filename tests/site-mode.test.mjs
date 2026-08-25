import assert from 'node:assert/strict';
import test from 'node:test';

import { projectProfileForClient } from '../app/components/site/profile-projection.ts';
import { getSiteModeCopy } from '../app/components/site/site-mode.ts';

test('public UI mode contains no preview or pending labels', () => {
  const copy = getSiteModeCopy(true);
  const renderedLabels = Object.values(copy).join(' ');
  assert.doesNotMatch(renderedLabels, /PREVIEW|PENDING|TO BE CONFIRMED/i);
  assert.match(renderedLabels, /PUBLIC/);
});

test('preview UI mode remains explicit about unpublished state', () => {
  const copy = getSiteModeCopy(false);
  assert.match(Object.values(copy).join(' '), /PREVIEW|PENDING|TO BE CONFIRMED/i);
});

test('preview profile projection strips unapproved identity drafts before serialization', () => {
  const draft = {
    name: 'UNAPPROVED NAME',
    portraitSrc: '/private/draft.jpg',
    portraitAlt: 'UNAPPROVED PORTRAIT',
    career: 'UNAPPROVED CAREER',
    approved: false,
    approvedAt: null,
  };
  const projected = projectProfileForClient(draft, false);
  assert.deepEqual(projected, {
    name: null,
    portraitSrc: null,
    portraitAlt: null,
    career: null,
    approved: false,
    approvedAt: null,
  });
  assert.doesNotMatch(JSON.stringify(projected), /UNAPPROVED|draft\.jpg/);
});

test('public profile projection preserves only approved identity content', () => {
  const approved = {
    name: 'Approved identity',
    portraitSrc: '/profile/approved.webp',
    portraitAlt: 'Approved identity portrait',
    career: 'Forward Deployed Engineer',
    approved: true,
    approvedAt: '2026-08-25',
  };
  assert.deepEqual(projectProfileForClient(approved, true), approved);
});

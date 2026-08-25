import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  CONTACT_DUPLICATE_WINDOW_MS,
  CONTACT_RATE_WINDOW_MS,
  hasRecentContactDuplicate,
  isContactRateLimited,
  classifyContactConflict,
} from '../db/contact-store.ts';

test('classifies token uniqueness races as token_reused before fingerprint duplicates', () => {
  assert.deepEqual(classifyContactConflict({ tokenExists: true, fingerprintExists: true }), {
    kind: 'token_reused',
  });
  assert.deepEqual(classifyContactConflict({ tokenExists: true, fingerprintExists: false }), {
    kind: 'token_reused',
  });
  assert.deepEqual(classifyContactConflict({ tokenExists: false, fingerprintExists: true }), {
    kind: 'duplicate',
  });
  assert.equal(classifyContactConflict({ tokenExists: false, fingerprintExists: false }), undefined);
});

test('keeps fingerprint reusable after the duplicate window by avoiding a unique index', async () => {
  const source = await readFile(new URL('../db/schema.ts', import.meta.url), 'utf8');
  assert.match(source, /fingerprintIndex:\s*index\(/);
  assert.doesNotMatch(source, /fingerprintIndex:\s*uniqueIndex\(/);
});

test('applies duplicate status/window and rate-limit policies with real time boundaries', () => {
  const now = 10_000_000;
  for (const status of ['sent', 'rejected', 'pending', 'failed']) {
    assert.equal(
      hasRecentContactDuplicate(
        [{ status, createdAt: now - CONTACT_DUPLICATE_WINDOW_MS - 1 }],
        now,
      ),
      false,
      `${status} is reusable after the duplicate window`,
    );
    assert.equal(
      hasRecentContactDuplicate(
        [{ status, createdAt: now - CONTACT_DUPLICATE_WINDOW_MS }],
        now,
      ),
      true,
      `${status} is a duplicate at the inclusive boundary`,
    );
    assert.equal(
      hasRecentContactDuplicate([{ status, createdAt: now - 1 }], now),
      true,
      `${status} is a duplicate inside the window`,
    );
  }
  assert.equal(
    hasRecentContactDuplicate([{ status: 'sent', createdAt: now + 1 }], now),
    false,
    'future timestamps are not treated as a duplicate',
  );

  const withinWindow = Array.from({ length: 5 }, (_, index) => ({
    createdAt: now - index * 1_000,
  }));
  assert.equal(isContactRateLimited(withinWindow, now), true);
  assert.equal(isContactRateLimited(withinWindow.slice(0, 4), now), false);
  assert.equal(
    isContactRateLimited(
      [...withinWindow.slice(0, 4), { createdAt: now - CONTACT_RATE_WINDOW_MS - 1 }],
      now,
    ),
    false,
  );
});

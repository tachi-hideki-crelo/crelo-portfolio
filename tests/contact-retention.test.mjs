import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTACT_METADATA_RETENTION_MS,
  contactMetadataCutoff,
  pruneContactMetadata,
} from '../db/contact-retention.ts';

test('contact metadata cutoff is exactly 30 days before a valid job time', () => {
  const now = Date.UTC(2026, 9, 4, 3);
  assert.equal(contactMetadataCutoff(now), now - CONTACT_METADATA_RETENTION_MS);
  assert.throws(() => contactMetadataCutoff(Number.NaN), RangeError);
  assert.throws(() => contactMetadataCutoff(-1), RangeError);
});

test('retention job deletes only metadata older than the cutoff', async () => {
  const now = Date.UTC(2026, 9, 4, 3);
  const calls = [];
  const database = {
    prepare(query) {
      calls.push(['prepare', query]);
      return {
        bind(value) {
          calls.push(['bind', value]);
          return {
            async run() {
              calls.push(['run']);
            },
          };
        },
      };
    },
  };
  await pruneContactMetadata(database, now);
  assert.deepEqual(calls, [
    ['prepare', 'DELETE FROM contact_requests WHERE created_at < ?'],
    ['bind', now - CONTACT_METADATA_RETENTION_MS],
    ['run'],
  ]);
});

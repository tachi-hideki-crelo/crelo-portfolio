import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  CONTACT_METADATA_RETENTION_MS,
  contactMetadataCutoff,
  pruneContactMetadata,
} from '../db/contact-retention.ts';

function makeD1Result({ success = true, changes = 0 } = {}) {
  return {
    results: [],
    success,
    meta: {
      duration: 0,
      size_after: 0,
      rows_read: 0,
      rows_written: changes,
      last_row_id: 0,
      changed_db: changes > 0,
      changes,
    },
  };
}

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
              return makeD1Result({ changes: 1 });
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
    ['prepare', 'DELETE FROM contact_turnstile_rate_limits WHERE expires_at <= ?'],
    ['bind', now],
    ['run'],
  ]);
});

test('retention job accepts zero and positive integer D1 change counts', async () => {
  const now = Date.UTC(2026, 9, 4, 3);
  let runCount = 0;
  const database = {
    prepare() {
      return {
        bind() {
          return {
            async run() {
              runCount += 1;
              return makeD1Result({ changes: runCount === 1 ? 0 : 1 });
            },
          };
        },
      };
    },
  };

  await assert.doesNotReject(() => pruneContactMetadata(database, now));
  assert.equal(runCount, 2);
});

test('retention job rejects failed or incomplete D1 results without leaking provider details', async () => {
  const now = Date.UTC(2026, 9, 4, 3);
  const cases = [
    {
      name: 'first delete reports failure',
      outcomes: [makeD1Result({ success: false })],
      expectedRuns: 1,
    },
    {
      name: 'first delete reports an incomplete result',
      outcomes: [{ success: true, results: [] }],
      expectedRuns: 1,
    },
    ...[-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '0'].map((changes) => ({
      name: `first delete reports invalid changes ${String(changes)}`,
      outcomes: [makeD1Result({ changes })],
      expectedRuns: 1,
    })),
    {
      name: 'second delete reports failure',
      outcomes: [makeD1Result({ changes: 1 }), makeD1Result({ success: false })],
      expectedRuns: 2,
    },
    {
      name: 'second delete reports an incomplete result',
      outcomes: [makeD1Result({ changes: 1 }), { success: true, meta: { changes: 0 } }],
      expectedRuns: 2,
    },
    {
      name: 'first delete throws a provider error',
      outcomes: [new Error('SQL DELETE failed: secret-value')],
      expectedRuns: 1,
    },
    {
      name: 'second delete throws a provider error',
      outcomes: [makeD1Result({ changes: 1 }), new Error('SQL DELETE failed: secret-value')],
      expectedRuns: 2,
    },
  ];

  for (const cleanupCase of cases) {
    const calls = [];
    let runCount = 0;
    const database = {
      prepare(query) {
        calls.push(['prepare', query]);
        return {
          bind(value) {
            calls.push(['bind', value]);
            return {
              async run() {
                calls.push(['run']);
                const outcome = cleanupCase.outcomes[runCount];
                runCount += 1;
                if (outcome instanceof Error) throw outcome;
                return outcome;
              },
            };
          },
        };
      },
    };

    await assert.rejects(
      () => pruneContactMetadata(database, now),
      (error) => {
        assert.equal(error.message, 'Contact metadata cleanup failed', cleanupCase.name);
        assert.doesNotMatch(error.message, /DELETE|secret-value|created_at|expires_at/);
        return true;
      },
    );
    assert.equal(runCount, cleanupCase.expectedRuns, cleanupCase.name);
    assert.equal(calls.filter(([kind]) => kind === 'prepare').length, cleanupCase.expectedRuns);
  }
});

test('retention job removes expired preflight counters but retains future counters', async () => {
  const sqlite = new DatabaseSync(':memory:');
  const now = Date.UTC(2026, 9, 4, 3);
  try {
    sqlite.exec(`
      CREATE TABLE contact_requests (created_at INTEGER NOT NULL);
      CREATE TABLE contact_turnstile_rate_limits (expires_at INTEGER NOT NULL);
      INSERT INTO contact_requests VALUES (${now - CONTACT_METADATA_RETENTION_MS - 1}), (${now - CONTACT_METADATA_RETENTION_MS});
      INSERT INTO contact_turnstile_rate_limits VALUES (${now}), (${now + 1});
    `);
    const database = {
      prepare(query) {
        const statement = sqlite.prepare(query);
        return {
          bind(...params) {
            return {
              async run() {
                const result = statement.run(...params);
                return makeD1Result({ changes: Number(result.changes) });
              },
            };
          },
        };
      },
    };

    await pruneContactMetadata(database, now);
    assert.deepEqual(
      sqlite.prepare('SELECT created_at FROM contact_requests ORDER BY created_at').all().map((row) => row.created_at),
      [now - CONTACT_METADATA_RETENTION_MS],
    );
    assert.deepEqual(
      sqlite.prepare('SELECT expires_at FROM contact_turnstile_rate_limits').all().map((row) => row.expires_at),
      [now + 1],
    );
  } finally {
    sqlite.close();
  }
});

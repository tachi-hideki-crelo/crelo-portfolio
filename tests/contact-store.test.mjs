import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import {
  CONTACT_DUPLICATE_WINDOW_MS,
  CONTACT_RATE_WINDOW_MS,
  CONTACT_RATE_LIMIT,
  CONTACT_TURNSTILE_RATE_LIMIT,
  CONTACT_TURNSTILE_RATE_WINDOW_MS,
  MAX_CONTACT_RETRY_ATTEMPTS,
  TURNSTILE_TOKEN_WINDOW_MS,
  hasRecentContactDuplicate,
  isContactRateLimited,
  classifyContactConflict,
  createD1ContactStore,
  matchesContactRequestFingerprint,
} from '../db/contact-store.ts';

function makeD1Database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE contact_requests (
      request_id TEXT PRIMARY KEY NOT NULL,
      fingerprint_hash TEXT NOT NULL,
      email_hash TEXT NOT NULL,
      ip_hash TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      retry_attempts INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX contact_requests_fingerprint_idx ON contact_requests(fingerprint_hash);
    CREATE UNIQUE INDEX contact_requests_token_idx ON contact_requests(token_hash);
    CREATE INDEX contact_requests_ip_created_idx ON contact_requests(ip_hash, created_at);
    CREATE INDEX contact_requests_created_at_idx ON contact_requests(created_at);
    CREATE TABLE contact_turnstile_rate_limits (
      ip_hash TEXT PRIMARY KEY NOT NULL,
      window_started_at INTEGER NOT NULL,
      request_count INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX contact_turnstile_rate_limits_expires_idx ON contact_turnstile_rate_limits(expires_at);
  `);

  return {
    sqlite,
    prepare(query) {
      const statement = sqlite.prepare(query);
      return {
        bind(...params) {
          return {
            all: async () => ({ results: statement.all(...params) }),
            raw: async () => statement.all(...params).map((row) => Object.values(row)),
            run: async () => {
              const result = statement.run(...params);
              return {
                success: true,
                meta: {
                  changes: Number(result.changes),
                  last_row_id: Number(result.lastInsertRowid),
                },
              };
            },
          };
        },
      };
    },
  };
}

function overrideMutationResult(database, result) {
  const originalPrepare = database.prepare.bind(database);
  database.prepare = (query) => {
    const prepared = originalPrepare(query);
    return {
      bind(...params) {
        const bound = prepared.bind(...params);
        return {
          ...bound,
          run: async () => result,
        };
      },
    };
  };
  return database;
}

function interleaveRetryWrites(database, firstTokenHash, secondTokenHash) {
  const originalPrepare = database.prepare.bind(database);
  const pending = [];
  let intercepted = false;
  database.prepare = (query) => {
    const prepared = originalPrepare(query);
    return {
      bind(...params) {
        const bound = prepared.bind(...params);
        const isRetryUpdate = query.includes('UPDATE') && query.includes('retry_attempts');
        if (!isRetryUpdate || intercepted) return bound;
        const tokenHash = params.includes(firstTokenHash)
          ? firstTokenHash
          : params.includes(secondTokenHash)
            ? secondTokenHash
            : undefined;
        if (!tokenHash) throw new Error('retry test could not identify token');
        return {
          ...bound,
          run: () => new Promise((resolve, reject) => {
            pending.push({ tokenHash, execute: () => bound.run(), resolve, reject });
            if (pending.length !== 2) return;
            intercepted = true;
            void (async () => {
              for (const expectedTokenHash of [firstTokenHash, secondTokenHash]) {
                const item = pending.find(({ tokenHash: candidate }) => candidate === expectedTokenHash);
                if (!item) continue;
                try {
                  item.resolve(await item.execute());
                } catch (error) {
                  item.reject(error);
                }
              }
            })();
          }),
        };
      },
    };
  };
  return database;
}

function makeReservationInput(overrides = {}) {
  return {
    requestId: 'request-1',
    fingerprintHash: 'fingerprint-1',
    emailHash: 'email-1',
    ipHash: 'ip-1',
    tokenHash: 'token-1',
    now: 1_700_000_000_000,
    ...overrides,
  };
}

test('request IDs only retry the exact original inquiry', () => {
  assert.equal(matchesContactRequestFingerprint('same-hash', 'same-hash'), true);
  assert.equal(matchesContactRequestFingerprint('first-hash', 'other-hash'), false);
});

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

test('retry migration defaults existing rows without changing indexes or counts', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec(`
      CREATE TABLE contact_requests (
        request_id TEXT PRIMARY KEY NOT NULL,
        fingerprint_hash TEXT NOT NULL,
        email_hash TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      );
      CREATE INDEX contact_requests_fingerprint_idx ON contact_requests(fingerprint_hash);
      CREATE UNIQUE INDEX contact_requests_token_idx ON contact_requests(token_hash);
      CREATE INDEX contact_requests_ip_created_idx ON contact_requests(ip_hash, created_at);
      CREATE INDEX contact_requests_created_at_idx ON contact_requests(created_at);
      INSERT INTO contact_requests VALUES
        ('legacy-1', 'fingerprint-1', 'email-1', 'ip-1', 'token-1', 'failed', 100, 101, 200),
        ('legacy-2', 'fingerprint-2', 'email-2', 'ip-2', 'token-2', 'sent', 200, 201, 300);
    `);
    const countBefore = sqlite.prepare('SELECT COUNT(*) AS count FROM contact_requests').get().count;
    const indexesBefore = sqlite
      .prepare("SELECT name FROM pragma_index_list('contact_requests') ORDER BY name")
      .all()
      .map((row) => row.name);
    const migration = await readFile(new URL('../drizzle/0003_nappy_christian_walker.sql', import.meta.url), 'utf8');
    sqlite.exec(migration);

    const retryColumn = sqlite
      .prepare("SELECT name, \"notnull\" AS is_not_null, dflt_value FROM pragma_table_info('contact_requests') WHERE name = 'retry_attempts'")
      .get();
    assert.deepEqual({ ...retryColumn }, { name: 'retry_attempts', is_not_null: 1, dflt_value: '0' });
    assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM contact_requests').get().count, countBefore);
    for (const indexName of indexesBefore) {
      assert.ok(
        sqlite.prepare("SELECT 1 FROM pragma_index_list('contact_requests') WHERE name = ?").get(indexName),
        `migration retains ${indexName}`,
      );
    }
    assert.deepEqual(
      sqlite.prepare('SELECT request_id, retry_attempts FROM contact_requests ORDER BY request_id').all().map((row) => ({ ...row })),
      [
        { request_id: 'legacy-1', retry_attempts: 0 },
        { request_id: 'legacy-2', retry_attempts: 0 },
      ],
    );
  } finally {
    sqlite.close();
  }
});

test('preflight migration creates only the short-lived HMAC counter table', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    const migration = await readFile(new URL('../drizzle/0004_lazy_old_lace.sql', import.meta.url), 'utf8');
    sqlite.exec(migration);
    const columns = sqlite
      .prepare("SELECT name FROM pragma_table_info('contact_turnstile_rate_limits') ORDER BY cid")
      .all()
      .map((row) => row.name);
    assert.deepEqual(columns, ['ip_hash', 'window_started_at', 'request_count', 'expires_at']);
    assert.deepEqual(
      sqlite.prepare("SELECT name FROM pragma_index_list('contact_turnstile_rate_limits') ORDER BY name").all().map((row) => row.name),
      ['contact_turnstile_rate_limits_expires_idx', 'sqlite_autoindex_contact_turnstile_rate_limits_1'],
    );
  } finally {
    sqlite.close();
  }
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
    true,
    'future timestamps fail closed as a duplicate',
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
  assert.equal(
    isContactRateLimited(
      [...withinWindow.slice(0, 4), { createdAt: now - CONTACT_RATE_WINDOW_MS }],
      now,
    ),
    false,
    'the rate window is half-open at its lower boundary',
  );
  assert.equal(
    isContactRateLimited(
      Array.from({ length: 5 }, (_, index) => ({ createdAt: now + index + 1 })),
      now,
    ),
    true,
    'future timestamps consume the bounded rate window fail-closed',
  );
});

test('enforces duplicate and rate boundaries in the conditional D1 SQL', async () => {
  const now = 1_700_000_000_000;

  const duplicateBoundaryD1 = makeD1Database();
  const duplicateBoundaryStore = createD1ContactStore(duplicateBoundaryD1);
  try {
    assert.deepEqual(
      await duplicateBoundaryStore.reserve(makeReservationInput({
        requestId: 'duplicate-boundary-seed',
        tokenHash: 'duplicate-boundary-token',
        now: now - CONTACT_DUPLICATE_WINDOW_MS,
      })),
      { kind: 'reserved' },
    );
    assert.deepEqual(
      await duplicateBoundaryStore.reserve(makeReservationInput({
        requestId: 'duplicate-boundary-candidate',
        tokenHash: 'duplicate-boundary-candidate-token',
        now,
      })),
      { kind: 'duplicate' },
      'the duplicate lower boundary is inclusive',
    );
  } finally {
    duplicateBoundaryD1.sqlite.close();
  }

  const futureDuplicateD1 = makeD1Database();
  const futureDuplicateStore = createD1ContactStore(futureDuplicateD1);
  try {
    assert.deepEqual(
      await futureDuplicateStore.reserve(makeReservationInput({
        requestId: 'future-duplicate-seed',
        tokenHash: 'future-duplicate-token',
        now: now + 1,
      })),
      { kind: 'reserved' },
    );
    assert.deepEqual(
      await futureDuplicateStore.reserve(makeReservationInput({
        requestId: 'future-duplicate-candidate',
        tokenHash: 'future-duplicate-candidate-token',
        now,
      })),
      { kind: 'duplicate' },
      'newer rows are treated as duplicates during an arrival-order inversion',
    );
  } finally {
    futureDuplicateD1.sqlite.close();
  }

  const rateBoundaryD1 = makeD1Database();
  const rateBoundaryStore = createD1ContactStore(rateBoundaryD1);
  try {
    assert.deepEqual(
      await rateBoundaryStore.reserve(makeReservationInput({
        requestId: 'rate-boundary-old',
        fingerprintHash: 'rate-boundary-old-fingerprint',
        tokenHash: 'rate-boundary-old-token',
        now: now - CONTACT_RATE_WINDOW_MS,
      })),
      { kind: 'reserved' },
    );
    for (let index = 0; index < CONTACT_RATE_LIMIT - 1; index += 1) {
      assert.deepEqual(
        await rateBoundaryStore.reserve(makeReservationInput({
          requestId: `rate-boundary-recent-${index}`,
          fingerprintHash: `rate-boundary-recent-fingerprint-${index}`,
          tokenHash: `rate-boundary-recent-token-${index}`,
          now: now - index - 1,
        })),
        { kind: 'reserved' },
      );
    }
    assert.deepEqual(
      await rateBoundaryStore.reserve(makeReservationInput({
        requestId: 'rate-boundary-candidate',
        fingerprintHash: 'rate-boundary-candidate-fingerprint',
        tokenHash: 'rate-boundary-candidate-token',
        now,
      })),
      { kind: 'reserved' },
      'the rate lower boundary is excluded from the half-open window',
    );
  } finally {
    rateBoundaryD1.sqlite.close();
  }

  const futureRateD1 = makeD1Database();
  const futureRateStore = createD1ContactStore(futureRateD1);
  try {
    for (let index = 0; index < CONTACT_RATE_LIMIT; index += 1) {
      assert.deepEqual(
        await futureRateStore.reserve(makeReservationInput({
          requestId: `future-rate-${index}`,
          fingerprintHash: `future-rate-fingerprint-${index}`,
          tokenHash: `future-rate-token-${index}`,
          now: now + index + 1,
        })),
        { kind: 'reserved' },
      );
    }
    assert.deepEqual(
      await futureRateStore.reserve(makeReservationInput({
        requestId: 'future-rate-candidate',
        fingerprintHash: 'future-rate-candidate-fingerprint',
        tokenHash: 'future-rate-candidate-token',
        now,
      })),
      { kind: 'rate_limited' },
      'newer rows consume the rate window fail-closed',
    );
  } finally {
    futureRateD1.sqlite.close();
  }
});

test('rejects newer rows when a delayed request reaches D1 with an older arrival time', async () => {
  const t0 = 1_700_000_000_000;
  const t1 = t0 + 1_000;

  const freshDuplicateD1 = makeD1Database();
  const freshDuplicateStore = createD1ContactStore(freshDuplicateD1);
  try {
    assert.deepEqual(
      await freshDuplicateStore.reserve(makeReservationInput({
        requestId: 'fresh-newer-request',
        tokenHash: 'fresh-newer-token',
        now: t1,
      })),
      { kind: 'reserved' },
    );
    assert.deepEqual(
      await freshDuplicateStore.reserve(makeReservationInput({
        requestId: 'fresh-delayed-request',
        tokenHash: 'fresh-delayed-token',
        now: t0,
      })),
      { kind: 'duplicate' },
      'a newer row cannot be hidden from a delayed fresh reservation',
    );
  } finally {
    freshDuplicateD1.sqlite.close();
  }

  const freshRateD1 = makeD1Database();
  const freshRateStore = createD1ContactStore(freshRateD1);
  try {
    for (let index = 0; index < CONTACT_RATE_LIMIT; index += 1) {
      assert.deepEqual(
        await freshRateStore.reserve(makeReservationInput({
          requestId: `fresh-newer-rate-${index}`,
          fingerprintHash: `fresh-newer-rate-fingerprint-${index}`,
          tokenHash: `fresh-newer-rate-token-${index}`,
          now: t1,
        })),
        { kind: 'reserved' },
      );
    }
    assert.deepEqual(
      await freshRateStore.reserve(makeReservationInput({
        requestId: 'fresh-delayed-rate',
        fingerprintHash: 'fresh-delayed-rate-fingerprint',
        tokenHash: 'fresh-delayed-rate-token',
        now: t0,
      })),
      { kind: 'rate_limited' },
      'a newer row cannot be hidden from a delayed fresh rate check',
    );
  } finally {
    freshRateD1.sqlite.close();
  }

  const oldRowTime = t0 - CONTACT_DUPLICATE_WINDOW_MS - 1;
  const retryDuplicateD1 = makeD1Database();
  const retryDuplicateStore = createD1ContactStore(retryDuplicateD1);
  try {
    const retryInput = makeReservationInput({
      requestId: 'retry-delayed-duplicate',
      fingerprintHash: 'retry-delayed-duplicate-fingerprint',
      tokenHash: 'retry-delayed-old-token',
      now: oldRowTime,
    });
    assert.deepEqual(await retryDuplicateStore.reserve(retryInput), { kind: 'reserved' });
    await retryDuplicateStore.updateStatus(retryInput.requestId, 'failed', oldRowTime + 1, retryInput.tokenHash);
    assert.deepEqual(
      await retryDuplicateStore.reserve(makeReservationInput({
        requestId: 'retry-newer-duplicate',
        fingerprintHash: retryInput.fingerprintHash,
        tokenHash: 'retry-newer-duplicate-token',
        now: t1,
      })),
      { kind: 'reserved' },
    );
    assert.deepEqual(
      await retryDuplicateStore.reserve({
        ...retryInput,
        tokenHash: 'retry-delayed-fresh-token',
        now: t0,
      }),
      { kind: 'duplicate' },
      'a newer row cannot be hidden from a delayed retry duplicate check',
    );
  } finally {
    retryDuplicateD1.sqlite.close();
  }

  const retryRateD1 = makeD1Database();
  const retryRateStore = createD1ContactStore(retryRateD1);
  try {
    const retryInput = makeReservationInput({
      requestId: 'retry-delayed-rate',
      fingerprintHash: 'retry-delayed-rate-fingerprint',
      tokenHash: 'retry-delayed-old-rate-token',
      ipHash: 'retry-delayed-rate-ip',
      now: oldRowTime,
    });
    assert.deepEqual(await retryRateStore.reserve(retryInput), { kind: 'reserved' });
    await retryRateStore.updateStatus(retryInput.requestId, 'failed', oldRowTime + 1, retryInput.tokenHash);
    for (let index = 0; index < CONTACT_RATE_LIMIT; index += 1) {
      assert.deepEqual(
        await retryRateStore.reserve(makeReservationInput({
          requestId: `retry-newer-rate-${index}`,
          fingerprintHash: `retry-newer-rate-fingerprint-${index}`,
          tokenHash: `retry-newer-rate-token-${index}`,
          ipHash: retryInput.ipHash,
          now: t1,
        })),
        { kind: 'reserved' },
      );
    }
    assert.deepEqual(
      await retryRateStore.reserve({
        ...retryInput,
        tokenHash: 'retry-delayed-fresh-rate-token',
        now: t0,
      }),
      { kind: 'rate_limited' },
      'a newer row cannot be hidden from a delayed retry rate check',
    );
  } finally {
    retryRateD1.sqlite.close();
  }
});

test('atomically enforces the rate limit and duplicate window under concurrent D1 reservations', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  try {
    const now = 1_700_000_000_000;
    const requests = Array.from({ length: CONTACT_RATE_LIMIT + 2 }, (_, index) => store.reserve(makeReservationInput({
      requestId: `request-${index}`,
      fingerprintHash: `fingerprint-${index}`,
      tokenHash: `token-${index}`,
      now,
    })));
    const results = await Promise.all(requests);
    assert.equal(results.filter((result) => result.kind === 'reserved').length, CONTACT_RATE_LIMIT);
    assert.equal(results.filter((result) => result.kind === 'rate_limited').length, 2);

    const duplicateResults = await Promise.all([
      store.reserve(makeReservationInput({
        requestId: 'duplicate-request-1',
        fingerprintHash: 'duplicate-fingerprint',
        tokenHash: 'duplicate-token-1',
        ipHash: 'different-ip-1',
        now: now + CONTACT_RATE_WINDOW_MS + 1,
      })),
      store.reserve(makeReservationInput({
        requestId: 'duplicate-request-2',
        fingerprintHash: 'duplicate-fingerprint',
        tokenHash: 'duplicate-token-2',
        ipHash: 'different-ip-2',
        now: now + CONTACT_RATE_WINDOW_MS + 1,
      })),
    ]);
    assert.deepEqual(
      duplicateResults.map((result) => result.kind).sort(),
      ['duplicate', 'reserved'],
    );
  } finally {
    d1.sqlite.close();
  }
});

test('claims retries atomically, refreshes the pending TTL, and preserves token uniqueness', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  try {
    const first = makeReservationInput();
    assert.deepEqual(await store.reserve(first), { kind: 'reserved' });
    assert.equal(
      d1.sqlite.prepare('SELECT retry_attempts FROM contact_requests WHERE request_id = ?').get(first.requestId).retry_attempts,
      0,
    );
    assert.deepEqual(await store.reserve({ ...first, tokenHash: 'token-2', now: first.now + 1 }), { kind: 'reserved' });
    assert.equal(
      d1.sqlite.prepare('SELECT retry_attempts FROM contact_requests WHERE request_id = ?').get(first.requestId).retry_attempts,
      1,
    );
    assert.deepEqual(
      await store.reserve({ ...first, tokenHash: 'token-2', now: first.now + TURNSTILE_TOKEN_WINDOW_MS + 1 }),
      { kind: 'reserved' },
    );

    const tokenOwner = makeReservationInput({
      requestId: 'token-owner',
      fingerprintHash: 'token-owner-fingerprint',
      tokenHash: 'token-owner-token',
      ipHash: 'token-owner-ip',
      now: first.now + TURNSTILE_TOKEN_WINDOW_MS + 2,
    });
    assert.deepEqual(await store.reserve(tokenOwner), { kind: 'reserved' });
    await store.updateStatus(tokenOwner.requestId, 'failed', tokenOwner.now + 1, tokenOwner.tokenHash);
    await store.updateStatus('request-1', 'failed', tokenOwner.now + 1, 'token-2');
    assert.deepEqual(
      await store.reserve({
        ...first,
        tokenHash: tokenOwner.tokenHash,
        now: tokenOwner.now + 2,
      }),
      { kind: 'token_reused' },
    );
  } finally {
    d1.sqlite.close();
  }
});

test('atomically allows only the final retry when concurrent callers share the remaining budget', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  try {
    const first = makeReservationInput();
    assert.deepEqual(await store.reserve(first), { kind: 'reserved' });
    await store.updateStatus(first.requestId, 'failed', first.now + 1, first.tokenHash);
    for (let attempt = 1; attempt < MAX_CONTACT_RETRY_ATTEMPTS; attempt += 1) {
      assert.deepEqual(
        await store.reserve({
          ...first,
          tokenHash: `budget-token-${attempt}`,
          now: first.now + attempt + 1,
        }),
        { kind: 'reserved' },
        `retry attempt ${attempt}`,
      );
      await store.updateStatus(first.requestId, 'failed', first.now + attempt + 1, `budget-token-${attempt}`);
    }

    const results = await Promise.all(
      Array.from({ length: 3 }, (_, index) => store.reserve({
        ...first,
        tokenHash: `concurrent-budget-token-${index}`,
        now: first.now + 100,
      })),
    );
    assert.equal(results.filter((result) => result.kind === 'reserved').length, 1);
    assert.equal(results.filter((result) => result.kind === 'rate_limited').length, 2);
    const row = d1.sqlite.prepare('SELECT retry_attempts FROM contact_requests WHERE request_id = ?').get(first.requestId);
    assert.equal(row.retry_attempts, MAX_CONTACT_RETRY_ATTEMPTS);
  } finally {
    d1.sqlite.close();
  }
});

test('applies retry rate limits and prevents sent from being downgraded to failed', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  try {
    const now = 1_700_000_000_000;
    const first = makeReservationInput();
    assert.deepEqual(await store.reserve(first), { kind: 'reserved' });
    await store.updateStatus(first.requestId, 'failed', now + 1, first.tokenHash);
    for (let index = 0; index < CONTACT_RATE_LIMIT - 1; index += 1) {
      assert.deepEqual(
        await store.reserve(makeReservationInput({
          requestId: `other-${index}`,
          fingerprintHash: `other-fingerprint-${index}`,
          tokenHash: `other-token-${index}`,
          ipHash: first.ipHash,
          now: now + 2 + index,
        })),
        { kind: 'reserved' },
      );
    }
    assert.deepEqual(
      await store.reserve({ ...first, tokenHash: 'retry-token', now: now + 10 }),
      { kind: 'rate_limited' },
    );

    await store.updateStatus(first.requestId, 'sent', now + 11, first.tokenHash);
    await store.updateStatus(first.requestId, 'failed', now + 12, first.tokenHash);
    const row = d1.sqlite.prepare('SELECT status FROM contact_requests WHERE request_id = ?').get(first.requestId);
    assert.equal(row.status, 'sent');
  } finally {
    d1.sqlite.close();
  }
});

test('fences stale failures while accepting delivery for the immutable inquiry', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  const oldInput = makeReservationInput({
    requestId: 'stale-status-request',
    tokenHash: 'stale-status-old-token',
  });
  const newInput = {
    ...oldInput,
    tokenHash: 'stale-status-new-token',
    now: oldInput.now + 1,
  };

  try {
    assert.deepEqual(await store.reserve(oldInput), { kind: 'reserved' });
    assert.deepEqual(await store.reserve(newInput), { kind: 'reserved' });

    // A delayed old failure must not touch the newer pending row.
    await store.updateStatus(oldInput.requestId, 'failed', newInput.now + 1, oldInput.tokenHash);
    assert.deepEqual(
      { ...d1.sqlite.prepare('SELECT status, token_hash FROM contact_requests WHERE request_id = ?').get(oldInput.requestId) },
      { status: 'pending', token_hash: newInput.tokenHash },
    );

    // The new attempt may fail, but a confirmed delivery from the old token
    // still closes this same requestId because the inquiry fingerprint is
    // immutable across retries.
    await store.updateStatus(newInput.requestId, 'failed', newInput.now + 3, newInput.tokenHash);
    await store.updateStatus(oldInput.requestId, 'sent', newInput.now + 4, oldInput.tokenHash);
    assert.deepEqual(
      { ...d1.sqlite.prepare('SELECT status, token_hash FROM contact_requests WHERE request_id = ?').get(oldInput.requestId) },
      { status: 'sent', token_hash: newInput.tokenHash },
    );
    await store.updateStatus(newInput.requestId, 'sent', newInput.now + 5, newInput.tokenHash);
    assert.deepEqual(
      { ...d1.sqlite.prepare('SELECT status, token_hash FROM contact_requests WHERE request_id = ?').get(oldInput.requestId) },
      { status: 'sent', token_hash: newInput.tokenHash },
    );
  } finally {
    d1.sqlite.close();
  }
});

test('treats any confirmed delivery as terminal across retry ordering', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  const baseNow = 1_700_000_010_000;

  try {
    // A success arriving after B was reserved must prevent B's later failure
    // from hiding the delivery fact.
    const aSuccess = makeReservationInput({
      requestId: 'delivery-order-a-success',
      fingerprintHash: 'delivery-order-fingerprint-a',
      tokenHash: 'delivery-order-a-token',
      now: baseNow,
    });
    const bAfterASuccess = { ...aSuccess, tokenHash: 'delivery-order-b-token', now: baseNow + 1 };
    assert.deepEqual(await store.reserve(aSuccess), { kind: 'reserved' });
    assert.deepEqual(await store.reserve(bAfterASuccess), { kind: 'reserved' });
    // The delayed success must not move updated_at back before B's reservation.
    await store.updateStatus(aSuccess.requestId, 'sent', baseNow, aSuccess.tokenHash);
    await store.updateStatus(bAfterASuccess.requestId, 'failed', baseNow + 3, bAfterASuccess.tokenHash);
    assert.deepEqual(
      { ...d1.sqlite.prepare('SELECT status, token_hash, updated_at FROM contact_requests WHERE request_id = ?').get(aSuccess.requestId) },
      { status: 'sent', token_hash: bAfterASuccess.tokenHash, updated_at: baseNow + 1 },
    );

    // A failure followed by B success still closes the same immutable inquiry.
    const aFailure = makeReservationInput({
      requestId: 'delivery-order-a-failure',
      fingerprintHash: 'delivery-order-fingerprint-b',
      tokenHash: 'delivery-order-c-token',
      now: baseNow + 10,
    });
    const bAfterAFailure = { ...aFailure, tokenHash: 'delivery-order-d-token', now: baseNow + 11 };
    assert.deepEqual(await store.reserve(aFailure), { kind: 'reserved' });
    await store.updateStatus(aFailure.requestId, 'failed', baseNow + 10, aFailure.tokenHash);
    assert.deepEqual(await store.reserve(bAfterAFailure), { kind: 'reserved' });
    await store.updateStatus(bAfterAFailure.requestId, 'sent', baseNow + 12, bAfterAFailure.tokenHash);
    assert.equal(
      d1.sqlite.prepare('SELECT status FROM contact_requests WHERE request_id = ?').get(aFailure.requestId).status,
      'sent',
    );

    // B success is terminal; a delayed A success is harmless and idempotent.
    const bSuccess = makeReservationInput({
      requestId: 'delivery-order-b-success',
      fingerprintHash: 'delivery-order-fingerprint-c',
      tokenHash: 'delivery-order-e-token',
      now: baseNow + 20,
    });
    const aAfterBSuccess = { ...bSuccess, tokenHash: 'delivery-order-f-token', now: baseNow + 21 };
    assert.deepEqual(await store.reserve(bSuccess), { kind: 'reserved' });
    assert.deepEqual(await store.reserve(aAfterBSuccess), { kind: 'reserved' });
    await store.updateStatus(aAfterBSuccess.requestId, 'sent', baseNow + 22, aAfterBSuccess.tokenHash);
    await store.updateStatus(bSuccess.requestId, 'sent', baseNow + 23, bSuccess.tokenHash);
    assert.equal(
      d1.sqlite.prepare('SELECT status FROM contact_requests WHERE request_id = ?').get(bSuccess.requestId).status,
      'sent',
    );

    // If B failed after its reservation, a late A success reconciles the row.
    const failedRetry = makeReservationInput({
      requestId: 'delivery-order-late-success',
      fingerprintHash: 'delivery-order-fingerprint-d',
      tokenHash: 'delivery-order-g-token',
      now: baseNow + 30,
    });
    const failedNew = { ...failedRetry, tokenHash: 'delivery-order-h-token', now: baseNow + 31 };
    assert.deepEqual(await store.reserve(failedRetry), { kind: 'reserved' });
    assert.deepEqual(await store.reserve(failedNew), { kind: 'reserved' });
    await store.updateStatus(failedNew.requestId, 'failed', baseNow + 32, failedNew.tokenHash);
    await store.updateStatus(failedRetry.requestId, 'sent', baseNow + 33, failedRetry.tokenHash);
    assert.equal(
      d1.sqlite.prepare('SELECT status FROM contact_requests WHERE request_id = ?').get(failedRetry.requestId).status,
      'sent',
    );
  } finally {
    d1.sqlite.close();
  }
});

test('does not let a same-time same-request reservation roll a newer token back', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  const tokenB = makeReservationInput({
    requestId: 'same-request-ordering',
    tokenHash: 'same-request-token-b',
    now: 1_700_000_000_001,
  });
  const tokenA = {
    ...tokenB,
    tokenHash: 'same-request-token-a',
    now: tokenB.now,
  };

  try {
    assert.deepEqual(await store.reserve(tokenB), { kind: 'reserved' });
    assert.deepEqual(
      await store.reserve(tokenA),
      { kind: 'duplicate' },
      'a same-time retry cannot overwrite the newer same-request reservation',
    );
    assert.deepEqual(
      { ...d1.sqlite.prepare('SELECT status, token_hash, updated_at, retry_attempts FROM contact_requests WHERE request_id = ?').get(tokenB.requestId) },
      {
        status: 'pending',
        token_hash: tokenB.tokenHash,
        updated_at: tokenB.now,
        retry_attempts: 0,
      },
    );

    await store.updateStatus(tokenB.requestId, 'sent', tokenB.now + 1, tokenB.tokenHash);
    assert.deepEqual(
      { ...d1.sqlite.prepare('SELECT status, token_hash FROM contact_requests WHERE request_id = ?').get(tokenB.requestId) },
      { status: 'sent', token_hash: tokenB.tokenHash },
      'the newer token still completes after the same-time reservation is rejected',
    );
  } finally {
    d1.sqlite.close();
  }
});

test('CAS protects same-time retry reservations when both reads precede either write', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  const seed = makeReservationInput({
    requestId: 'same-time-interleave',
    tokenHash: 'same-time-seed',
    now: 1_700_000_000_000,
  });
  const tokenB = {
    ...seed,
    tokenHash: 'same-time-token-b',
    now: seed.now + 1,
  };
  const tokenA = {
    ...seed,
    tokenHash: 'same-time-token-a',
    now: seed.now + 1,
  };

  try {
    assert.deepEqual(await store.reserve(seed), { kind: 'reserved' });
    interleaveRetryWrites(d1, tokenB.tokenHash, tokenA.tokenHash);
    const [resultB, resultA] = await Promise.all([
      store.reserve(tokenB),
      store.reserve(tokenA),
    ]);
    assert.deepEqual(resultB, { kind: 'reserved' });
    assert.deepEqual(resultA, { kind: 'duplicate' });
    assert.deepEqual(
      { ...d1.sqlite.prepare('SELECT status, token_hash, retry_attempts FROM contact_requests WHERE request_id = ?').get(seed.requestId) },
      { status: 'pending', token_hash: tokenB.tokenHash, retry_attempts: 1 },
      'the first same-time write remains the only reservation after both callers read the old row',
    );

    await store.updateStatus(seed.requestId, 'failed', tokenB.now + 1, tokenA.tokenHash);
    await store.updateStatus(seed.requestId, 'sent', tokenB.now + 2, tokenB.tokenHash);
    assert.deepEqual(
      { ...d1.sqlite.prepare('SELECT status, token_hash FROM contact_requests WHERE request_id = ?').get(seed.requestId) },
      { status: 'sent', token_hash: tokenB.tokenHash },
      'a stale failure cannot undo the successful same-time reservation',
    );
  } finally {
    d1.sqlite.close();
  }
});

test('atomically counts Turnstile preflight attempts per IP and resets at fixed-window boundaries', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  const now = 1_700_000_000_000;
  const windowStartedAt = Math.floor(now / CONTACT_TURNSTILE_RATE_WINDOW_MS) * CONTACT_TURNSTILE_RATE_WINDOW_MS;
  const windowEnd = windowStartedAt + CONTACT_TURNSTILE_RATE_WINDOW_MS;
  try {
    const attempts = await Promise.all(
      Array.from({ length: CONTACT_TURNSTILE_RATE_LIMIT + 2 }, () => store.reserveTurnstileAttempt({
        ipHash: 'turnstile-ip',
        now,
      })),
    );
    assert.equal(attempts.filter((result) => result.kind === 'allowed').length, CONTACT_TURNSTILE_RATE_LIMIT);
    assert.equal(attempts.filter((result) => result.kind === 'rate_limited').length, 2);
    assert.deepEqual(
      await store.reserveTurnstileAttempt({ ipHash: 'turnstile-ip', now: windowEnd }),
      { kind: 'allowed' },
      'the exact expiration boundary starts a fresh fixed window',
    );
    const row = d1.sqlite
      .prepare('SELECT window_started_at, request_count, expires_at FROM contact_turnstile_rate_limits WHERE ip_hash = ?')
      .get('turnstile-ip');
    assert.deepEqual({ ...row }, {
      window_started_at: windowEnd,
      request_count: 1,
      expires_at: windowEnd + CONTACT_TURNSTILE_RATE_WINDOW_MS,
    });
  } finally {
    d1.sqlite.close();
  }
});

test('fails the preflight closed when D1 reports an unsuccessful write', async () => {
  const database = {
    prepare() {
      return {
        bind() {
          return {
            async run() {
              return { success: false, error: 'simulated D1 failure' };
            },
          };
        },
      };
    },
  };
  const store = createD1ContactStore(database);
  await assert.rejects(
    store.reserveTurnstileAttempt({ ipHash: 'd1-failure-ip', now: 1_700_000_000_000 }),
    /Turnstile rate counter update failed/,
  );
});

test('fails closed when contact status or reservation mutations report unsuccessful results', async () => {
  const unsuccessfulWithChanges = {
    success: false,
    meta: { changes: 1 },
    error: 'SQL failure with secret-value',
  };
  const statusDatabase = overrideMutationResult(makeD1Database(), unsuccessfulWithChanges);
  const statusStore = createD1ContactStore(statusDatabase);
  await assert.rejects(
    statusStore.updateStatus('request-1', 'sent', 1_700_000_000_001),
    (error) => {
      assert.equal(error.message, 'contact status update failed');
      assert.doesNotMatch(error.message, /SQL|secret-value/);
      return true;
    },
  );

  const freshDatabase = overrideMutationResult(makeD1Database(), unsuccessfulWithChanges);
  const freshStore = createD1ContactStore(freshDatabase);
  await assert.rejects(
    freshStore.reserve(makeReservationInput()),
    (error) => {
      assert.equal(error.message, 'contact reservation failed');
      assert.doesNotMatch(error.message, /SQL|secret-value/);
      return true;
    },
  );
  assert.equal(freshDatabase.sqlite.prepare('SELECT COUNT(*) AS count FROM contact_requests').get().count, 0);

  const retryDatabase = makeD1Database();
  const retryStore = createD1ContactStore(retryDatabase);
  const first = makeReservationInput();
  assert.deepEqual(await retryStore.reserve(first), { kind: 'reserved' });
  await retryStore.updateStatus(first.requestId, 'failed', first.now + 1, first.tokenHash);
  overrideMutationResult(retryDatabase, unsuccessfulWithChanges);
  await assert.rejects(
    retryStore.reserve({ ...first, tokenHash: 'token-2', now: first.now + 2 }),
    (error) => {
      assert.equal(error.message, 'contact retry update failed');
      assert.doesNotMatch(error.message, /SQL|secret-value/);
      return true;
    },
  );
  assert.deepEqual(
    { ...retryDatabase.sqlite.prepare('SELECT status, retry_attempts FROM contact_requests WHERE request_id = ?').get(first.requestId) },
    { status: 'failed', retry_attempts: 0 },
  );
  retryDatabase.sqlite.close();
  freshDatabase.sqlite.close();
  statusDatabase.sqlite.close();
});

test('rejects non-integer or negative D1 mutation change counts', async () => {
  for (const changes of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '0']) {
    const database = overrideMutationResult(makeD1Database(), {
      success: true,
      meta: { changes },
    });
    const store = createD1ContactStore(database);
    await assert.rejects(
      store.updateStatus('missing-request', 'sent', 1_700_000_000_001),
      (error) => {
        assert.equal(error.message, 'contact status update result was incomplete');
        return true;
      },
      `changes=${String(changes)} must fail closed`,
    );
    database.sqlite.close();
  }
});

test('accepts a successful zero-change status CAS as a normal race outcome', async () => {
  const database = overrideMutationResult(makeD1Database(), {
    success: true,
    meta: { changes: 0 },
  });
  const store = createD1ContactStore(database);
  await store.updateStatus('missing-request', 'sent', 1_700_000_000_001);
  database.sqlite.close();
});

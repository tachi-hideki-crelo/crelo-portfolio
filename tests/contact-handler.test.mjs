import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { handleContactRequest as handleContactRequestCore } from '../app/lib/contact-handler.ts';
import { createDefaultContactLogger } from '../app/lib/contact-logger.ts';
import { hmacSha256 } from '../app/lib/contact-crypto.ts';
import {
  CONTACT_TURNSTILE_RATE_LIMIT,
  CONTACT_TURNSTILE_RATE_WINDOW_MS,
  createD1ContactStore,
  MAX_CONTACT_RETRY_ATTEMPTS,
} from '../db/contact-store.ts';

const env = {
  SITE_ORIGIN: 'https://crelo.example',
  CONTACT_TO_EMAIL: 'inbox@crelo.example',
  CONTACT_FROM_EMAIL: 'no-reply@crelo.example',
  RESEND_API_KEY: 'resend-secret',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'turnstile-site',
  TURNSTILE_SECRET_KEY: 'turnstile-secret',
  CONTACT_HASH_SECRET: '0123456789abcdef0123456789abcdef',
};

const basePayload = {
  name: '山田太郎',
  company: 'Crelo合同会社',
  email: 'person@example.com',
  inquiryType: 'project',
  message: '業務整理から設計・導入まで相談したいです。',
  consent: true,
  turnstileToken: 'turnstile-token',
  requestId: '550e8400-e29b-41d4-a716-446655440000',
};

function handleContactRequest(request, dependencies) {
  return handleContactRequestCore(request, { contactAvailable: true, ...dependencies });
}

test('keeps the API closed while privacy notice or runtime setup is incomplete', async () => {
  const response = await handleContactRequestCore(makeRequest(), {
    env,
    store: makeStore(),
    contactAvailable: false,
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).errorCode, 'SERVICE_UNAVAILABLE');
});

function makeRequest(payload = basePayload, headers = {}) {
  return new Request('https://crelo.example/api/contact', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://crelo.example',
      ...headers,
    },
    body: JSON.stringify(payload),
  });
}

function makeStore(overrides = {}) {
  const statuses = [];
  const statusTokens = [];
  return {
    statuses,
    statusTokens,
    async reserveTurnstileAttempt(input) {
      return overrides.reserveTurnstileAttempt
        ? overrides.reserveTurnstileAttempt(input)
        : { kind: 'allowed' };
    },
    async reserve(input) {
      return overrides.reserve ? overrides.reserve(input) : { kind: 'reserved' };
    },
    async updateStatus(requestId, status, now, expectedTokenHash) {
      statuses.push({ requestId, status });
      statusTokens.push({ requestId, status, tokenHash: expectedTokenHash });
    },
  };
}

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

function makeFetch({
  turnstile = true,
  turnstileErrorCodes,
  resendOk = true,
  resendStatuses,
  challengeTs = new Date().toISOString(),
  hostname = 'crelo.example',
  action = 'contact',
  omitAction = false,
  turnstileNetworkFailure = false,
} = {}) {
  const calls = [];
  const statuses = resendStatuses ?? (resendOk ? [200] : [500]);
  let resendAttempt = 0;
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    if (String(url).includes('siteverify')) {
      if (turnstileNetworkFailure) throw new Error('upstream unavailable');
      return new Response(JSON.stringify({
        success: turnstile,
        challenge_ts: challengeTs,
        hostname,
        ...(omitAction ? {} : { action }),
        ...(turnstileErrorCodes ? { 'error-codes': turnstileErrorCodes } : {}),
      }), {
        status: turnstile ? 200 : 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    const status = statuses[Math.min(resendAttempt++, statuses.length - 1)];
    return new Response(status >= 400 ? '{"error":"delivery"}' : '{}', { status });
  };
  return { calls, fetchImpl };
}

for (const sameInquiry of [false, true]) {
  test(`rechecks the inquiry identity after a fresh insert races a sent row (${sameInquiry ? 'same' : 'changed'} content)`, { timeout: 5_000 }, async () => {
    const database = makeD1Database();
    const store = createD1ContactStore(database);
    const now = 1_700_000_000_000;
    const secondPayload = {
      ...basePayload,
      turnstileToken: 'raced-second-token',
      ...(sameInquiry ? {} : { message: 'こちらは同じ送信IDを使った別の相談内容です。' }),
    };
    const firstTokenHash = await hmacSha256(basePayload.turnstileToken, env.CONTACT_HASH_SECRET);
    const secondTokenHash = await hmacSha256(secondPayload.turnstileToken, env.CONTACT_HASH_SECRET);
    let notifySecondInsert;
    let releaseSecondInsert;
    const secondInsertReached = new Promise((resolve) => { notifySecondInsert = resolve; });
    const secondInsertReleased = new Promise((resolve) => { releaseSecondInsert = resolve; });
    const originalPrepare = database.prepare.bind(database);
    database.prepare = (query) => {
      const prepared = originalPrepare(query);
      return {
        bind(...params) {
          const bound = prepared.bind(...params);
          if (!/INSERT INTO\s+"contact_requests"/.test(query)) return bound;
          return {
            ...bound,
            run: async () => {
              if (params.includes(secondTokenHash)) {
                notifySecondInsert();
                await secondInsertReleased;
              } else if (params.includes(firstTokenHash)) {
                // Both callers must read the empty request ID before either
                // INSERT. The second write waits until the first mail is sent.
                await secondInsertReached;
              }
              return bound.run();
            },
          };
        },
      };
    };
    const mock = makeFetch({ challengeTs: new Date(now).toISOString() });
    const dependencies = { env, store, fetchImpl: mock.fetchImpl, now: () => now };
    const firstResponse = handleContactRequest(makeRequest(), dependencies);
    const secondResponse = handleContactRequest(makeRequest(secondPayload), dependencies);
    try {
      await secondInsertReached;
      assert.equal((await firstResponse).status, 200);
      releaseSecondInsert();
      const racedResponse = await secondResponse;
      assert.equal(racedResponse.status, sameInquiry ? 200 : 409);
      assert.deepEqual(await racedResponse.json(), sameInquiry
        ? { ok: true, requestId: basePayload.requestId }
        : { ok: false, requestId: basePayload.requestId, errorCode: 'REQUEST_DUPLICATE' });
      assert.equal(mock.calls.filter((call) => String(call.url).includes('/emails')).length, 1);
      assert.equal(database.sqlite.prepare('SELECT count(*) AS count FROM contact_requests').get().count, 1);
      assert.deepEqual(
        { ...database.sqlite.prepare('SELECT status, token_hash FROM contact_requests WHERE request_id = ?').get(basePayload.requestId) },
        { status: 'sent', token_hash: firstTokenHash },
      );
    } finally {
      releaseSecondInsert();
      await Promise.allSettled([firstResponse, secondResponse]);
      database.sqlite.close();
    }
  });
}

test('accepts valid request, verifies Turnstile, and sends idempotent Resend request', async () => {
  const store = makeStore();
  const mock = makeFetch({ challengeTs: new Date(1_700_000_000_000).toISOString() });
  const response = await handleContactRequest(makeRequest(), {
    env,
    store,
    fetchImpl: mock.fetchImpl,
    now: () => 1_700_000_000_000,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, requestId: '550e8400-e29b-41d4-a716-446655440000' });
  assert.equal(mock.calls.length, 2);
  assert.ok(mock.calls[0].options.signal instanceof AbortSignal);
  assert.ok(mock.calls[1].options.signal instanceof AbortSignal);
  const siteverifyBody = new URLSearchParams(mock.calls[0].options.body);
  assert.equal(siteverifyBody.get('idempotency_key'), null, 'Turnstile key is not reused across contact retries');
  assert.equal(mock.calls[1].options.headers['Idempotency-Key'], '550e8400-e29b-41d4-a716-446655440000');
  assert.equal(mock.calls[1].options.body.includes('turnstile-token'), false);
  assert.deepEqual(store.statuses, [{ requestId: '550e8400-e29b-41d4-a716-446655440000', status: 'sent' }]);
  assert.deepEqual(store.statusTokens, [{
    requestId: '550e8400-e29b-41d4-a716-446655440000',
    status: 'sent',
    tokenHash: await hmacSha256(basePayload.turnstileToken, env.CONTACT_HASH_SECRET),
  }]);

  const serverOnlyFetch = makeFetch();
  const serverOnly = await handleContactRequest(
    makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440012' }),
    {
      env: { ...env, NEXT_PUBLIC_TURNSTILE_SITE_KEY: undefined },
      store: makeStore(),
      fetchImpl: serverOnlyFetch.fetchImpl,
    },
  );
  assert.equal(serverOnly.status, 200, 'Siteverify only needs the server secret, not the public site key');
});

test('rejects unsupported content type, wrong origin, malformed JSON, and oversized body', async () => {
  const store = makeStore();
  const contentType = await handleContactRequest(makeRequest(basePayload, { 'content-type': 'text/plain' }), { env, store });
  assert.equal(contentType.status, 415);
  const origin = await handleContactRequest(makeRequest(basePayload, { origin: 'https://evil.example' }), { env, store });
  assert.equal(origin.status, 403);
  const malformed = await handleContactRequest(new Request('https://crelo.example/api/contact', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: env.SITE_ORIGIN }, body: '{',
  }), { env, store });
  assert.equal(malformed.status, 400);
  const oversized = await handleContactRequest(makeRequest({ ...basePayload, message: 'x'.repeat(20_000) }), { env, store });
  assert.equal(oversized.status, 413);
});

test('rejects honeypot and consent failures before external calls', async () => {
  const store = makeStore();
  const mock = makeFetch();
  const honeypot = await handleContactRequest(makeRequest({ ...basePayload, honeypot: 'filled' }), { env, store, fetchImpl: mock.fetchImpl });
  assert.equal(honeypot.status, 400);
  assert.equal(mock.calls.length, 0);
  const consent = await handleContactRequest(makeRequest({ ...basePayload, consent: false }), { env, store, fetchImpl: mock.fetchImpl });
  assert.equal(consent.status, 400);
  assert.equal(mock.calls.length, 0);
});

test('rejects Turnstile failures and prevents duplicate or rate-limited requests', async () => {
  const rejectedStore = makeStore();
  const rejectedFetch = makeFetch({ turnstile: false });
  const rejected = await handleContactRequest(makeRequest(), { env, store: rejectedStore, fetchImpl: rejectedFetch.fetchImpl });
  assert.equal(rejected.status, 403);
  assert.deepEqual(rejectedStore.statuses, []);

  const reusedFetch = makeFetch({ turnstile: false, turnstileErrorCodes: ['timeout-or-duplicate'] });
  const reused = await handleContactRequest(makeRequest({ ...basePayload, turnstileToken: 'already-used-token' }), {
    env,
    store: rejectedStore,
    fetchImpl: reusedFetch.fetchImpl,
  });
  assert.equal(reused.status, 403, 'Turnstile token_reused is rejected before reservation');

  const acceptedFetch = makeFetch();
  const duplicateStore = makeStore({ reserve: async () => ({ kind: 'duplicate' }) });
  const duplicate = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440002' }), { env, store: duplicateStore, fetchImpl: acceptedFetch.fetchImpl });
  assert.equal(duplicate.status, 409);
  assert.equal(acceptedFetch.calls.length, 1, 'duplicate still performs Siteverify before D1 rejection');
  assert.match(acceptedFetch.calls[0].url, /siteverify/);
  const rateStore = makeStore({ reserve: async () => ({ kind: 'rate_limited' }) });
  const rate = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440003' }), { env, store: rateStore, fetchImpl: acceptedFetch.fetchImpl });
  assert.equal(rate.status, 429);

  const tokenStore = makeStore({ reserve: async () => ({ kind: 'token_reused' }) });
  const tokenReuse = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440008' }), {
    env,
    store: tokenStore,
    fetchImpl: acceptedFetch.fetchImpl,
  });
  assert.equal(tokenReuse.status, 409);
});

test('rejects stale or wrong-host Turnstile assertions', async () => {
  const stale = makeFetch({ challengeTs: new Date(Date.now() - 6 * 60 * 1000).toISOString() });
  const staleResponse = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440004' }), {
    env,
    store: makeStore(),
    fetchImpl: stale.fetchImpl,
  });
  assert.equal(staleResponse.status, 403);
  const wrongHost = makeFetch({ hostname: 'evil.example' });
  const wrongHostResponse = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440005' }), {
    env,
    store: makeStore(),
    fetchImpl: wrongHost.fetchImpl,
  });
  assert.equal(wrongHostResponse.status, 403);
});

test('rejects missing or mismatched Turnstile action and separates upstream failure', async () => {
  const missingAction = makeFetch({ omitAction: true });
  const missingActionResponse = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440013' }), {
    env,
    store: makeStore(),
    fetchImpl: missingAction.fetchImpl,
  });
  assert.equal(missingActionResponse.status, 403);

  const mismatchedAction = makeFetch({ action: 'other-widget' });
  const mismatchedActionResponse = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440014' }), {
    env,
    store: makeStore(),
    fetchImpl: mismatchedAction.fetchImpl,
  });
  assert.equal(mismatchedActionResponse.status, 403);

  const upstream = makeFetch({ turnstileNetworkFailure: true });
  const upstreamEntries = [];
  const upstreamResponse = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440015' }), {
    env,
    store: makeStore(),
    fetchImpl: upstream.fetchImpl,
    logger: (entry) => upstreamEntries.push(entry),
  });
  assert.equal(upstreamResponse.status, 503);
  assert.equal((await upstreamResponse.json()).errorCode, 'SERVICE_UNAVAILABLE');
  assert.deepEqual(upstreamEntries, [{
    event: 'contact.turnstile_upstream_failure',
    stage: 'turnstile',
    requestId: '550e8400-e29b-41d4-a716-446655440015',
    errorCode: 'SERVICE_UNAVAILABLE',
  }]);
});

test('enforces the atomic per-IP Turnstile preflight limit before external calls', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  const now = 1_700_000_000_000;
  const ipHash = await hmacSha256('unknown', env.CONTACT_HASH_SECRET);
  const fetchMock = makeFetch({
    challengeTs: new Date(now).toISOString(),
    turnstile: false,
  });

  try {
    for (let index = 0; index < CONTACT_TURNSTILE_RATE_LIMIT; index += 1) {
      assert.deepEqual(
        await store.reserveTurnstileAttempt({ ipHash, now }),
        { kind: 'allowed' },
      );
    }

    const responses = await Promise.all([
      handleContactRequest(makeRequest({
        ...basePayload,
        requestId: '550e8400-e29b-41d4-a716-446655440030',
        turnstileToken: 'invalid-token-a',
      }), { env, store, fetchImpl: fetchMock.fetchImpl, now: () => now }),
      handleContactRequest(makeRequest({
        ...basePayload,
        requestId: '550e8400-e29b-41d4-a716-446655440031',
        turnstileToken: 'invalid-token-b',
      }), { env, store, fetchImpl: fetchMock.fetchImpl, now: () => now }),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort((a, b) => a - b), [429, 429]);
    assert.equal(fetchMock.calls.length, 0, 'a full preflight window prevents Siteverify and Resend');
  } finally {
    d1.sqlite.close();
  }
});

test('allows exactly one remaining concurrent preflight request and blocks the other', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  const now = 1_700_000_000_000;
  const ipHash = await hmacSha256('unknown', env.CONTACT_HASH_SECRET);
  const fetchMock = makeFetch({ challengeTs: new Date(now).toISOString() });

  try {
    for (let index = 0; index < CONTACT_TURNSTILE_RATE_LIMIT - 1; index += 1) {
      assert.deepEqual(await store.reserveTurnstileAttempt({ ipHash, now }), { kind: 'allowed' });
    }
    const responses = await Promise.all([
      handleContactRequest(makeRequest({
        ...basePayload,
        requestId: '550e8400-e29b-41d4-a716-446655440032',
        turnstileToken: 'valid-token-a',
      }), { env, store, fetchImpl: fetchMock.fetchImpl, now: () => now }),
      handleContactRequest(makeRequest({
        ...basePayload,
        requestId: '550e8400-e29b-41d4-a716-446655440033',
        turnstileToken: 'valid-token-b',
      }), { env, store, fetchImpl: fetchMock.fetchImpl, now: () => now }),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort((a, b) => a - b), [200, 429]);
    assert.equal(fetchMock.calls.length, 2, 'only the allowed request reaches Siteverify and Resend');
  } finally {
    d1.sqlite.close();
  }
});

test('fails closed when the Turnstile preflight counter is unavailable', async () => {
  const fetchMock = makeFetch();
  const response = await handleContactRequest(makeRequest({
    ...basePayload,
    requestId: '550e8400-e29b-41d4-a716-446655440034',
  }), {
    env,
    store: makeStore({
      async reserveTurnstileAttempt() {
        throw new Error('D1 unavailable');
      },
    }),
    fetchImpl: fetchMock.fetchImpl,
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).errorCode, 'SERVICE_UNAVAILABLE');
  assert.equal(fetchMock.calls.length, 0, 'D1 failure must not reach Siteverify or Resend');
});

test('blocks more than twenty invalid tokens in one fixed window', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  const now = 1_700_000_000_000;
  const fetchMock = makeFetch({ turnstile: false, challengeTs: new Date(now).toISOString() });

  try {
    const responses = [];
    for (let index = 0; index < CONTACT_TURNSTILE_RATE_LIMIT + 1; index += 1) {
      responses.push(await handleContactRequest(makeRequest({
        ...basePayload,
        requestId: `550e8400-e29b-41d4-a716-4466554400${String(40 + index).padStart(2, '0')}`,
        turnstileToken: `invalid-token-${index}`,
      }), { env, store, fetchImpl: fetchMock.fetchImpl, now: () => now }));
    }
    assert.equal(responses.filter((response) => response.status === 403).length, CONTACT_TURNSTILE_RATE_LIMIT);
    assert.equal(responses.at(-1).status, 429);
    assert.equal(fetchMock.calls.length, CONTACT_TURNSTILE_RATE_LIMIT, 'the 21st invalid token is denied before Siteverify');
  } finally {
    d1.sqlite.close();
  }
});

test('starts a fresh preflight window at the exact boundary and never rolls back future state', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  const now = 1_700_000_000_000;
  const ipHash = await hmacSha256('future-boundary-ip', env.CONTACT_HASH_SECRET);
  const windowStartedAt = Math.floor(now / CONTACT_TURNSTILE_RATE_WINDOW_MS) * CONTACT_TURNSTILE_RATE_WINDOW_MS;
  const nextWindow = windowStartedAt + CONTACT_TURNSTILE_RATE_WINDOW_MS;

  try {
    d1.sqlite.prepare(`
      INSERT INTO contact_turnstile_rate_limits (ip_hash, window_started_at, request_count, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(ipHash, windowStartedAt, CONTACT_TURNSTILE_RATE_LIMIT, nextWindow);
    assert.deepEqual(
      await store.reserveTurnstileAttempt({ ipHash, now: nextWindow }),
      { kind: 'allowed' },
    );
    d1.sqlite.prepare('DELETE FROM contact_turnstile_rate_limits WHERE ip_hash = ?').run(ipHash);
    d1.sqlite.prepare(`
      INSERT INTO contact_turnstile_rate_limits (ip_hash, window_started_at, request_count, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(ipHash, nextWindow + CONTACT_TURNSTILE_RATE_WINDOW_MS, CONTACT_TURNSTILE_RATE_LIMIT, nextWindow + 2 * CONTACT_TURNSTILE_RATE_WINDOW_MS);
    assert.deepEqual(
      await store.reserveTurnstileAttempt({ ipHash, now }),
      { kind: 'rate_limited' },
      'a delayed request cannot roll a newer fixed window backward',
    );
    const row = d1.sqlite.prepare('SELECT window_started_at, request_count, expires_at FROM contact_turnstile_rate_limits WHERE ip_hash = ?').get(ipHash);
    assert.deepEqual({ ...row }, {
      window_started_at: nextWindow + CONTACT_TURNSTILE_RATE_WINDOW_MS,
      request_count: CONTACT_TURNSTILE_RATE_LIMIT,
      expires_at: nextWindow + 2 * CONTACT_TURNSTILE_RATE_WINDOW_MS,
    });
  } finally {
    d1.sqlite.close();
  }
});

test('aborts stalled external APIs and retries Resend at most once with the same idempotency key', async () => {
  const pendingFetch = (url, options) => new Promise((_, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error(`aborted ${url}`)), { once: true });
  });
  const turnstileStore = makeStore();
  const turnstileResponse = await handleContactRequest(makeRequest({
    ...basePayload,
    requestId: '550e8400-e29b-41d4-a716-446655440019',
  }), {
    env,
    store: turnstileStore,
    fetchImpl: pendingFetch,
    timeouts: { turnstileMs: 5, resendMs: 5 },
  });
  assert.equal(turnstileResponse.status, 503);
  assert.deepEqual(turnstileStore.statuses, []);

  const pendingJsonFetch = (url, options) => {
    if (String(url).includes('siteverify')) {
      return Promise.resolve({ ok: true, json: () => new Promise(() => {}) });
    }
    return pendingFetch(url, options);
  };
  const pendingJsonStore = makeStore();
  const pendingJsonResponse = await handleContactRequest(makeRequest({
    ...basePayload,
    requestId: '550e8400-e29b-41d4-a716-446655440021',
  }), {
    env,
    store: pendingJsonStore,
    fetchImpl: pendingJsonFetch,
    timeouts: { turnstileMs: 5, resendMs: 5 },
  });
  assert.equal(pendingJsonResponse.status, 503, 'response.json is covered by the Turnstile timeout');
  assert.deepEqual(pendingJsonStore.statuses, []);

  const now = 1_700_000_000_000;
  const resendCalls = [];
  const resendFetch = async (url, options) => {
    resendCalls.push({ url, options });
    if (String(url).includes('siteverify')) {
      return new Response(JSON.stringify({
        success: true,
        challenge_ts: new Date(now).toISOString(),
        hostname: 'crelo.example',
        action: 'contact',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return pendingFetch(url, options);
  };
  const resendStore = makeStore();
  const resendResponse = await handleContactRequest(makeRequest({
    ...basePayload,
    requestId: '550e8400-e29b-41d4-a716-446655440020',
  }), {
    env,
    store: resendStore,
    fetchImpl: resendFetch,
    now: () => now,
    timeouts: { turnstileMs: 5, resendMs: 5 },
  });
  assert.equal(resendResponse.status, 502);
  assert.equal(resendCalls.length, 3, 'siteverify plus one bounded Resend retry');
  assert.equal(resendCalls[1].options.headers['Idempotency-Key'], '550e8400-e29b-41d4-a716-446655440020');
  assert.equal(resendCalls[1].options.headers['Idempotency-Key'], resendCalls[2].options.headers['Idempotency-Key']);
  assert.deepEqual(resendStore.statuses, [{
    requestId: '550e8400-e29b-41d4-a716-446655440020',
    status: 'failed',
  }]);
});

test('does not retry Resend 4xx, retries 429/5xx once, and handles local configuration failure', async () => {
  const store = makeStore();
  const badRequest = makeFetch({ resendStatuses: [400] });
  const badRequestResponse = await handleContactRequest(makeRequest(), {
    env,
    store,
    fetchImpl: badRequest.fetchImpl,
  });
  assert.equal(badRequestResponse.status, 502);
  assert.equal(badRequest.calls.length, 2, 'Siteverify plus one Resend attempt; 4xx is not retried');
  assert.deepEqual(store.statuses, [{ requestId: '550e8400-e29b-41d4-a716-446655440000', status: 'failed' }]);

  const retry429Store = makeStore();
  const retry429 = makeFetch({ resendStatuses: [429, 200] });
  const retry429Response = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440009' }), {
    env,
    store: retry429Store,
    fetchImpl: retry429.fetchImpl,
  });
  assert.equal(retry429Response.status, 200);
  assert.equal(retry429.calls.length, 3);
  assert.equal(
    retry429.calls[1].options.headers['Idempotency-Key'],
    retry429.calls[2].options.headers['Idempotency-Key'],
  );

  const retry500Store = makeStore();
  const retry500 = makeFetch({ resendStatuses: [500, 200] });
  const retry500Response = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440010' }), {
    env,
    store: retry500Store,
    fetchImpl: retry500.fetchImpl,
  });
  assert.equal(retry500Response.status, 200);
  assert.equal(retry500.calls.length, 3);
  assert.equal(
    retry500.calls[1].options.headers['Idempotency-Key'],
    retry500.calls[2].options.headers['Idempotency-Key'],
  );

  const unavailable = await handleContactRequest(makeRequest(), { env: {}, store, fetchImpl: badRequest.fetchImpl });
  assert.equal(unavailable.status, 503);
  const weakSecret = await handleContactRequest(makeRequest(), {
    env: { ...env, CONTACT_HASH_SECRET: 'too-short' },
    store,
    fetchImpl: badRequest.fetchImpl,
  });
  assert.equal(weakSecret.status, 503);
  const invalidOrigin = await handleContactRequest(makeRequest(), {
    env: { ...env, SITE_ORIGIN: 'not-a-url' },
    store,
    fetchImpl: badRequest.fetchImpl,
  });
  assert.equal(invalidOrigin.status, 503);
  const invalidProtocol = await handleContactRequest(makeRequest(), {
    env: { ...env, SITE_ORIGIN: 'ftp://crelo.example' },
    store,
    fetchImpl: badRequest.fetchImpl,
  });
  assert.equal(invalidProtocol.status, 503);
  const invalidPath = await handleContactRequest(makeRequest(), {
    env: { ...env, SITE_ORIGIN: 'https://crelo.example/contact?preview=1' },
    store,
    fetchImpl: badRequest.fetchImpl,
  });
  assert.equal(invalidPath.status, 503);
  const insecureOrigin = await handleContactRequest(makeRequest(), {
    env: { ...env, SITE_ORIGIN: 'http://crelo.example' },
    store,
    fetchImpl: badRequest.fetchImpl,
  });
  assert.equal(insecureOrigin.status, 503);
});

test('restores an already-sent idempotent request without sending a second email', async () => {
  const mock = makeFetch();
  const store = makeStore({ reserve: async () => ({ kind: 'already_sent' }) });
  const response = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440006' }), {
    env,
    store,
    fetchImpl: mock.fetchImpl,
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, requestId: '550e8400-e29b-41d4-a716-446655440006' });
  assert.equal(mock.calls.length, 1, 'only Turnstile Siteverify should run');
});

test('retries a failed delivery with the same request idempotency key', async () => {
  const store = makeStore();
  const first = makeFetch({ resendOk: false });
  const firstResponse = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440007' }), {
    env,
    store,
    fetchImpl: first.fetchImpl,
  });
  assert.equal(firstResponse.status, 502);
  const second = makeFetch();
  const secondResponse = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440007', turnstileToken: 'new-token' }), {
    env,
    store,
    fetchImpl: second.fetchImpl,
  });
  assert.equal(secondResponse.status, 200);
  assert.equal(second.calls[1].options.headers['Idempotency-Key'], '550e8400-e29b-41d4-a716-446655440007');
});

test('caps repeated failed-fetch retries for one D1 row', async () => {
  const d1 = makeD1Database();
  const store = createD1ContactStore(d1);
  const requestId = '550e8400-e29b-41d4-a716-446655440022';
  const initialNow = 1_700_000_000_000;
  let requestNow = initialNow;
  let resendCalls = 0;
  const failingFetch = async (url) => {
    if (String(url).includes('siteverify')) {
      return new Response(JSON.stringify({
        success: true,
        challenge_ts: new Date(requestNow).toISOString(),
        hostname: 'crelo.example',
        action: 'contact',
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    resendCalls += 1;
    return new Response('{"error":"delivery"}', { status: 500 });
  };

  try {
    for (let attempt = 0; attempt <= MAX_CONTACT_RETRY_ATTEMPTS + 1; attempt += 1) {
      requestNow = initialNow + attempt * 1_000;
      const response = await handleContactRequest(makeRequest({
        ...basePayload,
        requestId,
        turnstileToken: `turnstile-token-${attempt}`,
      }), {
        env,
        store,
        fetchImpl: failingFetch,
        now: () => requestNow,
      });
      assert.equal(response.status, attempt <= MAX_CONTACT_RETRY_ATTEMPTS ? 502 : 429);
    }
    assert.equal(resendCalls, 2 * (MAX_CONTACT_RETRY_ATTEMPTS + 1), 'the capped retry never reaches Resend');
    const row = d1.sqlite.prepare('SELECT status, retry_attempts FROM contact_requests WHERE request_id = ?').get(requestId);
    assert.equal(row.status, 'failed');
    assert.equal(row.retry_attempts, MAX_CONTACT_RETRY_ATTEMPTS);
  } finally {
    d1.sqlite.close();
  }
});

test('reconciles an email sent before a D1 status failure with a new token and the same key', async () => {
  const statuses = [];
  let failFirstSentUpdate = true;
  const store = {
    async reserveTurnstileAttempt() {
      return { kind: 'allowed' };
    },
    async reserve() {
      return { kind: 'reserved' };
    },
    async updateStatus(requestId, status) {
      statuses.push({ requestId, status });
      if (status === 'sent' && failFirstSentUpdate) {
        failFirstSentUpdate = false;
        throw new Error('simulated D1 status write failure');
      }
    },
  };
  const now = 1_700_000_000_000;
  const firstFetch = makeFetch({ challengeTs: new Date(now).toISOString() });
  const first = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440011' }), {
    env,
    store,
    fetchImpl: firstFetch.fetchImpl,
    now: () => now,
  });
  assert.equal(first.status, 503);
  const firstTurnstile = new URLSearchParams(firstFetch.calls[0].options.body);
  assert.equal(firstTurnstile.get('response'), 'turnstile-token');
  assert.equal(firstTurnstile.get('idempotency_key'), null);

  const secondFetch = makeFetch({ challengeTs: new Date(now).toISOString() });
  const second = await handleContactRequest(
    makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440011', turnstileToken: 'new-turnstile-token' }),
    { env, store, fetchImpl: secondFetch.fetchImpl, now: () => now },
  );
  assert.equal(second.status, 200);
  const secondTurnstile = new URLSearchParams(secondFetch.calls[0].options.body);
  assert.equal(secondTurnstile.get('response'), 'new-turnstile-token');
  assert.equal(secondTurnstile.get('idempotency_key'), null);
  assert.equal(firstFetch.calls[1].options.headers['Idempotency-Key'], '550e8400-e29b-41d4-a716-446655440011');
  assert.equal(secondFetch.calls[1].options.headers['Idempotency-Key'], '550e8400-e29b-41d4-a716-446655440011');
  assert.deepEqual(statuses, [
    { requestId: '550e8400-e29b-41d4-a716-446655440011', status: 'sent' },
    { requestId: '550e8400-e29b-41d4-a716-446655440011', status: 'sent' },
  ]);
});

test('logs D1 reserve and status failures with public fields only', async () => {
  const reserveEntries = [];
  const reserveFailure = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440017' }), {
    env,
    store: {
      async reserveTurnstileAttempt() {
        return { kind: 'allowed' };
      },
      async reserve() {
        throw new Error('private database detail');
      },
      async updateStatus() {},
    },
    fetchImpl: makeFetch().fetchImpl,
    logger: (entry) => reserveEntries.push(entry),
  });
  assert.equal(reserveFailure.status, 503);
  assert.deepEqual(reserveEntries, [{
    event: 'contact.store_reserve_failure',
    stage: 'store.reserve',
    requestId: '550e8400-e29b-41d4-a716-446655440017',
    errorCode: 'SERVICE_UNAVAILABLE',
  }]);

  const updateEntries = [];
  const updateFailure = await handleContactRequest(makeRequest({ ...basePayload, requestId: '550e8400-e29b-41d4-a716-446655440018' }), {
    env,
    store: {
      async reserveTurnstileAttempt() {
        return { kind: 'allowed' };
      },
      async reserve() {
        return { kind: 'reserved' };
      },
      async updateStatus() {
        throw new Error('private database detail');
      },
    },
    fetchImpl: makeFetch().fetchImpl,
    logger: (entry) => updateEntries.push(entry),
  });
  assert.equal(updateFailure.status, 503);
  assert.deepEqual(updateEntries, [{
    event: 'contact.store_update_failure',
    stage: 'store.updateStatus',
    requestId: '550e8400-e29b-41d4-a716-446655440018',
    errorCode: 'SERVICE_UNAVAILABLE',
  }]);
});

test('does not log secrets, tokens, request bodies, or private identifiers', async () => {
  const source = await readFile(new URL('../app/lib/contact-handler.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /console\.(log|info|warn|error)\s*\(/);
});

test('structured contact logger emits only public diagnostic fields', () => {
  const lines = [];
  const originalError = console.error;
  console.error = (line) => lines.push(line);
  try {
    createDefaultContactLogger()({
      event: 'contact.delivery_failure',
      stage: 'resend',
      requestId: '550e8400-e29b-41d4-a716-446655440016',
      errorCode: 'DELIVERY_FAILED',
    });
  } finally {
    console.error = originalError;
  }
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    event: 'contact.delivery_failure',
    stage: 'resend',
    requestId: '550e8400-e29b-41d4-a716-446655440016',
    errorCode: 'DELIVERY_FAILED',
  });
});

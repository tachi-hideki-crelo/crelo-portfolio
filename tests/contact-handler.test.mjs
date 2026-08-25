import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { handleContactRequest } from '../app/lib/contact-handler.ts';
import { createDefaultContactLogger } from '../app/lib/contact-logger.ts';

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
  return {
    statuses,
    async reserve(input) {
      return overrides.reserve ? overrides.reserve(input) : { kind: 'reserved' };
    },
    async updateStatus(requestId, status) {
      statuses.push({ requestId, status });
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
  const siteverifyBody = new URLSearchParams(mock.calls[0].options.body);
  assert.equal(siteverifyBody.get('idempotency_key'), null, 'Turnstile key is not reused across contact retries');
  assert.equal(mock.calls[1].options.headers['Idempotency-Key'], '550e8400-e29b-41d4-a716-446655440000');
  assert.equal(mock.calls[1].options.body.includes('turnstile-token'), false);
  assert.deepEqual(store.statuses, [{ requestId: '550e8400-e29b-41d4-a716-446655440000', status: 'sent' }]);

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

test('reconciles an email sent before a D1 status failure with a new token and the same key', async () => {
  const statuses = [];
  let failFirstSentUpdate = true;
  const store = {
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

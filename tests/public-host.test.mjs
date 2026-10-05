import assert from 'node:assert/strict';
import test from 'node:test';
import { isCanonicalRequest, withNoindexHeader } from '../app/lib/public-host.ts';

test('only the configured HTTPS origin is indexable', () => {
  assert.equal(isCanonicalRequest('https://crelo.dev/', 'https://crelo.dev'), true);
  assert.equal(isCanonicalRequest('https://crelo.dev/privacy', 'https://crelo.dev'), true);
  assert.equal(isCanonicalRequest('https://crelo-fde-portfolio-preview.crelo1119.workers.dev/', 'https://crelo.dev'), false);
  assert.equal(isCanonicalRequest('https://www.crelo.dev/', 'https://crelo.dev'), false);
  assert.equal(isCanonicalRequest('http://crelo.dev/', 'https://crelo.dev'), false);
  assert.equal(isCanonicalRequest('https://crelo.dev/', 'http://crelo.dev'), false);
  assert.equal(isCanonicalRequest('https://crelo.dev/', undefined), false);
});

test('fallback noindex header preserves normal and bodyless responses', async () => {
  const normal = withNoindexHeader(new Response('ready', { status: 200 }));
  assert.equal(normal.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  assert.equal(await normal.text(), 'ready');
  for (const status of [204, 205, 304]) {
    const bodyless = withNoindexHeader(new Response(null, { status }));
    assert.equal(bodyless.status, status);
    assert.equal(bodyless.body, null);
    assert.equal(bodyless.headers.get('X-Robots-Tag'), 'noindex, nofollow');
  }
});

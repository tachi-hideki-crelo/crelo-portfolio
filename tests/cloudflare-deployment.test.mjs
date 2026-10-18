import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { contentSecurityPolicy, renderHeadersFile, securityHeaders, serializeContentSecurityPolicy } from '../security-headers.ts';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
const viteSource = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const nextConfigSource = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');
const headersSource = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');

test('personal Cloudflare deployment uses the dedicated contact DB and daily cleanup', () => {
  assert.equal(config.name, 'crelo-fde-portfolio-preview');
  assert.equal(config.account_id, '3190db9afa5dd4f904afce396da579d8');
  assert.equal(config.main, './worker-entry.ts');
  assert.equal(config.workers_dev, true);
  assert.deepEqual(config.routes, [{ pattern: 'crelo.dev', custom_domain: true }]);
  assert.equal(config.compatibility_date, '2026-09-18');
  assert.deepEqual(config.compatibility_flags, ['nodejs_compat']);
  assert.deepEqual(config.d1_databases, [{
    binding: 'DB',
    database_name: 'crelo-portfolio-contact',
    database_id: 'a03899d2-8ea1-4b5e-a63b-78a06519475e',
    migrations_dir: 'drizzle',
  }]);
  assert.deepEqual(config.triggers.crons, ['0 3 * * *']);
  assert.deepEqual(config.vars, {
    CONTENT_MODE: 'production',
    SITE_ORIGIN: 'https://crelo.dev',
    CONTACT_TO_EMAIL: 'info@crelo.dev',
    CONTACT_FROM_EMAIL: 'contact@crelo.dev',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAFM5_8jUB8wFVC99',
  });
  assert.equal(scripts['build:cloudflare'], 'node scripts/build-cloudflare.mjs');
  assert.match(scripts['deploy:cloudflare'], /npm run build:cloudflare && WRANGLER_WRITE_LOGS=false WRANGLER_LOG_PATH=\.wrangler\/logs wrangler deploy --config dist\/server\/wrangler\.json/);
  assert.match(viteSource, /!deployToPersonalCloudflare \? \[sites\(\)\] : \[\]/);
  assert.match(viteSource, /config: localBindingConfig/);
  assert.match(nextConfigSource, /source: '\/\(\.\*\)'/);
  assert.match(nextConfigSource, /import \{ securityHeaders \} from '\.\/security-headers\.ts'/);
  assert.match(nextConfigSource, /\.\.\.securityHeaders/);
  assert.match(nextConfigSource, /X-Robots-Tag/);
});

test('public/_headers is generated from the shared security headers', () => {
  // Run `npm run sync:headers` after editing security-headers.ts.
  assert.equal(headersSource, renderHeadersFile());
  const policy = securityHeaders.find((header) => header.key === 'Content-Security-Policy');
  assert.ok(policy, 'Content-Security-Policy header is missing');
  assert.equal(policy.value, serializeContentSecurityPolicy(contentSecurityPolicy));
});

test('CSP allows Turnstile and Cloudflare Web Analytics without broad sources', () => {
  const scriptSrc = contentSecurityPolicy['script-src'];
  const connectSrc = contentSecurityPolicy['connect-src'];
  assert.ok(scriptSrc.includes('https://challenges.cloudflare.com'));
  assert.ok(scriptSrc.includes('https://static.cloudflareinsights.com'));
  assert.ok(connectSrc.includes('https://cloudflareinsights.com'));
  assert.deepEqual(contentSecurityPolicy['default-src'], ["'self'"]);
  assert.deepEqual(contentSecurityPolicy['frame-ancestors'], ["'none'"]);

  // No wildcard hosts or bare schemes anywhere.
  Object.entries(contentSecurityPolicy).forEach(([directive, sources]) => {
    sources.forEach((source) => assert.doesNotMatch(source, /\*|^https?:$|^wss?:$/, `${directive} allows ${source}`));
  });
  // Scripts and connections only from 'self' or explicit https hosts.
  [...scriptSrc, ...connectSrc].forEach((source) => {
    assert.ok(
      ["'self'", "'unsafe-inline'"].includes(source) || /^https:\/\/[a-z0-9.-]+$/.test(source),
      `unexpected script/connect source ${source}`,
    );
  });
  assert.ok(!scriptSrc.includes("'unsafe-eval'"));
});

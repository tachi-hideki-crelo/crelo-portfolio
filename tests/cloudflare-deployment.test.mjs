import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
const viteSource = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const nextConfigSource = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');

test('personal Cloudflare deployment stays noindex and contact-disabled until operational setup', () => {
  assert.equal(config.name, 'crelo-fde-portfolio-preview');
  assert.equal(config.main, 'vinext/server/app-router-entry');
  assert.equal(config.workers_dev, true);
  assert.equal(config.compatibility_date, '2026-09-18');
  assert.deepEqual(config.compatibility_flags, ['nodejs_compat']);
  assert.equal(config.d1_databases, undefined);
  assert.equal(config.vars, undefined);
  assert.match(scripts['build:cloudflare'], /CONTENT_MODE=preview CRELO_DEPLOY_TARGET=cloudflare npm run build/);
  assert.match(scripts['deploy:cloudflare'], /npm run build:cloudflare && WRANGLER_WRITE_LOGS=false WRANGLER_LOG_PATH=\.wrangler\/logs wrangler deploy --config dist\/server\/wrangler\.json/);
  assert.match(viteSource, /!deployToPersonalCloudflare \? \[sites\(\)\] : \[\]/);
  assert.match(viteSource, /config: localBindingConfig/);
  assert.match(nextConfigSource, /source: '\/\(\.\*\)'/);
  assert.match(nextConfigSource, /Content-Security-Policy/);
  assert.match(nextConfigSource, /X-Robots-Tag/);
});

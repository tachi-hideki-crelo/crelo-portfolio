import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
const viteSource = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');
const nextConfigSource = readFileSync(new URL('../next.config.ts', import.meta.url), 'utf8');

test('personal Cloudflare deployment uses the dedicated contact DB and daily cleanup', () => {
  assert.equal(config.name, 'crelo-fde-portfolio-preview');
  assert.equal(config.account_id, '3190db9afa5dd4f904afce396da579d8');
  assert.equal(config.main, './worker-entry.ts');
  assert.equal(config.workers_dev, true);
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
    SITE_ORIGIN: 'https://crelo-fde-portfolio-preview.crelo1119.workers.dev',
    CONTACT_TO_EMAIL: 'info@crelo.dev',
    CONTACT_FROM_EMAIL: 'contact@crelo.dev',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: '0x4AAAAAAFM5_8jUB8wFVC99',
  });
  assert.match(scripts['build:cloudflare'], /CONTENT_MODE=preview CRELO_DEPLOY_TARGET=cloudflare npm run build/);
  assert.match(scripts['deploy:cloudflare'], /npm run build:cloudflare && WRANGLER_WRITE_LOGS=false WRANGLER_LOG_PATH=\.wrangler\/logs wrangler deploy --config dist\/server\/wrangler\.json/);
  assert.match(viteSource, /!deployToPersonalCloudflare \? \[sites\(\)\] : \[\]/);
  assert.match(viteSource, /config: localBindingConfig/);
  assert.match(nextConfigSource, /source: '\/\(\.\*\)'/);
  assert.match(nextConfigSource, /Content-Security-Policy/);
  assert.match(nextConfigSource, /X-Robots-Tag/);
});

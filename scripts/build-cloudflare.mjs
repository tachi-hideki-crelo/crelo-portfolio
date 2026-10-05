import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const config = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
const vars = config.vars ?? {};
const expectedOrigin = 'https://crelo.dev';
if (vars.CONTENT_MODE !== 'production') {
  throw new Error('Cloudflare runtime must serve the approved public content mode');
}
if (vars.SITE_ORIGIN !== expectedOrigin) {
  throw new Error(`Cloudflare production origin must be ${expectedOrigin}`);
}
if (!config.routes?.some((route) => route.pattern === 'crelo.dev' && route.custom_domain === true)) {
  throw new Error('Cloudflare production route for crelo.dev is missing');
}

const result = spawnSync('npm', ['run', 'build'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...vars,
    CONTENT_MODE: 'production',
    CRELO_DEPLOY_TARGET: 'cloudflare',
  },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);

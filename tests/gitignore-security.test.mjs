import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

function isIgnored(path) {
  const result = spawnSync(
    'git',
    ['check-ignore', '--no-index', '--quiet', '--', path],
    { cwd: repositoryRoot, encoding: 'utf8' },
  );
  assert.equal(result.error, undefined, `git check-ignore failed for ${path}`);
  return result.status === 0;
}

test('ignores Wrangler local secret files at every directory depth', () => {
  for (const path of [
    '.dev.vars',
    '.dev.vars.preview',
    'nested/.dev.vars',
    'nested/deeper/.dev.vars.local',
  ]) {
    assert.equal(isIgnored(path), true, `${path} must be ignored`);
  }
});

test('does not broaden the Wrangler secret pattern to similarly named files', () => {
  for (const path of ['.dev.vars-example', 'nested/deeper/dev.vars']) {
    assert.equal(isIgnored(path), false, `${path} should not match the Wrangler secret pattern`);
  }
});

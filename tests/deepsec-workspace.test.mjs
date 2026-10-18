import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { permittedSourcePath, prepareSourceSnapshot } from '../.deepsec/prepare.mjs';
import { verifySourceSnapshot } from '../.deepsec/verify.mjs';
import { localSubscriptionEnv, readLocalPolicy, requireSubscriptionStatus, validateLocalRun, verifyOperationSnapshot } from '../.deepsec/run.mjs';

const localPolicy = { mode: 'local', provider: 'local', agent: 'codex', model: 'gpt-5.6-luna', thinkingLevel: 'xhigh' };

function fixture(run) {
  const root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'crelo-security-fixture-')));
  try {
    const workspace = path.join(root, '.deepsec');
    mkdirSync(workspace);
    copyFileSync(new URL('../.deepsec/SCAN_POLICY.md', import.meta.url), path.join(workspace, 'SCAN_POLICY.md'));
    execFileSync('git', ['init', '--quiet', root]);
    return run(root, workspace);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function snapshotFixture(run) {
  return fixture((root, workspace) => {
    writeFileSync(path.join(root, 'worker-entry.ts'), 'export const fixture = true;');
    execFileSync('git', ['add', 'worker-entry.ts'], { cwd: root });
    prepareSourceSnapshot(root, workspace);
    assert.equal(verifySourceSnapshot(workspace), 1);
    return run(root, workspace);
  });
}

test('DeepSec snapshot permits maintained sources but excludes secrets, media and unrelated work', () => {
  for (const file of ['app/page.tsx', 'db/contact-store.ts', '.github/workflows/pullfrog.yml', 'package.json']) {
    assert.equal(permittedSourcePath(file), true);
  }
  for (const file of ['.env', '.dev.vars', '.claude/settings.json', '.git/config', 'public/photo.jpg', 'node_modules/x.js', 'CONTENT_INTAKE.md', 'app/.env.ts', 'db/.dev.vars.ts', 'scripts/dev.vars.ts', 'app/nested/.env.production.json', 'app/.ENV.ts', 'app/node_modules/dependency.ts']) {
    assert.equal(permittedSourcePath(file), false);
  }
  fixture((root, workspace) => {
    mkdirSync(path.join(root, 'app'));
    writeFileSync(path.join(root, 'app/page.tsx'), 'export default function Page() { return null; }');
    writeFileSync(path.join(root, '.env'), 'NOT_A_REAL_SECRET=fixture');
    writeFileSync(path.join(root, 'app/untracked.ts'), 'untracked');
    execFileSync('git', ['add', 'app/page.tsx', '.env'], { cwd: root });
    const files = prepareSourceSnapshot(root, workspace);
    assert.deepEqual(files.map(({ file }) => file), ['app/page.tsx']);
    assert.match(files[0].sha256, /^[a-f0-9]{64}$/);
    assert.equal(existsSync(path.join(workspace, 'scan-target/.env')), false);
    assert.equal(existsSync(path.join(workspace, 'scan-target/app/untracked.ts')), false);
    assert.equal(readFileSync(path.join(workspace, 'scan-target/app/page.tsx'), 'utf8'), 'export default function Page() { return null; }');
  });
});

test('DeepSec refuses suspicious credential material without exposing it', () => fixture((root, workspace) => {
  const fake = `sk-proj-${'A'.repeat(30)}`;
  writeFileSync(path.join(root, 'worker-entry.ts'), `const example = '${fake}';`);
  execFileSync('git', ['add', 'worker-entry.ts'], { cwd: root });
  assert.throws(() => prepareSourceSnapshot(root, workspace), (error) => {
    assert.match(error.message, /Potential credential in worker-entry.ts/);
    assert.equal(error.message.includes(fake), false);
    return true;
  });
  assert.equal(existsSync(path.join(workspace, 'scan-target')), false);
}));

test('DeepSec rejects a tracked symlink before copying its target', () => fixture((root, workspace) => {
  writeFileSync(path.join(root, 'outside.txt'), 'private fixture');
  symlinkSync('../outside.txt', path.join(root, 'worker-entry.ts'));
  execFileSync('git', ['add', 'worker-entry.ts'], { cwd: root });
  assert.throws(() => prepareSourceSnapshot(root, workspace), /contained regular file/);
}));

test('DeepSec rejects shared source inodes before copying any private fixture contents', () => fixture((root, workspace) => {
  const sentinel = path.join(root, 'private-source.txt');
  writeFileSync(sentinel, 'arbitrary private fixture without a recognizable key prefix');
  linkSync(sentinel, path.join(root, 'worker-entry.ts'));
  execFileSync('git', ['add', 'worker-entry.ts'], { cwd: root });
  assert.throws(() => prepareSourceSnapshot(root, workspace), /Source must be an unshared contained regular file/);
  assert.equal(existsSync(path.join(workspace, 'scan-target')), false);
  assert.equal(existsSync(path.join(workspace, 'data')), false);
  assert.equal(readFileSync(sentinel, 'utf8'), 'arbitrary private fixture without a recognizable key prefix');
}));

test('DeepSec rejects a source directory redirected even to an unapproved directory inside the repo', () => fixture((root, workspace) => {
  mkdirSync(path.join(root, 'app'));
  writeFileSync(path.join(root, 'app/page.tsx'), 'approved source');
  execFileSync('git', ['add', 'app/page.tsx'], { cwd: root });
  renameSync(path.join(root, 'app'), path.join(root, 'original-app'));
  const privateDirectory = path.join(root, 'private-fixture');
  mkdirSync(privateDirectory);
  writeFileSync(path.join(privateDirectory, 'page.tsx'), 'not an approved source');
  symlinkSync(privateDirectory, path.join(root, 'app'));
  assert.throws(() => prepareSourceSnapshot(root, workspace), /Source must be an unshared contained regular file/);
  assert.equal(existsSync(path.join(workspace, 'scan-target')), false);
  assert.equal(existsSync(path.join(workspace, 'data')), false);
}));

test('DeepSec does not follow a symlinked output file', () => fixture((root, workspace) => {
  writeFileSync(path.join(root, 'worker-entry.ts'), 'source');
  execFileSync('git', ['add', 'worker-entry.ts'], { cwd: root });
  mkdirSync(path.join(workspace, 'scan-target'));
  const sentinel = path.join(root, 'preserve.txt');
  writeFileSync(sentinel, 'preserved');
  symlinkSync(sentinel, path.join(workspace, 'scan-target/worker-entry.ts'));
  assert.throws(() => prepareSourceSnapshot(root, workspace));
  assert.equal(readFileSync(sentinel, 'utf8'), 'preserved');
}));

test('DeepSec validates directory ancestors before creating any child directory', () => {
  for (const redirected of ['data', 'scan-target/app']) {
    fixture((root, workspace) => {
      mkdirSync(path.join(root, 'app/nested'), { recursive: true });
      writeFileSync(path.join(root, 'app/nested/page.tsx'), 'source');
      execFileSync('git', ['add', 'app/nested/page.tsx'], { cwd: root });
      const outside = path.join(root, 'outside');
      mkdirSync(outside);
      if (redirected.startsWith('scan-target/')) mkdirSync(path.join(workspace, 'scan-target'));
      symlinkSync(outside, path.join(workspace, redirected));
      assert.throws(() => prepareSourceSnapshot(root, workspace), /must not contain symlinks/);
      assert.equal(existsSync(path.join(outside, 'nested')), false);
      assert.equal(existsSync(path.join(outside, 'crelo-portfolio')), false);
    });
  }
});

test('DeepSec refuses hardlinked output files without overwriting the other name', () => fixture((root, workspace) => {
  writeFileSync(path.join(root, 'worker-entry.ts'), 'source');
  execFileSync('git', ['add', 'worker-entry.ts'], { cwd: root });
  mkdirSync(path.join(workspace, 'scan-target'));
  const outside = path.join(root, 'preserve.txt');
  writeFileSync(outside, 'preserved');
  linkSync(outside, path.join(workspace, 'scan-target/worker-entry.ts'));
  assert.throws(() => prepareSourceSnapshot(root, workspace), /unshared regular file/);
  assert.equal(readFileSync(outside, 'utf8'), 'preserved');
}));

test('DeepSec validates its policy before reading or creating the source snapshot', () => {
  for (const kind of ['symlink', 'hardlink', 'directory']) {
    fixture((root, workspace) => {
      writeFileSync(path.join(root, 'worker-entry.ts'), 'source');
      execFileSync('git', ['add', 'worker-entry.ts'], { cwd: root });
      const policy = path.join(workspace, 'SCAN_POLICY.md');
      renameSync(policy, path.join(root, 'original-policy.md'));
      const sentinel = path.join(root, 'private-fixture.txt');
      writeFileSync(sentinel, 'not approved policy content');
      if (kind === 'symlink') symlinkSync(sentinel, policy);
      else if (kind === 'hardlink') linkSync(sentinel, policy);
      else mkdirSync(policy);
      assert.throws(() => prepareSourceSnapshot(root, workspace), /policy must be an unshared contained regular file/);
      assert.equal(existsSync(path.join(workspace, 'scan-target')), false);
      assert.equal(existsSync(path.join(workspace, 'data')), false);
      assert.equal(readFileSync(sentinel, 'utf8'), 'not approved policy content');
    });
  }
});

test('DeepSec verification rejects modified sources, extra files and altered review policy', () => {
  for (const file of ['scan-target/worker-entry.ts', 'scan-target/extra.txt', 'scan-target/AGENTS.md', 'scan-target/.git']) {
    snapshotFixture((_root, workspace) => {
      writeFileSync(path.join(workspace, file), 'changed fixture');
      assert.throws(() => verifySourceSnapshot(workspace), /changed during analysis|Unexpected snapshot file/);
    });
  }
});

test('DeepSec sanitized copy cannot discover the original parent Git repository', () => snapshotFixture((_root, workspace) => {
  assert.throws(() => execFileSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: path.join(workspace, 'scan-target'), stdio: 'pipe',
  }), /not a git repository/);
}));

test('DeepSec analysis operations enforce snapshot verification before starting', () => snapshotFixture((_root, workspace) => {
  for (const operation of ['scan', 'process', 'revalidate']) {
    assert.doesNotThrow(() => verifyOperationSnapshot([operation], workspace));
  }
  writeFileSync(path.join(workspace, 'scan-target/worker-entry.ts'), 'altered source');
  for (const operation of ['scan', 'process', 'revalidate']) {
    assert.throws(() => verifyOperationSnapshot([operation], workspace), /Snapshot changed during analysis/);
  }
}));

test('DeepSec parent-held digest detects a forged manifest/list and simultaneous policy rewrites', () => {
  snapshotFixture((root, workspace) => {
    mkdirSync(path.join(root, 'app'));
    writeFileSync(path.join(root, 'app/page.tsx'), 'export default function Page() { return null; }');
    execFileSync('git', ['add', 'app/page.tsx'], { cwd: root });
    prepareSourceSnapshot(root, workspace);
    const digest = verifyOperationSnapshot(['process'], workspace);
    const manifestPath = path.join(workspace, 'data/crelo-portfolio/manifest.json');
    const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const removed = parsed.files.pop();
    rmSync(path.join(workspace, 'scan-target', removed.file));
    writeFileSync(manifestPath, JSON.stringify(parsed));
    writeFileSync(path.join(workspace, 'data/crelo-portfolio/source-files.txt'), `${parsed.files.map(({ file }) => file).join('\n')}\n`);
    assert.equal(verifySourceSnapshot(workspace), 1);
    assert.throws(() => verifyOperationSnapshot(['process'], workspace, digest), /verification record changed/);
  });
  snapshotFixture((_root, workspace) => {
    const digest = verifyOperationSnapshot(['process'], workspace);
    writeFileSync(path.join(workspace, 'SCAN_POLICY.md'), 'altered policy');
    writeFileSync(path.join(workspace, 'scan-target/AGENTS.md'), 'altered policy');
    assert.throws(() => verifyOperationSnapshot(['process'], workspace, digest), /verification record changed/);
  });
});

test('DeepSec checks the exact submitted source list, not only the source hashes', () => snapshotFixture((_root, workspace) => {
  writeFileSync(path.join(workspace, 'data/crelo-portfolio/source-files.txt'), '');
  assert.throws(() => verifySourceSnapshot(workspace), /source list does not match/);
}));

test('DeepSec verification rejects symlinked artifact roots, manifests and policy before reading', () => {
  for (const relative of ['scan-target', 'data', 'data/crelo-portfolio', 'data/crelo-portfolio/manifest.json', 'SCAN_POLICY.md']) {
    snapshotFixture((root, workspace) => {
      const original = path.join(workspace, relative);
      const moved = path.join(root, 'moved-artifact');
      renameSync(original, moved);
      symlinkSync(moved, original);
      assert.throws(() => verifySourceSnapshot(workspace), /contained regular paths/);
    });
  }
});

test('DeepSec verification refuses shared source, policy and metadata inodes before reading', () => {
  for (const relative of [
    'scan-target/worker-entry.ts', 'scan-target/AGENTS.md', 'scan-target/.git',
    'SCAN_POLICY.md', 'data/crelo-portfolio/manifest.json', 'data/crelo-portfolio/source-files.txt',
  ]) {
    snapshotFixture((root, workspace) => {
      const original = path.join(workspace, relative);
      const outside = path.join(root, 'shared-private-fixture');
      renameSync(original, outside);
      linkSync(outside, original);
      assert.throws(() => verifySourceSnapshot(workspace), /contained regular paths/);
    });
  }
});

test('DeepSec verification rejects duplicate, traversing and invalid manifest entries', () => {
  for (const change of [
    (files) => [...files, files[0]],
    (files) => [{ ...files[0], file: 'app/../../private.ts' }],
    (files) => [{ ...files[0], sha256: 'invalid' }],
  ]) {
    snapshotFixture((_root, workspace) => {
      const manifest = path.join(workspace, 'data/crelo-portfolio/manifest.json');
      const parsed = JSON.parse(readFileSync(manifest, 'utf8'));
      writeFileSync(manifest, JSON.stringify({ files: change(parsed.files) }));
      assert.throws(() => verifySourceSnapshot(workspace), /Unsafe manifest entry/);
    });
  }
});

test('DeepSec subscription environment cannot inherit provider credentials, custom endpoints or Node hooks', () => {
  const clean = localSubscriptionEnv({
    PATH: '/fixture/bin', HOME: '/fixture/user', CODEX_HOME: '/fixture/codex', LANG: 'ja_JP.UTF-8',
    OPENAI_API_KEY: 'fake', ANTHROPIC_API_KEY: 'fake', AI_GATEWAY_API_KEY: 'fake',
    DEEPSEEK_API_KEY: 'fake', GOOGLE_API_KEY: 'fake', AWS_SECRET_ACCESS_KEY: 'fake',
    OPENAI_BASE_URL: 'https://invalid.example', ANTHROPIC_BASE_URL: 'https://invalid.example',
    NODE_OPTIONS: '--require /fixture/hook.js', DEEPSEC_INSIDE_SANDBOX: '1',
    LOGNAME: undefined,
  });
  assert.deepEqual(clean, { PATH: '/fixture/bin', HOME: '/fixture/user', CODEX_HOME: '/fixture/codex', LANG: 'ja_JP.UTF-8' });
});

test('DeepSec accepts only verified ChatGPT login metadata and never echoes API credential status', () => {
  assert.doesNotThrow(() => requireSubscriptionStatus({ status: 0, stdout: '', stderr: 'Logged in using ChatGPT' }));
  for (const result of [
    { status: 1, stderr: 'Not logged in' },
    { status: 0, stdout: 'Logged in using API key: fake-private-value' },
    { status: null, stderr: '' },
  ]) {
    assert.throws(() => requireSubscriptionStatus(result), (error) => {
      assert.match(error.message, /verified ChatGPT Codex login/);
      assert.equal(error.message.includes('fake-private-value'), false);
      return true;
    });
  }
});

test('DeepSec reads policy only from an unshared canonical file and suppresses parse contents', () => {
  fixture((_root, workspace) => {
    writeFileSync(path.join(workspace, 'local-policy.json'), JSON.stringify(localPolicy));
    assert.deepEqual(readLocalPolicy(workspace), localPolicy);
  });
  for (const kind of ['symlink', 'hardlink', 'directory', 'malformed']) {
    fixture((root, workspace) => {
      const sentinel = path.join(root, 'private-policy-fixture');
      writeFileSync(sentinel, 'private fixture value that must not be echoed');
      const policy = path.join(workspace, 'local-policy.json');
      if (kind === 'symlink') symlinkSync(sentinel, policy);
      else if (kind === 'hardlink') linkSync(sentinel, policy);
      else if (kind === 'directory') mkdirSync(policy);
      else writeFileSync(policy, 'private fixture value that must not be echoed');
      assert.throws(() => readLocalPolicy(workspace), (error) => {
        assert.equal(error.message, 'Invalid scanner local policy');
        return true;
      });
    });
  }
});

test('DeepSec runner fails closed on provider overrides, unsupported operations and credential files', () => fixture((_root, workspace) => {
  assert.doesNotThrow(() => validateLocalRun(localPolicy, ['process', '--project-id', 'crelo-portfolio'], workspace));
  for (const field of Object.keys(localPolicy)) {
    assert.throws(() => validateLocalRun({ ...localPolicy, [field]: 'unreviewed' }, ['process'], workspace), /Only the reviewed/);
  }
  for (const option of ['--ai-provider', '--ai-mode=cloud', '--ai-api-key=fake', '--agent', '--agent=pi', '--model', '--model-auth=api-key', '--thinking-level=low', '--root=/outside', '--config=/outside/config.ts']) {
    assert.throws(() => validateLocalRun(localPolicy, ['process', option], workspace), /overrides require/);
  }
  assert.throws(() => validateLocalRun(localPolicy, ['init'], workspace), /Unsupported security operation/);
  writeFileSync(path.join(workspace, '.env.local'), 'FAKE_FIXTURE=not-a-key');
  assert.throws(() => validateLocalRun(localPolicy, ['process'], workspace), /credential file/);
}));

test('DeepSec uses operation-specific argv allowlists and one fixed project and output scope', () => snapshotFixture((_root, workspace) => {
  mkdirSync(path.join(workspace, 'node_modules'));
  assert.doesNotThrow(() => validateLocalRun(localPolicy, ['process', '--project-id=crelo-portfolio', '--files-from', 'data/crelo-portfolio/source-files.txt', '--concurrency=2', '--batch-size', '6', '--max-turns=40', '--no-ignore'], workspace));
  assert.doesNotThrow(() => validateLocalRun(localPolicy, ['export', '--project-id', 'crelo-portfolio', '--format=json', '--include-resolved', '--out', 'data/crelo-portfolio/reports/final.json'], workspace));
  for (const argv of [
    ['process', '--provider=cloud'], ['process', '--base-url=https://invalid.example'],
    ['process', '--api-key=fake'], ['process', '--auth-token=fake'], ['process', '--env-file=.env'],
    ['process', '--project-id=other'], ['process', '--project-id', 'crelo-portfolio', '--project-id=crelo-portfolio'],
    ['process', '--files-from=/outside/list'], ['process', '--files-from', 'data/crelo-portfolio/../other.txt'],
    ['process', '--concurrency=3'], ['process', '--batch-size=100'], ['process', '--max-turns=100'],
    ['revalidate', '--force=false'], ['report', '--out=/outside/file'],
    ['export', '--format=html'], ['export', '--out=../../outside.json'], ['export', '--out=data/crelo-portfolio/reports/nested/output.json'],
    ['status', '--files-from=data/crelo-portfolio/source-files.txt'], ['scan', 'unexpected-positional'],
  ]) assert.throws(() => validateLocalRun(localPolicy, argv, workspace));
}));

test('DeepSec refuses all local credential-file variants and redirected project metadata', () => {
  for (const name of ['.env', '.env.local', '.env.production', '.ENV.local', '.dev.vars', '.dev.vars.preview', 'dev.vars.ts']) {
    fixture((_root, workspace) => {
      writeFileSync(path.join(workspace, name), 'fake fixture');
      assert.throws(() => validateLocalRun(localPolicy, ['status'], workspace), /credential file/);
    });
  }
  snapshotFixture((_root, workspace) => {
    writeFileSync(path.join(workspace, 'data/crelo-portfolio/project.json'), JSON.stringify({ rootPath: '/unapproved' }));
    assert.throws(() => validateLocalRun(localPolicy, ['process'], workspace), /project root is outside/);
  });
  snapshotFixture((root, workspace) => {
    const outside = path.join(root, 'shared-project.json');
    writeFileSync(outside, JSON.stringify({ rootPath: path.join(workspace, 'scan-target') }));
    linkSync(outside, path.join(workspace, 'data/crelo-portfolio/project.json'));
    assert.throws(() => validateLocalRun(localPolicy, ['status'], workspace), /Invalid scanner project metadata/);
  });
  for (const name of ['.env.local', '.dev.vars.preview', 'dev.vars.ts']) {
    fixture((_root, workspace) => {
      mkdirSync(path.join(workspace, 'nested/deeper'), { recursive: true });
      writeFileSync(path.join(workspace, 'nested/deeper', name), 'fake fixture');
      assert.throws(() => validateLocalRun(localPolicy, ['status'], workspace), /credential file/);
    });
  }
});

test('DeepSec refuses redirected or dangling report destinations without writing outside', () => snapshotFixture((root, workspace) => {
  const reports = path.join(workspace, 'data/crelo-portfolio/reports');
  mkdirSync(reports);
  symlinkSync(path.join(root, 'nonexistent-outside.json'), path.join(reports, 'final.json'));
  assert.throws(() => validateLocalRun(localPolicy, ['export', '--format=json', '--out=data/crelo-portfolio/reports/final.json'], workspace), /must not contain symlinks/);
  assert.equal(existsSync(path.join(root, 'nonexistent-outside.json')), false);
}));

test('DeepSec refuses hardlinked or non-file report destinations before export', () => {
  for (const kind of ['hardlink', 'directory']) {
    snapshotFixture((root, workspace) => {
      const reports = path.join(workspace, 'data/crelo-portfolio/reports');
      mkdirSync(reports);
      const output = path.join(reports, 'final.json');
      const sentinel = path.join(root, 'preserve-export.json');
      writeFileSync(sentinel, 'preserved fixture');
      if (kind === 'hardlink') linkSync(sentinel, output);
      else mkdirSync(output);
      assert.throws(
        () => validateLocalRun(localPolicy, ['export', '--format=json', '--out=data/crelo-portfolio/reports/final.json'], workspace),
        /report output must be an unshared regular file/,
      );
      assert.equal(readFileSync(sentinel, 'utf8'), 'preserved fixture');
    });
  }
});

test('DeepSec runtime revalidation logs and local context are ignored', () => {
  const ignored = execFileSync('git', ['check-ignore', '--', '.deepsec/data/crelo-portfolio/revalidation/session.jsonl', '.deepsec/data/crelo-portfolio/INFO.md'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
  }).trim().split('\n');
  assert.equal(ignored.length, 2);
});

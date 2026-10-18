import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootFiles = new Set([
  'package.json', 'next.config.ts', 'vite.config.ts', 'drizzle.config.ts',
  'worker-entry.ts', 'wrangler.jsonc', 'security-headers.ts', 'eslint.config.mjs',
  'tsconfig.json', 'public/_headers', '.gitignore',
]);
export const credentialPathSegment = (name) => /^(?:\.env|\.?dev\.vars)/i.test(name);
export const sensitivePathSegment = (name) => credentialPathSegment(name)
  || ['.git', '.claude', '.deepsec', 'node_modules'].includes(name);
export const permittedSourcePath = (file) => typeof file === 'string'
  && !file.split('/').some(sensitivePathSegment) && (rootFiles.has(file) || (
  /^(?:app|db|lib|scripts|drizzle|vendor\/braces|\.github\/workflows)\//.test(file) &&
  /\.(?:ts|tsx|js|mjs|sql|json|yml|yaml|css)$/.test(file) &&
  !file.startsWith('drizzle/meta/')
));
// Reject suspicious credential material before copying or invoking an AI agent.
// Only the path is reported; the matching value is never printed.
const credentialMaterial = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-proj-|sk-ant-|ghp_|github_pat_)[A-Za-z0-9_-]{20,}/;
// Stop Git from discovering the original repository above this sanitized copy.
// This points to no repository and contains no original Git metadata/history.
export const snapshotGitBoundary = 'gitdir: ./__deepsec_git_access_disabled__\n';

export function readUnsharedFile(file, failureMessage) {
  const entry = lstatSync(file);
  if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1
    || realpathSync(file) !== file) {
    throw new Error(failureMessage);
  }
  const descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const opened = fstatSync(descriptor);
    if (!opened.isFile() || opened.nlink !== 1
      || opened.dev !== entry.dev || opened.ino !== entry.ino
      || realpathSync(file) !== file) {
      throw new Error(failureMessage);
    }
    return readFileSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function safeWrite(file, contents) {
  const existing = lstatSync(file, { throwIfNoEntry: false });
  if (existing && (!existing.isFile() || existing.isSymbolicLink() || existing.nlink !== 1)) {
    throw new Error('Snapshot output must be an unshared regular file');
  }
  writeFileSync(file, contents, {
    flag: constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
    mode: 0o600,
  });
}

function ensureContainedDirectory(base, relative) {
  let current = base;
  for (const name of relative.split('/').filter(Boolean)) {
    if (name === '.' || name === '..') throw new Error('Unsafe snapshot directory');
    current = path.join(current, name);
    const entry = lstatSync(current, { throwIfNoEntry: false });
    if (entry) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || realpathSync(current) !== current) {
        throw new Error('Snapshot directories must not contain symlinks');
      }
    } else mkdirSync(current);
  }
  return current;
}

export function prepareSourceSnapshot(root, workspace) {
  const realRoot = realpathSync(root);
  const realWorkspace = realpathSync(workspace);
  if (lstatSync(workspace).isSymbolicLink()) throw new Error('Workspace must not be a symlink');
  if (path.dirname(realWorkspace) !== realRoot) throw new Error('Workspace must be directly inside the project');
  const policyPath = path.join(realWorkspace, 'SCAN_POLICY.md');
  const policyContents = readUnsharedFile(policyPath, 'Snapshot policy must be an unshared contained regular file');
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: realRoot, encoding: 'utf8' })
    .split('\0').filter(Boolean).filter(permittedSourcePath).sort();
  if (tracked.length === 0) throw new Error('No approved tracked source files');
  const sources = tracked.map((file) => {
    if (path.isAbsolute(file) || file.split('/').includes('..')) throw new Error('Unsafe tracked path');
    const source = path.join(realRoot, file);
    const contents = readUnsharedFile(source, `Source must be an unshared contained regular file: ${file}`);
    if (contents.length > 512 * 1024) throw new Error(`Oversized source: ${file}`);
    if (credentialMaterial.test(contents.toString('utf8'))) throw new Error(`Potential credential in ${file}; review locally`);
    return { file, contents, sha256: createHash('sha256').update(contents).digest('hex') };
  });
  const data = ensureContainedDirectory(realWorkspace, 'data/crelo-portfolio');
  const target = ensureContainedDirectory(realWorkspace, 'scan-target');
  for (const { file, contents } of sources) {
    const destination = path.join(target, file);
    ensureContainedDirectory(target, path.dirname(file) === '.' ? '' : path.dirname(file));
    safeWrite(destination, contents);
  }
  const manifest = sources.map(({ file, sha256 }) => ({ file, sha256 }));
  safeWrite(path.join(target, '.git'), snapshotGitBoundary);
  safeWrite(path.join(target, 'AGENTS.md'), policyContents);
  safeWrite(path.join(data, 'manifest.json'), `${JSON.stringify({ files: manifest }, null, 2)}\n`);
  safeWrite(path.join(data, 'source-files.txt'), `${manifest.map(({ file }) => file).join('\n')}\n`);
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const workspace = path.dirname(fileURLToPath(import.meta.url));
  const manifest = prepareSourceSnapshot(path.dirname(workspace), workspace);
  console.log(`Prepared ${manifest.length} approved source files; no secrets, media, dependencies or Git history copied.`);
}

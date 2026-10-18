import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureSourceSnapshot } from './verify.mjs';
import { credentialPathSegment, readUnsharedFile } from './prepare.mjs';

const workspace = path.dirname(fileURLToPath(import.meta.url));
const operations = new Set(['scan', 'process', 'revalidate', 'report', 'status', 'export']);
const commonOptions = { '--project-id': (value) => value === 'crelo-portfolio' };
const batchOptions = {
  '--concurrency': (value) => /^(?:1|2)$/.test(value),
  '--batch-size': (value) => /^[1-6]$/.test(value),
  '--max-turns': (value) => /^(?:[1-9]|[1-3][0-9]|40)$/.test(value),
};
const optionRules = {
  scan: commonOptions,
  status: commonOptions,
  report: commonOptions,
  process: { ...commonOptions, ...batchOptions, '--files-from': (value) => value === 'data/crelo-portfolio/source-files.txt', '--no-ignore': null },
  revalidate: { ...commonOptions, ...batchOptions, '--force': null },
  export: { ...commonOptions, '--format': (value) => value === 'json', '--include-resolved': null, '--out': (value) => /^data\/crelo-portfolio\/reports\/[a-z0-9][a-z0-9_-]{0,79}\.json$/.test(value) },
};
const inheritedNames = new Set([
  'PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'TERM', 'TZ', 'LANG', 'LANGUAGE',
  'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'TMP', 'TEMP', 'CODEX_HOME',
]);

export function localSubscriptionEnv(input) {
  return Object.fromEntries(Object.entries(input).filter(([key, value]) => inheritedNames.has(key) && typeof value === 'string'));
}

export function requireSubscriptionStatus(result) {
  if (result.status !== 0 || !/\bLogged in using ChatGPT\b/i.test(`${result.stdout ?? ''}\n${result.stderr ?? ''}`)) {
    throw new Error('A verified ChatGPT Codex login is required; API-key authentication is not authorized');
  }
}

export function readLocalPolicy(directory = workspace) {
  try {
    return JSON.parse(readUnsharedFile(path.join(directory, 'local-policy.json'), 'Invalid scanner local policy').toString('utf8'));
  } catch {
    throw new Error('Invalid scanner local policy');
  }
}

function validateArtifactPath(relative, directory, unsharedOutput = false) {
  if (realpathSync(directory) !== directory) throw new Error('Scanner workspace must be canonical');
  let current = directory;
  for (const name of relative.split('/')) {
    current = path.join(current, name);
    const entry = lstatSync(current, { throwIfNoEntry: false });
    if (entry && (entry.isSymbolicLink() || realpathSync(current) !== current)) {
      throw new Error('Scanner artifact path must not contain symlinks');
    }
    if (unsharedOutput && current === path.join(directory, relative)
      && entry && (!entry.isFile() || entry.nlink !== 1)) {
      throw new Error('Scanner report output must be an unshared regular file');
    }
  }
}

function rejectCredentialFiles(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    if (credentialPathSegment(entry.name)) {
      throw new Error('Remove the local scanner credential file before using subscription-only mode');
    }
    if (entry.isSymbolicLink()) throw new Error('Scanner workspace must not contain redirected entries');
    if (entry.isDirectory()) rejectCredentialFiles(path.join(directory, entry.name));
  }
}

export function validateLocalRun(policy, args, directory = workspace) {
  if (policy?.mode !== 'local' || policy?.provider !== 'local' || policy?.agent !== 'codex'
    || policy?.model !== 'gpt-5.6-luna' || policy?.thinkingLevel !== 'xhigh') {
    throw new Error('Only the reviewed local Codex subscription policy is authorized');
  }
  if (!operations.has(args[0])) throw new Error('Unsupported security operation');
  const rules = optionRules[args[0]];
  const seen = new Set();
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index];
    const split = arg.indexOf('=');
    const flag = split === -1 ? arg : arg.slice(0, split);
    if (seen.has(flag)) throw new Error('Duplicate scanner option');
    seen.add(flag);
    if (['--help', '-h'].includes(flag) && split === -1) continue;
    if (!Object.hasOwn(rules, flag)) throw new Error('Unsupported scanner option; overrides require separate review');
    const validate = rules[flag];
    if (validate === null) {
      if (split !== -1) throw new Error('Invalid scanner flag value');
      continue;
    }
    const value = split === -1 ? args[++index] : arg.slice(split + 1);
    if (typeof value !== 'string' || !validate(value)) throw new Error('Scanner option value is outside the approved scope');
    if (['--files-from', '--out'].includes(flag)) validateArtifactPath(value, directory, flag === '--out');
  }
  rejectCredentialFiles(directory);
  const project = 'data/crelo-portfolio/project.json';
  validateArtifactPath(project, directory);
  if (existsSync(path.join(directory, project))) {
    let config;
    try { config = JSON.parse(readUnsharedFile(path.join(directory, project), 'Invalid scanner project metadata').toString('utf8')); }
    catch { throw new Error('Invalid scanner project metadata'); }
    if (config.rootPath !== path.join(directory, 'scan-target')) throw new Error('Scanner project root is outside the approved snapshot');
  }
}

export function verifyOperationSnapshot(args, directory = workspace, expectedDigest) {
  if (!['scan', 'process', 'revalidate'].includes(args[0])) return undefined;
  const { digest } = captureSourceSnapshot(directory);
  if (expectedDigest !== undefined && expectedDigest !== digest) {
    throw new Error('Snapshot verification record changed during analysis');
  }
  return digest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const policy = readLocalPolicy();
  validateLocalRun(policy, args);
  const snapshotDigest = verifyOperationSnapshot(args);
  if (['process', 'revalidate'].includes(args[0])) {
    requireSubscriptionStatus(spawnSync('codex', ['login', 'status'], {
      encoding: 'utf8', env: localSubscriptionEnv(process.env), timeout: 10_000,
    }));
  }
  const result = spawnSync(process.execPath, [path.join(workspace, 'node_modules/deepsec/dist/cli.mjs'), ...args], {
    cwd: workspace,
    stdio: 'inherit',
    env: localSubscriptionEnv(process.env),
  });
  verifyOperationSnapshot(args, workspace, snapshotDigest);
  if (result.error) throw new Error('DeepSec could not start');
  process.exit(result.status ?? 2);
}

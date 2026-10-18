import { createHash } from 'node:crypto';
import { lstatSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { permittedSourcePath, readUnsharedFile, snapshotGitBoundary } from './prepare.mjs';

const artifactFailure = 'Security artifacts must be contained regular paths, not symlinks or shared hardlinks';
const readArtifact = (pathname) => readUnsharedFile(pathname, artifactFailure);

function requireRegular(pathname, directory) {
  const entry = lstatSync(pathname);
  if (entry.isSymbolicLink() || realpathSync(pathname) !== pathname
    || (directory ? !entry.isDirectory() : !entry.isFile() || entry.nlink !== 1)) {
    throw new Error(artifactFailure);
  }
}

export function captureSourceSnapshot(directory) {
  const workspace = path.resolve(directory);
  const target = path.join(workspace, 'scan-target');
  const data = path.join(workspace, 'data');
  const project = path.join(data, 'crelo-portfolio');
  for (const pathname of [workspace, target, data, project]) requireRegular(pathname, true);
  const manifest = path.join(project, 'manifest.json');
  requireRegular(manifest, false);
  const sourceList = path.join(project, 'source-files.txt');
  requireRegular(sourceList, false);
  let files;
  try { ({ files } = JSON.parse(readArtifact(manifest).toString('utf8'))); }
  catch { throw new Error('Invalid source manifest'); }
  if (!Array.isArray(files) || files.length === 0) throw new Error('Missing source manifest');
  const allowed = new Set(['AGENTS.md', '.git']);
  for (const { file, sha256 } of files) {
    if (typeof file !== 'string' || !permittedSourcePath(file) || file.split('/').includes('..')
      || allowed.has(file) || !/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Unsafe manifest entry');
    allowed.add(file);
    const source = path.join(target, file);
    requireRegular(source, false);
    if (createHash('sha256').update(readArtifact(source)).digest('hex') !== sha256) {
      throw new Error(`Snapshot changed during analysis: ${file}`);
    }
  }
  const sourceListContents = readArtifact(sourceList).toString('utf8');
  if (sourceListContents !== `${files.map(({ file }) => file).join('\n')}\n`) {
    throw new Error('Snapshot source list does not match its manifest');
  }
  function inspect(folder) {
    for (const name of readdirSync(folder)) {
      const pathname = path.join(folder, name);
      const entry = lstatSync(pathname);
      if (entry.isSymbolicLink()) throw new Error('Unexpected snapshot symlink');
      if (entry.isDirectory()) inspect(pathname);
      else if (!allowed.has(path.relative(target, pathname).split(path.sep).join('/'))) throw new Error('Unexpected snapshot file');
    }
  }
  inspect(target);
  requireRegular(path.join(target, '.git'), false);
  if (readArtifact(path.join(target, '.git')).toString('utf8') !== snapshotGitBoundary) {
    throw new Error('Snapshot Git boundary changed during analysis');
  }
  requireRegular(path.join(target, 'AGENTS.md'), false);
  requireRegular(path.join(workspace, 'SCAN_POLICY.md'), false);
  const policyContents = readArtifact(path.join(workspace, 'SCAN_POLICY.md'));
  if (!readArtifact(path.join(target, 'AGENTS.md')).equals(policyContents)) {
    throw new Error('Snapshot review policy changed during analysis');
  }
  const policyDigest = createHash('sha256').update(policyContents).digest('hex');
  const digest = createHash('sha256').update(JSON.stringify({ workspace, files, policyDigest, sourceListContents, snapshotGitBoundary })).digest('hex');
  return Object.freeze({ count: files.length, digest });
}

export function verifySourceSnapshot(directory, expectedDigest) {
  const record = captureSourceSnapshot(directory);
  if (expectedDigest !== undefined && expectedDigest !== record.digest) {
    throw new Error('Snapshot verification record changed during analysis');
  }
  return record.count;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = verifySourceSnapshot(path.dirname(fileURLToPath(import.meta.url)));
  console.log(`Verified ${count} unchanged source hashes and review policy.`);
}

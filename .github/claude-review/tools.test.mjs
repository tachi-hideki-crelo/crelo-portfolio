// 読み取り専用ツールが、PR のチェックアウトと差分ファイルの外を読めないことを確かめる。
// 実行: node --test .github/claude-review/tools.test.mjs（npm ci --prefix .github/claude-review の後）
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createRepoReaders } from './tools.mjs';

function fixture() {
  const base = mkdtempSync(path.join(tmpdir(), 'repo-tools-'));
  const root = path.join(base, 'repo');
  mkdirSync(path.join(root, 'src'), { recursive: true });
  writeFileSync(path.join(root, 'src', 'a.js'), 'const token = 1;\nconsole.log(token);\n');
  writeFileSync(path.join(base, 'outside.txt'), 'SECRET-OUTSIDE');
  symlinkSync(path.join(base, 'outside.txt'), path.join(root, 'link-out'));
  symlinkSync('/proc/self/environ', path.join(root, 'link-environ'));
  const diffPath = path.join(base, 'pr.diff');
  writeFileSync(diffPath, 'diff --git a/src/a.js b/src/a.js\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '-A'], { cwd: root });
  return { base, root, diffPath, readers: createRepoReaders({ root, diffPath }) };
}

test('チェックアウト内のファイルと差分ファイルは読める', () => {
  const { readers, diffPath } = fixture();
  assert.match(readers.readFile({ path: 'src/a.js' }), /^1\tconst token = 1;/);
  assert.match(readers.readFile({ path: diffPath }), /diff --git/);
  assert.match(readers.readFile({ path: 'src/a.js', offset: 2, limit: 1 }), /^2\tconsole\.log/);
});

test('外側のパス・../・シンボリックリンク・/proc は読めない', () => {
  const { readers, base } = fixture();
  for (const requested of ['/proc/self/environ', '/etc/hostname', '../outside.txt', path.join(base, 'outside.txt'), 'link-out', 'link-environ', '/']) {
    assert.throws(() => readers.readFile({ path: requested }), /読めるのは|見つかりません|ファイルではありません/, requested);
  }
});

test('search はシンボリックリンクをたどらず、外側の内容を返さない', () => {
  const { readers } = fixture();
  assert.equal(readers.search({ text: 'SECRET-OUTSIDE' }), '一致なし');
  assert.match(readers.search({ text: 'TOKEN', ignore_case: true }), /src\/a\.js:1:/);
  // 正規表現としては解釈しない
  assert.equal(readers.search({ text: '(a+)+$' }), '一致なし');
});

test('list_files は Git 管理のファイルだけを返し、glob で絞れる', () => {
  const { readers } = fixture();
  assert.equal(readers.listFiles({ glob: 'src/**/*.js' }), 'src/a.js');
  assert.doesNotMatch(readers.listFiles(), /outside\.txt/);
});

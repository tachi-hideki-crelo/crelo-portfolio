// Claude PR レビュー用の、読み取り専用ツール（review.mjs から使う）。
// 読めるのは「PR のチェックアウト（root）の中」と「差分ファイル（diffPath）」だけ。パスは実体（realpath）に直してから判定するので、
// シンボリックリンクや ../ を使っても、/proc やランナーの設定ファイルなど外側のファイルには届かない。
import { execFileSync } from 'node:child_process';
import { closeSync, lstatSync, openSync, readFileSync, readSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_SEARCH_FILE_BYTES = 1024 * 1024;
const MAX_MATCHES = 300;
const MAX_LISTED = 2000;

// ツールの中身。テストから直接呼べるよう、MCP サーバーとは分けておく。失敗は例外で返す。
export function createRepoReaders({ root: rootDir, diffPath }) {
  const root = realpathSync(rootDir);
  const diffReal = realpathSync(diffPath);

  function resolveInside(requested) {
    let real;
    try {
      real = realpathSync(path.resolve(root, requested));
    } catch {
      throw new Error(`見つかりません: ${requested}`);
    }
    if (real === diffReal || real.startsWith(root + path.sep)) return real;
    throw new Error(`読めるのは PR のチェックアウトの中と差分ファイルだけです: ${requested}`);
  }

  function trackedFiles() {
    return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
      .split('\0')
      .filter(Boolean);
  }

  function looksBinary(file) {
    const fd = openSync(file, 'r');
    try {
      const buffer = Buffer.alloc(8000);
      const size = readSync(fd, buffer, 0, buffer.length, 0);
      return buffer.subarray(0, size).includes(0);
    } finally {
      closeSync(fd);
    }
  }

  return {
    readFile({ path: requested, offset = 1, limit = 2000 }) {
      const file = resolveInside(requested);
      const info = statSync(file);
      if (!info.isFile()) throw new Error(`ファイルではありません: ${requested}`);
      if (info.size > MAX_FILE_BYTES) throw new Error(`大きすぎるため読めません（5MB 超）: ${requested}`);
      const lines = readFileSync(file, 'utf8').split('\n');
      const slice = lines.slice(offset - 1, offset - 1 + limit).map((line, i) => `${offset + i}\t${line.slice(0, 2000)}`);
      const rest = lines.length - (offset - 1 + slice.length);
      return slice.join('\n') + (rest > 0 ? `\n…（残り ${rest} 行。offset を進めて読む）` : '');
    },

    listFiles({ glob } = {}) {
      const files = trackedFiles().filter(file => !glob || path.matchesGlob(file, glob));
      const shown = files.slice(0, MAX_LISTED);
      return shown.join('\n') + (files.length > shown.length ? `\n…（ほか ${files.length - shown.length} 件。glob で絞り込む）` : '');
    },

    // 正規表現は使わない（重い正規表現でレビューを止められないよう、ただの文字列一致にする）
    search({ text: needle, glob, ignore_case: ignoreCase }) {
      if (!needle) throw new Error('検索する文字列が空です');
      const wanted = ignoreCase ? needle.toLowerCase() : needle;
      const matches = [];
      for (const file of trackedFiles()) {
        if (glob && !path.matchesGlob(file, glob)) continue;
        const full = path.join(root, file);
        // シンボリックリンクはたどらない（外側のファイルを指していることがある）
        const info = lstatSync(full, { throwIfNoEntry: false });
        if (!info?.isFile() || info.size > MAX_SEARCH_FILE_BYTES || looksBinary(full)) continue;
        const lines = readFileSync(full, 'utf8').split('\n');
        for (let i = 0; i < lines.length && matches.length < MAX_MATCHES; i++) {
          const line = ignoreCase ? lines[i].toLowerCase() : lines[i];
          if (line.includes(wanted)) matches.push(`${file}:${i + 1}: ${lines[i].slice(0, 300)}`);
        }
        if (matches.length >= MAX_MATCHES) break;
      }
      return matches.length ? matches.join('\n') : '一致なし';
    },
  };
}

// Agent SDK に渡す MCP サーバー（ツール名は mcp__repo__read_file などになる）。
export function createRepoTools(options) {
  const readers = createRepoReaders(options);
  const run = fn => async args => {
    try {
      return { content: [{ type: 'text', text: fn(args) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: String(error?.message ?? error) }], isError: true };
    }
  };
  return createSdkMcpServer({
    name: 'repo',
    version: '1.0.0',
    tools: [
      tool(
        'read_file',
        'PR のチェックアウト内のファイル、または差分ファイルを、行番号付きで読む。path はチェックアウトからの相対パスか、指示にある差分ファイルの絶対パス。',
        { path: z.string(), offset: z.number().int().min(1).optional(), limit: z.number().int().min(1).max(2000).optional() },
        run(args => readers.readFile(args)),
      ),
      tool(
        'list_files',
        'PR のチェックアウト内で Git 管理されているファイルの一覧を返す。glob（例: src/**/*.ts）で絞り込める。',
        { glob: z.string().optional() },
        run(args => readers.listFiles(args)),
      ),
      tool(
        'search',
        'PR のチェックアウト内の Git 管理ファイルを、文字列（正規表現ではない）で行ごとに検索する。glob で対象を絞り込める。',
        { text: z.string().min(1).max(500), glob: z.string().optional(), ignore_case: z.boolean().optional() },
        run(args => readers.search(args)),
      ),
    ],
  });
}

export const REPO_TOOL_NAMES = ['mcp__repo__read_file', 'mcp__repo__list_files', 'mcp__repo__search'];

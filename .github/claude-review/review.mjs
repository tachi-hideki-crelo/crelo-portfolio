// Claude PR レビューを、Claude Agent SDK で 1 回実行し、結果を PR にコメントする。
//
// なぜ claude-code-action ではないか:
//   Max 付属の月次 API クレジット（プロモーションクレジット）の適用対象は Agent SDK で、
//   claude-code-action 経由の利用には適用されない（2026-10-24 に確認）。
//
// 安全のための作り:
//   - GitHub のトークンは、このスクリプト（差分の取得とコメントの投稿）だけが使う。Claude には渡さない。
//   - Claude が使えるのは Read / Grep / Glob だけ（Bash は使わせない）。/proc や $HOME の設定ファイルなど、
//     認証情報が見える場所は読めないようにする。
//   - 投稿前に、本文へ API キーやトークンが含まれていないか検査し、含まれていれば投稿しない。
//   - 判定は、今回の実行で Claude が返した本文の最終行から読み取る（古いコメントは見ない）。
//
// 環境変数:
//   ANTHROPIC_API_KEY  … Console の API キー（必須）
//   GH_TOKEN           … PR の差分の取得とコメントの投稿に使うトークン（必須。Claude には渡さない）
//   REVIEW_PROMPT      … レビューの指示（必須）。{{DIFF_PATH}} を差分ファイルのパスに置き換える
//   PR_NUMBER          … PR 番号（必須）
//   BASE_SHA / HEAD_SHA … gh で差分を取れないとき（大きな PR）に git diff で取り直すための範囲
//   GITHUB_REPOSITORY / GITHUB_RUN_ID / RUNNER_TEMP … GitHub Actions が設定する
//   REVIEW_MODEL       … 使うモデル（既定: claude-sonnet-5-5）
//   REVIEW_MAX_TURNS   … 最大ターン数（既定: 30）
//   REVIEW_MAX_BUDGET_USD … 1 回のレビューの上限金額（既定: 2）
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';

for (const name of ['ANTHROPIC_API_KEY', 'GH_TOKEN', 'REVIEW_PROMPT', 'PR_NUMBER', 'GITHUB_REPOSITORY']) {
  if (!process.env[name]) {
    console.error(`::error::${name} が設定されていません。`);
    process.exit(1);
  }
}

const repo = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;
const runId = process.env.GITHUB_RUN_ID ?? 'local';
const VERDICT = /^<!-- claude-review-verdict: (PASS|FAIL) -->$/;

// GitHub のトークンは、この後の gh の呼び出しにだけ渡す。Claude のプロセスへは引き継がない。
const ghToken = process.env.GH_TOKEN;
const secrets = [ghToken, process.env.ANTHROPIC_API_KEY].filter(Boolean);
const claudeEnv = { ...process.env };
for (const name of ['GH_TOKEN', 'GITHUB_TOKEN', 'ACTIONS_RUNTIME_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN']) {
  delete claudeEnv[name];
  delete process.env[name];
}

function gh(args, input) {
  return execFileSync('gh', [...args, '-R', repo], {
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GH_TOKEN: ghToken },
  });
}

// 差分は、このスクリプトが取得してファイルに置く。Claude は Read で読むだけ。
// gh は大きな PR（約 20000 行超）で失敗するので、そのときは git diff で取り直す（checkout は fetch-depth: 0）。
const workDir = mkdtempSync(path.join(process.env.RUNNER_TEMP || tmpdir(), 'claude-review-'));
const diffPath = path.join(workDir, 'pr.diff');
let diff;
try {
  diff = gh(['pr', 'diff', prNumber]);
} catch (error) {
  const { BASE_SHA: base, HEAD_SHA: head } = process.env;
  if (!base || !head) {
    console.error(`::error::PR の差分を取得できませんでした: ${error?.message ?? error}`);
    process.exit(1);
  }
  console.log('gh pr diff に失敗したため、git diff で差分を取得します。');
  diff = execFileSync('git', ['diff', `${base}...${head}`], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}
writeFileSync(diffPath, diff);

// 読み取りだけを許可する。ここに無い操作は確認なしで拒否される（dontAsk）。
const allowedTools = ['Read', 'Grep', 'Glob'];
// 認証情報が見える場所は読ませない（プロセスの環境変数、ランナーの設定ファイルなど）。
const deniedPaths = ['//proc/**', '//sys/**', '//dev/**', '//etc/**', '//root/**', '~/.*/**', '~/.*', '//home/runner/work/_temp/_runner_file_commands/**'];
const disallowedTools = ['Bash', ...['Read', 'Grep', 'Glob'].flatMap(tool => deniedPaths.map(p => `${tool}(${p})`))];

const prompt = process.env.REVIEW_PROMPT.replaceAll('{{DIFF_PATH}}', diffPath);

let result;
try {
  for await (const message of query({
    prompt,
    options: {
      model: process.env.REVIEW_MODEL || 'claude-sonnet-5-5',
      maxTurns: Number(process.env.REVIEW_MAX_TURNS || 30),
      maxBudgetUsd: Number(process.env.REVIEW_MAX_BUDGET_USD || 2),
      tools: ['Read', 'Grep', 'Glob'],
      allowedTools,
      disallowedTools,
      permissionMode: 'dontAsk',
      // リポジトリ内の .claude/ 設定（フックなど）は読み込まない。方針は指示に従って CLAUDE.md / AGENTS.md を Read させる。
      settingSources: [],
      cwd: process.cwd(),
      env: claudeEnv,
    },
  })) {
    if (message.type === 'result') result = message;
    // 後から原因を追えるよう、Claude が使ったツールと、ツールの失敗をログに残す（先頭だけ）。
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'tool_use') console.log(`tool: ${block.name} ${JSON.stringify(block.input).slice(0, 200)}`);
      }
    }
    if (message.type === 'user' && Array.isArray(message.message.content)) {
      for (const block of message.message.content) {
        if (block.type === 'tool_result' && block.is_error) {
          const text = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
          console.log(`tool error: ${text.slice(0, 300)}`);
        }
      }
    }
  }
} catch (error) {
  // API エラー（認証・残高不足など）のとき、SDK は result を返さずに例外を投げる。
  console.error(`::error::Claude のレビューが失敗しました: ${error?.message ?? error}`);
  process.exit(1);
}

if (!result) {
  console.error('::error::Claude の実行結果を受け取れませんでした。');
  process.exit(1);
}

console.log(`result: ${result.subtype} / is_error=${result.is_error} / turns=${result.num_turns} / cost=$${result.total_cost_usd}`);
for (const denial of result.permission_denials ?? []) {
  console.log(`denied: ${denial.tool_name} ${JSON.stringify(denial.tool_input).slice(0, 200)}`);
}
if (result.subtype !== 'success' || result.is_error) {
  const detail = result.subtype === 'success' ? result.result : (result.errors ?? []).join('\n');
  console.error(`::error::Claude のレビューが失敗しました（${result.subtype}）: ${detail}`);
  process.exit(1);
}

// 最終行の判定マーカーを読み取る。無ければ失敗にする（コメントは投稿しない）。
const lines = result.result.trimEnd().split('\n');
const match = lines.at(-1).trim().match(VERDICT);
if (!match) {
  console.error('::error::レビュー本文の最終行に判定マーカーがありません。');
  console.log(result.result.slice(0, 2000));
  process.exit(1);
}
const verdict = match[1];

// どの実行の判定かを残すため、判定マーカーの直前に実行 ID を入れる（判定マーカーは最終行のまま）。
const body = [...lines.slice(0, -1), `<!-- claude-review-run: ${runId} -->`, lines.at(-1).trim()].join('\n');

// 投稿前の最終確認: キーやトークン（値そのもの、または典型的な形式）が本文に含まれていたら投稿しない。
const TOKEN_LIKE = /(sk-ant-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/;
if (secrets.some(secret => body.includes(secret)) || TOKEN_LIKE.test(body)) {
  console.error('::error::レビュー本文に認証情報らしき文字列が含まれていたため、投稿を中止しました。');
  process.exit(1);
}
gh(['pr', 'comment', prNumber, '--body-file', '-'], body);
console.log(`Claude review verdict: ${verdict}`);

if (verdict === 'FAIL') {
  console.error('::error::Claude review verdict is FAIL. See the review comment on the PR.');
  process.exit(1);
}

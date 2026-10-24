// Claude PR レビューを、Claude Agent SDK で 1 回実行し、結果を PR にコメントする。
//
// なぜ claude-code-action ではないか:
//   Max 付属の月次 API クレジット（プロモーションクレジット）の適用対象は Agent SDK で、
//   claude-code-action 経由の利用には適用されない（2026-10-24 に確認）。
//
// 安全のための作り:
//   - このスクリプトとワークフローは、信頼できる main 側のもの（pull_request_target）だけを実行する。
//     PR の中身（PR_DIR）は読むだけのデータとして扱い、実行しない。
//   - GitHub のトークンは、このスクリプト（差分の取得とコメントの投稿）だけが使う。Claude には渡さない。
//   - Claude が実行するコマンドからは、Anthropic の認証情報も取り除く（CLAUDE_CODE_SUBPROCESS_ENV_SCRUB）。
//   - 判定は、今回の実行で Claude が返した本文の最終行から読み取る（古いコメントは見ない）。
//
// 環境変数:
//   ANTHROPIC_API_KEY  … Console の API キー（必須）
//   GH_TOKEN           … PR の差分の取得とコメントの投稿に使うトークン（必須。Claude には渡さない）
//   REVIEW_PROMPT      … レビューの指示（必須）。{{DIFF_PATH}} と {{PR_DIR}} を実際のパスに置き換える
//   PR_NUMBER          … PR 番号（必須）
//   PR_DIR             … PR の中身をチェックアウトしたディレクトリ（必須）
//   GITHUB_REPOSITORY / GITHUB_RUN_ID / RUNNER_TEMP … GitHub Actions が設定する
//   REVIEW_MODEL       … 使うモデル（既定: claude-sonnet-5-5）
//   REVIEW_MAX_TURNS   … 最大ターン数（既定: 30）
//   REVIEW_MAX_BUDGET_USD … 1 回のレビューの上限金額（既定: 2）
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';

for (const name of ['ANTHROPIC_API_KEY', 'GH_TOKEN', 'REVIEW_PROMPT', 'PR_NUMBER', 'PR_DIR', 'GITHUB_REPOSITORY']) {
  if (!process.env[name]) {
    console.error(`::error::${name} が設定されていません。`);
    process.exit(1);
  }
}

const repo = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;
const prDir = path.resolve(process.env.PR_DIR);
const runId = process.env.GITHUB_RUN_ID ?? 'local';
const VERDICT = /^<!-- claude-review-verdict: (PASS|FAIL) -->$/;

function gh(args, input) {
  return execFileSync('gh', [...args, '-R', repo], { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024 });
}

// 差分は、このスクリプトが取得してファイルに置く。Claude は Read で読むだけ。
const workDir = mkdtempSync(path.join(process.env.RUNNER_TEMP || tmpdir(), 'claude-review-'));
const diffPath = path.join(workDir, 'pr.diff');
writeFileSync(diffPath, gh(['pr', 'diff', prNumber]));

// Claude のプロセスに GitHub のトークンを渡さない。
const claudeEnv = { ...process.env };
for (const name of ['GH_TOKEN', 'GITHUB_TOKEN', 'ACTIONS_RUNTIME_TOKEN', 'ACTIONS_ID_TOKEN_REQUEST_TOKEN']) delete claudeEnv[name];

// 読み取りだけを許可する。ここに無い操作は確認なしで拒否される（dontAsk）。
const allowedTools = ['Bash(git diff:*)', 'Bash(git log:*)', 'Read', 'Grep', 'Glob'];

const prompt = process.env.REVIEW_PROMPT.replaceAll('{{DIFF_PATH}}', diffPath).replaceAll('{{PR_DIR}}', prDir);

let result;
try {
  for await (const message of query({
    prompt,
    options: {
      model: process.env.REVIEW_MODEL || 'claude-sonnet-5-5',
      maxTurns: Number(process.env.REVIEW_MAX_TURNS || 30),
      maxBudgetUsd: Number(process.env.REVIEW_MAX_BUDGET_USD || 2),
      tools: ['Bash', 'Read', 'Grep', 'Glob'],
      allowedTools,
      permissionMode: 'dontAsk',
      // PR 内の .claude/ 設定（フックなど）は読み込まない。方針は指示に従って CLAUDE.md / AGENTS.md を Read させる。
      settingSources: [],
      cwd: prDir,
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
gh(['pr', 'comment', prNumber, '--body-file', '-'], body);
console.log(`Claude review verdict: ${verdict}`);

if (verdict === 'FAIL') {
  console.error('::error::Claude review verdict is FAIL. See the review comment on the PR.');
  process.exit(1);
}

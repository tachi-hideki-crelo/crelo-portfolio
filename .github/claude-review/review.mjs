// Claude PR レビューを、Claude Agent SDK で 1 回実行する。
// claude-code-action ではなく SDK を直接使うのは、Max 付属の月次 API クレジット（プロモーションクレジット）の
// 適用対象が Agent SDK であり、claude-code-action 経由の利用には適用されないため（2026-10-24 に確認）。
//
// 環境変数:
//   ANTHROPIC_API_KEY  … Console の API キー（必須）
//   GH_TOKEN           … gh コマンドで PR を読み、コメントを投稿するためのトークン（必須）
//   REVIEW_PROMPT      … レビューの指示（必須）
//   REVIEW_MODEL       … 使うモデル（既定: claude-sonnet-5-5）
//   REVIEW_MAX_TURNS   … 最大ターン数（既定: 30）
//   REVIEW_MAX_BUDGET_USD … 1 回のレビューの上限金額（既定: 2）
import { query } from '@anthropic-ai/claude-agent-sdk';

for (const name of ['ANTHROPIC_API_KEY', 'GH_TOKEN', 'REVIEW_PROMPT']) {
  if (!process.env[name]) {
    console.error(`::error::${name} が設定されていません。`);
    process.exit(1);
  }
}

// レビューに必要な読み取りと、結果のコメント投稿だけを許可する。ここに無い操作は確認なしで拒否される（dontAsk）。
const allowedTools = [
  'Bash(gh pr diff:*)',
  'Bash(gh pr view:*)',
  'Bash(gh pr comment:*)',
  'Bash(git diff:*)',
  'Bash(git log:*)',
  'Read',
  'Grep',
  'Glob',
];

let result;
try {
  for await (const message of query({
    prompt: process.env.REVIEW_PROMPT,
    options: {
      model: process.env.REVIEW_MODEL || 'claude-sonnet-5-5',
      maxTurns: Number(process.env.REVIEW_MAX_TURNS || 30),
      maxBudgetUsd: Number(process.env.REVIEW_MAX_BUDGET_USD || 2),
      tools: ['Bash', 'Read', 'Grep', 'Glob'],
      allowedTools,
      permissionMode: 'dontAsk',
      // リポジトリ内の .claude/ 設定（フックなど）は読み込まない。方針は指示に従って CLAUDE.md / AGENTS.md を Read させる。
      settingSources: [],
      cwd: process.cwd(),
    },
  })) {
    if (message.type === 'result') result = message;
    // 後から原因を追えるよう、Claude が使ったツールと、ツールの失敗をログに残す（本文は長いので先頭だけ）。
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

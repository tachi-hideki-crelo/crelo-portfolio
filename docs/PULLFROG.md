# Pullfrog PRレビューの運用

## 実行範囲

このサイトでは、既存のChatGPT（Codex）接続でPRレビューだけを行う。
新しいAPIキー、有料Router、他社モデル、追加のGitHub Appは使用しない。
モデルは既存設定のOpenAI GPT Luna / Highを維持する。

- 起動: Pullfrog Appからの`workflow_dispatch`。通常のPRイベントを直接
  credential-bearingジョブへ接続せず、`pull_request_target`も使わない。
- 実行元: このリポジトリの`main`のみ。PR headやforkからは実行しない。
- Runner: 実PRで確認した`ubuntu-24.04`を指定。`ubuntu-latest`の
  Ubuntu 26.04への自動移行に追随しない。OS更新時は明示的に再検証する。
- 入力: `pr-created` / `pr-re-review`の構造化PRコンテキストを検証。
  不正JSON、他の自動化、別provider、cross-repo grantは実行前に拒否する。
  JSON/proseを混ぜず、`prompt`はそのままデータとしてActionへ渡す。
- 権限: ソース読み取りとジョブ内OIDCのみ。Git認証情報をcheckoutへ残さない。
  OIDCはPullfrogが既存接続を取得するためのrunner proofで、永続キーではない。
- Code pushes: workflowとConsoleの両方で禁止。Shellはrestrictedを維持。
- 時間: Agent 15分、ジョブ20分。PR単位のconcurrencyで同一PRの重複を抑える。
  新しい課金先を設定せず、ChatGPTの既存利用枠を消費する。
- Console: PR作成時レビューと新コミット時の再レビューのみ有効。
  Mentions、外部投稿者の自動起動、Approve、Auto-merge、Address reviews、
  Fix CI failures、その他の実装自動化は無効。

手動で任意の文章をActionsに入力する汎用エージェント用途は受け付けない。
レビュー依頼はPR作成または更新で行う。外部投稿者のPRは人が確認する。

## 固定した実装

- Action: `tachi-hideki-crelo/pullfrog-security@5fd66c952a0c1abd5ce9fb8afec3d93c04bbc2c7`
- Upstream base: `pullfrog/pullfrog@918f88ee80c3bb54f55c1d328ce32e7a54e5a5b4`
- TOON: `2.3.1`。ToolkitのUndici: `6.28.1`（旧Busboy 2も依存から除外）。
- `PULLFROG_FORCE_LOCAL_CLI=1`により、固定SHA内のソースとfrozen lockを
  `--ignore-scripts`で使用する。`npx pullfrog@^…`への自動追随はしない。
- ChatGPTのcredential refresh/write-backに必要な公式post actionは維持する。
  認証情報を`.env`、ソース、GitHub Actions Secretにコピーしない。
- fork自身のActionsは停止し、公式の公開・他provider課金テストは起動しない。

2026-10-18の依存監査は既知の脆弱性0件。これはその時点のチェックであり、
将来の安全性やサービス全体の無欠陥を保証しない。forkの保守責任はこの運用に残る。

## 変更・停止・復旧

workflowの安全契約は`npm run validate:pullfrog`と関連テストで検査する。
pin、permission、起動条件、入力ガード、実行上限を変更するときは、依存監査、
全テスト、型検査、Lint、Production Buildと独立Codex Reviewを再実施する。
fork更新時は上流との差分全体・固定依存とHTTP/proxy/TOON回帰も再検証する。

問題発生時はGitHub ActionsでPullfrog workflowをDisableする。
Consoleで自動修正を有効にしたり、Shell隔離を解除したり、古い脆弱版へ戻して
動作させない。再開前に原因修正と承認された実PRでの結果を確認する。

この運用はサイト表示、問い合わせAPI、Cloudflare、DNSには変更を加えない。

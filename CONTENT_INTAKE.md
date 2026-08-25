# Crelo 公開コンテンツ質問票

このリポジトリへ記載するのは、公開承認済みの文章・画像だけです。NDA資料、原資料、個人情報、秘密鍵は置きません。

## Profile

- 実名（サイト表示名）
- 顔写真の公開用ファイルと代替テキスト
- 経歴・現在の役割
- 顔写真の公開承認フラグ（`approved: true`）と承認日（`approvedAt: YYYY-MM-DD`）
- 受信用メールアドレス
- 問い合わせ返信時に利用する送信元アドレス
- 顔写真は `/assets/profile/` 配下の公開用ローカルassetだけを登録します。外部URL、`..`、バックスラッシュ、クエリ付きURLは不可です。

## Privacy（公開運用情報）

次の項目は、プレビュー用の仮文面ではなく、実際の公開運用に承認された情報を記入してください。

- 運用主体（個人名／法人名など）
- 版番号と施行日（`version`、`effectiveDate: YYYY-MM-DD`）
- 取得項目
- 利用目的
- 保存期間
- 委託先・再委託先とその扱い
- 国外移転の有無と、ある場合の扱い
- 開示・訂正・削除の請求窓口（有効な連絡先メールアドレス）

未提供、`TBD`、`TODO`、`example.com`、仮メール、存在しない日付は本番ゲートで拒否されます。

## Case study 5件

各スロットのslugは実装で固定しています。回答時はslugを変更せず、次の項目を一件ずつ記入してください。

1. `field-signal`
2. `workflow-atlas`
3. `decision-lens`
4. `ops-interface`
5. `delivery-orbit`

必須項目:

- 公開用匿名タイトル、業界、期間表記
- 事業上の課題と公開可能な制約
- 担当範囲（FDEとしてどこまで関わったか）
- 発見、設計、実装、導入の説明
- 定性成果（架空の数値や未承認の効果は不可）
- 技術、タグ、案件テーマ色
- 案件全体の公開承認フラグ（`approved: true`）と承認日（`approvedAt: YYYY-MM-DD`）を `app/lib/content.ts` の各case recordへ記入します。承認日は内部の公開根拠として保持し、サイト本文へは投影しません。
- 公開可能な画像・動画、各媒体の正確なalt、承認日
- 画像は `/assets/cases/` 配下のローカルasset、正の整数の `width`／`height` を必須とします。使用できる拡張子は `.avif`、`.gif`、`.jpeg`、`.jpg`、`.png`、`.webp` です。
- 動画は `/assets/cases/` 配下の `.mp4`、`.ogv`、`.webm` と `poster`（画像拡張子）を登録し、音声あり（`hasAudio: true`）なら同じ配下の `.vtt` 字幕 `captionsSrc` を必須とします。字幕も外部URLやパストラバーサルを許可しません。
- 匿名化と媒体公開の承認者・承認日（承認済みの証跡は手元で管理）
- NDA資料、未承認画像、原資料、個人情報はリポジトリへ置きません。

## Production gate

`npm run build` とローカル開発は、承認待ち5枠のpreviewを許可します。
`npm run build:production` は、5件すべてが `approved: true` と有効な案件承認日を持つこと、必須項目・承認済み媒体の安全なasset metadata・実名Profile（顔写真の公開承認日を含む）・実運用Privacy（取得項目、目的、保存期間、委託先、国外移転、権利請求窓口を含む）・本番環境変数が揃うことを検証します。さらに `public/` 配下へ安全に解決できる通常ファイルの存在、画像／動画／字幕の拡張子をbuild前に検証し、揃わない場合は理由を列挙して失敗します。

本番 `SITE_ORIGIN` は `https://` のURLに限定し、`localhost`／`127.0.0.1`／`[::1]` のみローカル検証用に `http://` を許可します。問い合わせの任意 `requestId` はResendの `Idempotency-Key` とD1の再試行識別に使うためUUID形式で指定します。省略時はサーバーがUUIDを生成します。Turnstile Siteverify は毎回新しいtokenを検証し、Resend用のrequestIdをSiteverifyのidempotency keyへ流用しません。

公開用Turnstileキーは `NEXT_PUBLIC_TURNSTILE_SITE_KEY` としてクライアントへ渡し、サーバー検証には `TURNSTILE_SECRET_KEY` だけを使います。`CONTACT_HASH_SECRET` は32文字以上の秘密値をSites環境へ登録し、公開変数にはしません。

承認済みデータを投入した後は、未承認画像、`TBD`・仮メール・架空数値・欠落alt・重複slugがないことを確認してからproduction gateを実行してください。

問い合わせの同一fingerprint重複防止は、`pending`／`sent`／`rejected`／`failed`の状態を区別せず、作成時刻から24時間の窓（境界を含む）だけ適用します。窓を過ぎた再相談は新規受付として扱い、失敗状態だけを永久にブロックする例外は設けません。

## Security header promotion

Preview の `public/_headers` は HSTS を有効にしますが、`includeSubDomains; preload` は含めません。独自ドメイン、すべてのサブドメインの HTTPS 運用、リダイレクト、削除予定のないホストを確認し、HSTS preload の要件を満たすことを運用責任者が確認した後に、本番配信設定へ段階的に追加してください。

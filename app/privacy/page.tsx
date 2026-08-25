import type { Metadata } from 'next';
import Link from 'next/link';
import { siteContent } from '../lib/content.ts';
import { getPublicOrigin } from '../seo-config.ts';

const publicOrigin = getPublicOrigin();
const privacy = siteContent.privacy;
const privacyReady = Boolean(
  privacy.operator &&
    privacy.version &&
    privacy.effectiveDate &&
    privacy.collectedItems.length > 0 &&
    privacy.purposes.length > 0 &&
    privacy.retentionPeriod &&
    privacy.processors &&
    privacy.overseasTransfer &&
    privacy.rightsContact,
);
const publicPrivacy = publicOrigin !== null && privacyReady;

export const metadata: Metadata = {
  title: 'Privacy notice — Crelo',
  description: publicPrivacy ? 'Crelo privacy notice.' : 'Crelo preview build privacy notice.',
  ...(publicPrivacy
    ? { alternates: { canonical: '/privacy' }, robots: { index: true, follow: true } }
    : { robots: { index: false, follow: false } }),
};

export default function PrivacyPage() {
  return (
    <main id="main-content" className="legal-page" tabIndex={-1}>
      <div className="legal-page__topline"><span>CRELO / PRIVACY NOTICE</span><span>{publicPrivacy ? 'PUBLIC NOTICE' : 'PREVIEW BUILD'}</span></div>
      <div className="legal-page__body">
        <p className="eyebrow eyebrow--mint">{publicPrivacy ? 'Privacy / Current notice' : 'Privacy / Preview only'}</p>
        <h1>Privacy<br /><em>notice.</em></h1>
        {publicPrivacy ? (
          <>
            <p className="legal-page__lead">{privacy.operator}が、以下の内容でCreloのお問い合わせ情報を取り扱います。施行日: {privacy.effectiveDate} / 版: {privacy.version}</p>
            <div className="legal-page__sections">
              <section><span>01 / DATA CONTROLLER</span><h2>運用主体</h2><p>{privacy.operator}</p></section>
              <section><span>02 / COLLECTED &amp; PURPOSE</span><h2>取得項目と目的</h2><p>{privacy.collectedItems.join('、')}。{privacy.purposes.join('、')}。</p></section>
              <section><span>03 / RETENTION &amp; PROCESSORS</span><h2>保存と委託</h2><p>保存期間: {privacy.retentionPeriod}。委託先: {privacy.processors}。国外移転: {privacy.overseasTransfer}。</p></section>
              <section><span>04 / RIGHTS CONTACT</span><h2>開示・削除窓口</h2><p>{privacy.rightsContact}</p></section>
            </div>
          </>
        ) : (
          <>
            <p className="legal-page__lead">このページは、Creloの公開準備中プレビューです。実運用に必要な主体・窓口・保存期間・委託先は、公開前に確定し、本文へ反映します。</p>
            <div className="legal-page__sections">
              <section><span>01 / DATA CONTROLLER</span><h2>運用主体</h2><p>実名・法人名・所在地・連絡先は未提供です。公開承認後に確定情報を掲載します。</p></section>
              <section><span>02 / CONTACT FORM</span><h2>お問い合わせ</h2><p>Preview buildではフォーム送信を停止しています。Turnstile、保存先、Resendの運用設定が完了するまで入力内容を外部へ送信しません。</p></section>
              <section><span>03 / RETENTION</span><h2>保存期間と第三者提供</h2><p>保存期間、アクセス権限、委託先、国外移転の有無は、実運用の決定後に明記します。</p></section>
              <section><span>04 / REVISION</span><h2>改定</h2><p>公開前に版番号と施行日を付し、実際の取り扱いと一致する内容へ更新します。</p></section>
            </div>
          </>
        )}
        <Link className="legal-page__back" href="/">← Back to Crelo</Link>
      </div>
      <div className="legal-page__footer">{publicPrivacy ? `PRIVACY VERSION / ${privacy.version}` : 'PRIVACY VERSION / TO BE CONFIRMED'}</div>
    </main>
  );
}

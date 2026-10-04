import assert from 'node:assert/strict';
import test from 'node:test';
import { isContactAvailable } from '../app/lib/contact-availability.ts';
import { siteContent } from '../app/lib/content.ts';

const env = {
  SITE_ORIGIN: 'https://crelo.example',
  CONTACT_TO_EMAIL: 'info@crelo.dev',
  CONTACT_FROM_EMAIL: 'verified@crelo.example',
  RESEND_API_KEY: 'test-resend-key',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'test-public-key',
  TURNSTILE_SECRET_KEY: 'test-secret-key',
  CONTACT_HASH_SECRET: '0123456789abcdef0123456789abcdef',
};

const approvedContent = {
  ...siteContent,
  privacy: {
    operator: '舘 秀樹',
    version: '1',
    effectiveDate: '2026-09-28',
    collectedItems: ['氏名', '会社名', 'メールアドレス', '相談内容'],
    purposes: ['相談への回答'],
    retentionPeriod: '1年間',
    processors: 'メール配信事業者',
    overseasTransfer: '委託先の運用に従い国外で処理する場合があります',
    rightsContact: 'info@crelo.dev',
  },
};

test('accepts the approved notice but still requires all operational settings', () => {
  assert.equal(isContactAvailable(env, true, siteContent), true);
  assert.equal(isContactAvailable({ ...env, RESEND_API_KEY: undefined }, true, siteContent), false);
});

test('requires approved privacy, full runtime setup, D1, and the requested recipient', () => {
  assert.equal(isContactAvailable(env, true, approvedContent), true);
  assert.equal(isContactAvailable(env, false, approvedContent), false);
  assert.equal(isContactAvailable({ ...env, CONTACT_TO_EMAIL: 'other@crelo.dev' }, true, approvedContent), false);
  assert.equal(isContactAvailable({ ...env, TURNSTILE_SECRET_KEY: undefined }, true, approvedContent), false);
  assert.equal(isContactAvailable({ ...env, NEXT_PUBLIC_TURNSTILE_SITE_KEY: undefined }, true, approvedContent), false);
});

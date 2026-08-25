import assert from 'node:assert/strict';
import test from 'node:test';
import { hasAllowedOrigin, validateContactInput } from '../app/lib/contact-validation.ts';

const valid = {
  name: '山田太郎',
  company: 'Crelo合同会社',
  email: 'person@example.com',
  inquiryType: 'project',
  message: '業務整理から設計・導入まで相談したいです。',
  consent: true,
  turnstileToken: 'token-value',
  requestId: '550e8400-e29b-41d4-a716-446655440000',
};

test('accepts and normalizes a valid request', () => {
  const result = validateContactInput({ ...valid, name: '  山田太郎\r\n' });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.name, '山田太郎');
    assert.equal(result.value.email, 'person@example.com');
  }
});

test('rejects invalid email, consent, control characters, and oversized fields', () => {
  assert.equal(validateContactInput({ ...valid, email: 'not-an-email' }).ok, false);
  assert.equal(validateContactInput({ ...valid, consent: false }).ok, false);
  assert.equal(validateContactInput({ ...valid, message: `hello\u0000there` }).ok, false);
  assert.equal(validateContactInput({ ...valid, name: 'a'.repeat(81) }).ok, false);
  assert.equal(validateContactInput({ ...valid, inquiryType: 'unknown' }).ok, false);
  assert.equal(validateContactInput({ ...valid, requestId: 'req-not-a-uuid' }).ok, false);
});

test('requires exact same-origin comparison', () => {
  assert.equal(hasAllowedOrigin('https://crelo.example', 'https://crelo.example'), true);
  assert.equal(hasAllowedOrigin('https://evil.example', 'https://crelo.example'), false);
  assert.equal(hasAllowedOrigin(null, 'https://crelo.example'), false);
  assert.equal(hasAllowedOrigin('https://crelo.example.evil', 'https://crelo.example'), false);
});

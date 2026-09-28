import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildContactSubmissionKey,
  hasContactSubmissionChanged,
} from '../app/components/site/contact-form-state.ts';

const base = {
  name: '山田太郎',
  company: 'Crelo合同会社',
  email: 'Person@Example.com',
  inquiryType: 'project',
  message: '相談内容です。',
};

test('keeps the retry identity for an unchanged normalized submission', () => {
  const key = buildContactSubmissionKey(base);
  assert.equal(
    hasContactSubmissionChanged(key, {
      ...base,
      name: '  山田太郎\r\n',
      email: 'person@example.com',
      message: '相談内容です。\n',
    }),
    false,
  );
});

test('requires a fresh retry identity after editing any server fingerprint field', () => {
  const key = buildContactSubmissionKey(base);
  for (const field of ['name', 'company', 'email', 'inquiryType', 'message']) {
    const changed = { ...base, [field]: `${base[field]} changed` };
    assert.equal(hasContactSubmissionChanged(key, changed), true, field);
  }
  assert.equal(hasContactSubmissionChanged(null, { ...base, message: 'new' }), false);
});

test('edit then undo returns to the original retry identity', () => {
  const key = buildContactSubmissionKey(base);
  const edited = { ...base, message: '一時的な編集です。' };
  assert.equal(hasContactSubmissionChanged(key, edited), true);
  assert.equal(hasContactSubmissionChanged(key, base), false);
});

test('locks contact fields while a request is pending', async () => {
  const source = await readFile(new URL('../app/components/site/ContactForm.tsx', import.meta.url), 'utf8');
  assert.match(source, /<fieldset className="contact-form__fieldset" disabled=\{!enabled \|\| formState === 'pending'\}>/);
  const updateBody = source.split('const update = (key: keyof Fields, value: string | boolean) => {')[1]?.split('const submit = async')[0];
  assert.ok(updateBody);
  assert.doesNotMatch(updateBody, /turnstile\?\.reset|setTurnstileToken/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeSource = readFileSync(new URL('../app/components/site/HomeExperience.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');

test('profile and contact headings keep Japanese meaning phrases together', () => {
  assert.match(homeSource, /className="profile-heading-line">知るところから、<\/span><br \/><em>つくる。/);
  assert.match(homeSource, /className="contact-heading-line">まず、課題の<\/span><br \/><span className="contact-heading-line"><em>輪郭<\/em>を<\/span><br \/><span className="contact-heading-line">聞かせてください。/);
  assert.match(styles, /\.profile-heading-line, \.contact-heading-line \{[^}]*white-space: nowrap/);
  assert.match(styles, /\.profile-copy h2, \.contact-copy h2 \{ font-size: clamp\(2\.25rem, 10vw, 3\.4rem\); \}/);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*\.profile-copy h2, \.contact-copy h2 \{ font-size: clamp\(2\.2rem, 10vw, 2\.7rem\); \}/);
  assert.match(styles, /\.contact-form__consent \{[^}]*min-height: 44px/);
  assert.match(styles, /\.contact-form__consent a \{[^}]*display: inline-flex;[^}]*min-height: 44px/);
  assert.match(styles, /\.legal-page__back \{[^}]*display: inline-flex;[^}]*min-height: 44px/);
});

import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const homeSource = readFileSync(new URL('../app/components/site/HomeExperience.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const labStyles = readFileSync(new URL('../app/components/site/self-development-lab.module.css', import.meta.url), 'utf8');

test('profile and contact headings keep Japanese meaning phrases together', () => {
  assert.match(homeSource, /className="profile-heading-line">創造は論理を持って<\/span><br \/><em className="profile-heading-line">かたちにする。/);
  assert.match(homeSource, /ただ創造するだけでなく、「なぜそうするのか」\\n論理、根拠、設計思想をもって形にします。/);
  assert.match(homeSource, /className="contact-heading-line">まずはお気軽に<\/span><br \/><span className="contact-heading-line"><em>お悩み<\/em>をご相談<\/span><br \/><span className="contact-heading-line">ください。/);
  assert.match(homeSource, /aria-label="営業連絡への返信について"><span>SALES INQUIRIES \/ NO REPLY<\/span><p>営業に関するご連絡には返信できません。あらかじめご了承ください。/);
  assert.match(styles, /\.contact-copy__availability \{[^}]*border-left: 2px solid var\(--amber\)/);
  assert.match(styles, /\.profile-heading-line, \.contact-heading-line \{[^}]*white-space: nowrap/);
  assert.match(styles, /\.profile-copy h2, \.contact-copy h2 \{ font-size: clamp\(2\.25rem, 10vw, 3\.4rem\); \}/);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*\.profile-copy h2, \.contact-copy h2 \{ font-size: clamp\(2\.2rem, 10vw, 2\.7rem\); \}/);
  assert.match(styles, /\.contact-form__consent \{[^}]*min-height: 44px/);
  assert.match(styles, /\.contact-form__consent a \{[^}]*display: inline-flex;[^}]*min-height: 44px/);
  assert.match(styles, /\.legal-page__back \{[^}]*display: inline-flex;[^}]*min-height: 44px/);
});

test('approved profile keeps the portrait static with an intermittent light scan', () => {
  const contentSource = readFileSync(new URL('../app/lib/content.ts', import.meta.url), 'utf8');
  assert.match(contentSource, /name: '舘 秀樹'/);
  assert.match(contentSource, /portraitSrc: '\/assets\/profile\/hideki-tachi\.webp'/);
  assert.ok(statSync(new URL('../public/assets/profile/hideki-tachi.webp', import.meta.url)).size <= 120_000);
  assert.match(contentSource, /portraitAlt: '舘 秀樹のプロフィール写真'/);
  assert.match(contentSource, /approved: true/);
  assert.match(homeSource, /className="profile-photo-frame"/);
  assert.match(homeSource, /className="profile-photo"/);
  assert.match(homeSource, /className="profile-photo"[\s\S]*?preload[\s\S]*?unoptimized[\s\S]*?placeholder="blur"[\s\S]*?blurDataURL=\{PROFILE_PORTRAIT_BLUR_DATA_URL\}/);
  assert.match(homeSource, /const PROFILE_PORTRAIT_BLUR_DATA_URL = 'data:image\/jpeg;base64,/);
  assert.doesNotMatch(homeSource, /profile-photo-coin/);
  assert.doesNotMatch(homeSource, /profile-person-name|NAME \/ 01/);
  assert.match(homeSource, /className="profile-identity-plate">[\s\S]*?<span>NAME \/ IDENTITY<\/span>[\s\S]*?<strong>\{profile\.name\}<\/strong>/);
  assert.match(homeSource, /className="profile-facts">[\s\S]*?<span>ROLE<\/span><strong>Forward Deployed Engineer<\/strong>/);
  assert.doesNotMatch(homeSource, /className="profile-facts">[\s\S]*?<span>NAME<\/span>/);
  assert.match(homeSource, /profile\.approved && Boolean/);
  assert.match(styles, /\.profile-photo-frame \{[^}]*transform: translate\(-50%, -50%\)/);
  assert.match(styles, /\.profile-photo \{[^}]*transform: scale\(1\.025\)/);
  assert.match(styles, /\.profile-photo-frame::before \{[^}]*animation: profile-photo-scan 7s ease-in-out infinite/);
  assert.match(styles, /@keyframes profile-photo-scan \{[\s\S]*translateX\(45%\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.profile-photo-frame::before, \.profile-orbit--approved \.profile-orbit__ring \{ animation: none/);
  assert.match(styles, /\.profile-identity-plate \{[^}]*bottom: 5%;[^}]*right: -6%;[^}]*z-index: 4/);
  assert.match(styles, /\.profile-identity-plate strong \{[^}]*white-space: nowrap/);
  assert.doesNotMatch(styles, /profile-photo-coin|profile-photo-orbit/);
});

test('Personal Lab title and tool titles do not break in the middle', () => {
  assert.match(labStyles, /\.intro h2 \{[^}]*white-space: nowrap/);
  assert.match(labStyles, /\.toolCopy h3 \{[^}]*white-space: nowrap/);
  assert.match(labStyles, /@media \(max-width: 720px\)[\s\S]*\.intro h2 \{ font-size: clamp\(4rem, 23vw, 6\.2rem\)/);
});

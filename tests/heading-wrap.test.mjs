import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeSource = readFileSync(new URL('../app/components/site/HomeExperience.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
const labStyles = readFileSync(new URL('../app/components/site/self-development-lab.module.css', import.meta.url), 'utf8');

test('profile and contact headings keep Japanese meaning phrases together', () => {
  assert.match(homeSource, /className="profile-heading-line">創造は論理を持って<\/span><br \/><em className="profile-heading-line">かたちにする。/);
  assert.match(homeSource, /ただ創造するだけでなく、「なぜそうするのか」\\n論理、根拠、設計思想をもって形にします。/);
  assert.match(homeSource, /className="contact-heading-line">まず、課題の<\/span><br \/><span className="contact-heading-line"><em>輪郭<\/em>を<\/span><br \/><span className="contact-heading-line">聞かせてください。/);
  assert.match(styles, /\.profile-heading-line, \.contact-heading-line \{[^}]*white-space: nowrap/);
  assert.match(styles, /\.profile-copy h2, \.contact-copy h2 \{ font-size: clamp\(2\.25rem, 10vw, 3\.4rem\); \}/);
  assert.match(styles, /@media \(max-width: 420px\)[\s\S]*\.profile-copy h2, \.contact-copy h2 \{ font-size: clamp\(2\.2rem, 10vw, 2\.7rem\); \}/);
  assert.match(styles, /\.contact-form__consent \{[^}]*min-height: 44px/);
  assert.match(styles, /\.contact-form__consent a \{[^}]*display: inline-flex;[^}]*min-height: 44px/);
  assert.match(styles, /\.legal-page__back \{[^}]*display: inline-flex;[^}]*min-height: 44px/);
});

test('approved profile renders the supplied identity as a slow 3D coin', () => {
  const contentSource = readFileSync(new URL('../app/lib/content.ts', import.meta.url), 'utf8');
  assert.match(contentSource, /name: '舘 秀樹'/);
  assert.match(contentSource, /portraitSrc: '\/assets\/profile\/hideki-tachi\.png'/);
  assert.match(contentSource, /portraitAlt: '舘 秀樹のプロフィール写真'/);
  assert.match(contentSource, /approved: true/);
  assert.match(homeSource, /className="profile-photo-frame"/);
  assert.match(homeSource, /className="profile-photo-coin"/);
  assert.match(homeSource, /profile-photo profile-photo--front/);
  assert.match(homeSource, /profile-photo profile-photo--back/);
  assert.match(homeSource, /profile\.approved && Boolean/);
  assert.match(styles, /\.profile-photo-frame \{[^}]*perspective: 900px/);
  assert.match(styles, /\.profile-photo-coin \{[^}]*animation: profile-photo-coin-spin 24s linear infinite/);
  assert.match(styles, /\.profile-photo \{[^}]*backface-visibility: hidden/);
  assert.match(styles, /@keyframes profile-photo-coin-spin \{[\s\S]*rotateY\(360deg\)/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.profile-photo-coin \{ animation: none; transform: rotateY\(0deg\)/);
});

test('Personal Lab title and tool titles do not break in the middle', () => {
  assert.match(labStyles, /\.intro h2 \{[^}]*white-space: nowrap/);
  assert.match(labStyles, /\.toolCopy h3 \{[^}]*white-space: nowrap/);
  assert.match(labStyles, /@media \(max-width: 720px\)[\s\S]*\.intro h2 \{ font-size: clamp\(4rem, 23vw, 6\.2rem\)/);
});

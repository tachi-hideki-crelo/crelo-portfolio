import assert from 'node:assert/strict';
import test from 'node:test';

import robots from '../app/robots.ts';
import sitemap from '../app/sitemap.ts';
import { getPublicOrigin, parsePublicOrigin } from '../app/seo-config.ts';

function withEnvironment(values, callback) {
  const previous = {
    CONTENT_MODE: process.env.CONTENT_MODE,
    SITE_ORIGIN: process.env.SITE_ORIGIN,
  };
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    return callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('preview SEO never invents an origin and blocks crawlers', () => {
  withEnvironment({ CONTENT_MODE: undefined, SITE_ORIGIN: undefined }, () => {
    assert.equal(getPublicOrigin(), null);
    assert.deepEqual(robots(), { rules: { userAgent: '*', disallow: '/' } });
    assert.deepEqual(sitemap(), []);
  });
});

test('production SEO uses only a valid root SITE_ORIGIN', () => {
  withEnvironment({ CONTENT_MODE: 'production', SITE_ORIGIN: 'https://crelo.example' }, () => {
    assert.equal(getPublicOrigin()?.origin, 'https://crelo.example');
    assert.deepEqual(robots(), {
      rules: { userAgent: '*', allow: '/' },
      sitemap: 'https://crelo.example/sitemap.xml',
    });
    assert.deepEqual(sitemap(), [
      { url: 'https://crelo.example/' },
      { url: 'https://crelo.example/privacy' },
    ]);
  });
});

test('production SEO falls back to preview when SITE_ORIGIN is malformed', () => {
  withEnvironment({ CONTENT_MODE: 'production', SITE_ORIGIN: 'https://crelo.example/portfolio?draft=1' }, () => {
    assert.equal(getPublicOrigin(), null);
    assert.deepEqual(robots(), { rules: { userAgent: '*', disallow: '/' } });
    assert.deepEqual(sitemap(), []);
  });
});

test('production SEO never indexes local development origins', () => {
  assert.equal(parsePublicOrigin('https://localhost:3011'), null);
  assert.equal(parsePublicOrigin('https://127.0.0.1:3011'), null);
  assert.equal(parsePublicOrigin('https://[::1]:3011'), null);
});

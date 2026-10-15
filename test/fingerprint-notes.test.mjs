import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize, RISK_WEBDRIVER, RISK_HEADLESS_UA, RISK_LANG_MISMATCH } from '../tools/fingerprint-notes.mjs';

const BASE = {
  source: 'browser:depop.com',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  platform: 'MacIntel',
  language: 'en-GB',
  languages: ['en-GB', 'en'],
  hardwareConcurrency: 10,
  screen: { width: 1440, height: 900, colorDepth: 24 },
  viewport: { width: 1280, height: 800, dpr: 2 },
  timezone: 'Europe/London',
  webdriver: false,
  cookieCount: 4,
  localStorageKeys: 2,
};

test('a warm desktop browser flags nothing', () => {
  const out = summarize(BASE);
  assert.deepEqual(out.riskFlags, []);
  assert.equal(out.platformConsistentWithUserAgent, true);
  assert.equal(out.source, 'browser:depop.com');
  assert.deepEqual(out.languages, ['en-GB', 'en']);
});

test('webdriver true is flagged', () => {
  assert.ok(summarize({ ...BASE, webdriver: true }).riskFlags.includes(RISK_WEBDRIVER));
});

test('headless user agent is flagged', () => {
  assert.ok(summarize({ ...BASE, userAgent: 'Mozilla/5.0 HeadlessChrome/141' }).riskFlags.includes(RISK_HEADLESS_UA));
});

test('two cores reads as a VM', () => {
  assert.ok(summarize({ ...BASE, hardwareConcurrency: 2 }).riskFlags.includes('hardwareConcurrency <= 2 reads as a VM'));
});

test('language outside the languages list is flagged', () => {
  const out = summarize({ ...BASE, languages: ['en-US'] });
  assert.ok(out.riskFlags.includes(RISK_LANG_MISMATCH));
});

test('empty input does not throw and reports the gaps', () => {
  const out = summarize({});
  assert.deepEqual(out.riskFlags, ['no navigator.languages list']);
  assert.equal(out.platformConsistentWithUserAgent, true);
  assert.equal(out.userAgent, '');
});

test('a Windows UA claims Win32 and a mismatch is caught', () => {
  const win = summarize({ ...BASE, platform: 'MacIntel', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141' });
  assert.equal(win.platformConsistentWithUserAgent, false);
  assert.equal(summarize({ ...BASE, platform: 'Win32', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141' }).platformConsistentWithUserAgent, true);
});

test('missing optional fields survive summarising', () => {
  const out = summarize({ userAgent: 'curl/8', platform: '' });
  assert.equal(out.deviceMemory, null);
  assert.equal(out.screen, null);
  assert.equal(out.cookieCount, 0);
});

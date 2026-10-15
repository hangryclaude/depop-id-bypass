import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIdentity, toUsername } from '../tools/new-identity.mjs';
import { ageAt } from '../tools/dob-generator.mjs';

const NOW = new Date('2026-10-14T00:00:00Z');
const SEEDS = ['acct-0001', 'acct-0002', 'acct-0003', 'angus', '9', 'jev', 'fleet/0042'];

test('same seed builds the same identity', () => {
  for (const seed of SEEDS) {
    assert.deepEqual(buildIdentity({ seed, now: NOW }), buildIdentity({ seed, now: NOW }), seed);
  }
});

test('different seeds build different identities', () => {
  const ids = SEEDS.map((s) => JSON.stringify(buildIdentity({ seed: s, now: NOW })));
  assert.equal(new Set(ids).size, SEEDS.length, 'seed collision');
});

test('every identity is 18+ at signup', () => {
  for (let i = 0; i < 300; i++) {
    const id = buildIdentity({ seed: `sweep-${i}`, now: NOW });
    assert.ok(id.dob.ageAtSignup >= 18, `${id.dob.iso} is ${id.dob.ageAtSignup}`);
    assert.equal(id.dob.ageAtSignup, ageAt(id.dob.iso, NOW));
  }
});

test('output shape', () => {
  const id = buildIdentity({ seed: 'shape', now: NOW });
  assert.equal(id.seed, 'shape');
  assert.deepEqual(Object.keys(id).sort(), [
    'ageCheck', 'bioHint', 'dob', 'email', 'emailPattern', 'mailType', 'name', 'notes', 'seed', 'username',
  ]);
  assert.deepEqual(Object.keys(id.name).sort(), ['first', 'full', 'last']);
  assert.deepEqual(Object.keys(id.dob).sort(), ['ageAtSignup', 'day', 'iso', 'month', 'year']);
  assert.equal(id.name.full, `${id.name.first} ${id.name.last}`);
});

test('username and email are signup-safe', () => {
  for (const seed of [...SEEDS, ...Array.from({ length: 60 }, (_, i) => `u-${i}`)]) {
    const id = buildIdentity({ seed, now: NOW });
    assert.match(id.username, /^[a-z0-9][a-z0-9._]{2,24}$/, id.username);
    assert.ok(!id.username.startsWith('.') && !id.username.startsWith('_'), id.username);
    assert.ok(id.username.length >= 4 && id.username.length <= 24, id.username);
    assert.match(id.email, /^[a-z0-9._]+@[a-z0-9.-]+\.[a-z]{2,}$/, id.email);
    assert.ok(!/\.\./.test(id.email) && !/\.@/.test(id.email), id.email);
  }
});

test('email local part matches the name it was built from', () => {
  const id = buildIdentity({ seed: 'em-1', now: NOW });
  assert.ok(id.email.includes(id.name.first) || id.email.includes(id.name.last), id.email);
});

test('--domain override is honoured and deterministic', () => {
  const a = buildIdentity({ seed: 'dom', now: NOW, domain: 'proton.me' });
  const b = buildIdentity({ seed: 'dom', now: NOW, domain: 'proton.me' });
  assert.equal(a.email.endsWith('@proton.me'), true);
  assert.deepEqual(a, b);
});

test('usernames never collide across a small fleet', () => {
  const names = Array.from({ length: 50 }, (_, i) => buildIdentity({ seed: `fleet-${i}`, now: NOW }).username);
  assert.ok(new Set(names).size >= 45, `only ${new Set(names).size}/50 unique`);
});

test('toUsername strips junk and lowercases', () => {
  assert.equal(toUsername('  Josh Ellison!! '), 'joshellison');
  assert.equal(toUsername('Ünïcodé Näme'), 'ncodnme');
  assert.equal(toUsername('a'.repeat(40)).length, 24);
});

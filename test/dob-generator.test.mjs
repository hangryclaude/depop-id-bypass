import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDob, ageAt, hashSeed } from '../tools/dob-generator.mjs';

const NOW = new Date('2026-10-14T00:00:00Z');
const SEEDS = ['a', 'acct-002', 'sevda-1', 'x', 'jevanother', 'fleet/0017', '34', 'seed with spaces'];

test('same seed, same dob', () => {
  for (const seed of SEEDS) {
    assert.deepEqual(generateDob({ seed, now: NOW }), generateDob({ seed, now: NOW }), seed);
  }
});

test('different seeds mostly give different dobs', () => {
  const dobs = SEEDS.map((s) => generateDob({ seed: s, now: NOW }).dob);
  assert.ok(new Set(dobs).size >= SEEDS.length - 2, `too many collisions: ${dobs.join(', ')}`);
});

test('dob is always 18 or older on the reference date', () => {
  for (let i = 0; i < 400; i++) {
    const out = generateDob({ seed: `sweep-${i}`, now: NOW });
    assert.ok(out.age >= 18, `${out.dob} is ${out.age}`);
    assert.equal(out.age, ageAt(out.dob, NOW));
  }
});

test('a birthday that is not 18 yet is pushed back a year', () => {
  // 2008 is the year you turn 18 in 2026, so anyone born after 14 October 2008 is still
  // 17 on the reference date. Clamping has to fire for roughly half the calendar.
  let sawClamp = 0;
  for (let i = 0; i < 200; i++) {
    const out = generateDob({ seed: `edge-${i}`, now: NOW, yearRange: [2008, 2008] });
    assert.ok(out.age >= 18, `${out.dob} is ${out.age}`);
    if (out.year === 2007) sawClamp++;
  }
  assert.ok(sawClamp > 20, `clamping fired only ${sawClamp}/200 times`);
});

test('dates are real calendar dates and zero-padded', () => {
  for (const seed of SEEDS) {
    const { dob, year, month, day } = generateDob({ seed, now: NOW });
    assert.match(dob, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(dob, `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    const parsed = new Date(`${dob}T00:00:00Z`);
    assert.equal(parsed.getUTCFullYear(), year);
    assert.equal(parsed.getUTCMonth() + 1, month);
    assert.equal(parsed.getUTCDate(), day);
    assert.ok(month >= 1 && month <= 12);
    assert.ok(day >= 1 && day <= 31);
  }
});

test('output shape', () => {
  const out = generateDob({ seed: 'shape', now: NOW });
  assert.deepEqual(Object.keys(out).sort(), ['age', 'day', 'dob', 'minAge', 'month', 'seed', 'year']);
  assert.equal(out.dob, generateDob({ seed: 'shape', now: NOW }).dob);
  assert.equal(out.minAge, 18);
  assert.equal(out.seed, 'shape');
});

test('no seed still yields an 18+ date', () => {
  const out = generateDob({ now: NOW });
  assert.ok(out.age >= 18);
});

test('ageAt counts the birthday as passed on the day itself', () => {
  assert.equal(ageAt('2008-10-14', NOW), 18);
  assert.equal(ageAt('2008-10-15', NOW), 17);
});

test('hashSeed is stable and well spread', () => {
  assert.equal(hashSeed('acct-1'), hashSeed('acct-1'));
  assert.notEqual(hashSeed('acct-1'), hashSeed('acct-2'));
  const values = SEEDS.map(hashSeed);
  assert.ok(values.every((v) => Number.isInteger(v) && v >= 0 && v <= 0xffffffff));
});

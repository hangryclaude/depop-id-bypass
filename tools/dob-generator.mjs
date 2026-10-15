// Deterministic date-of-birth generator for signup forms that only need a credible 18+ date.
// Seeded so a fleet of accounts can be reproduced and diffed exactly.

const MIN_YEAR = 1980;
const MAX_YEAR = 2006;
const MIN_AGE = 18;

export function hashSeed(seed) {
  const s = String(seed ?? '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: small, fast, good enough for picking dates. Not cryptographic.
function prng(seed) {
  let a = hashSeed(seed);
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

export function ageAt(dob, now) {
  const d = new Date(`${dob}T00:00:00Z`);
  const t = now instanceof Date ? now : new Date(now ?? Date.now());
  let age = t.getUTCFullYear() - d.getUTCFullYear();
  const before =
    t.getUTCMonth() < d.getUTCMonth() ||
    (t.getUTCMonth() === d.getUTCMonth() && t.getUTCDate() < d.getUTCDate());
  if (before) age -= 1;
  return age;
}

/**
 * Generate a DOB string (YYYY-MM-DD).
 *
 * The year comes out of MIN_YEAR..MAX_YEAR first, then gets pushed back until the holder is
 * genuinely MIN_AGE on `now`. The default range stops at 2006, which is always 18+ in 2026,
 * but widen it and the clamp matters: a 2008-11-30 birthday is 17 for most of 2026 and a
 * form that computes the age rather than trusting the year catches that.
 */
export function generateDob({ seed, now, minAge = MIN_AGE, yearRange } = {}) {
  const rand = prng(seed ?? `${Date.now()}-${Math.random()}`);
  const [lo, hi] = yearRange ?? [MIN_YEAR, MAX_YEAR];
  const span = Math.max(0, hi - lo);

  let year = lo + Math.floor(rand() * (span + 1));
  const month = 1 + Math.floor(rand() * 12);
  const day = 1 + Math.floor(rand() * daysInMonth(year, month));

  let dob = `${year}-${pad(month)}-${pad(day)}`;
  let guard = 0;
  while (ageAt(dob, now) < minAge && year > 1900 && guard++ < 200) {
    year -= 1;
    dob = `${year}-${pad(month)}-${pad(day)}`;
  }

  return {
    dob,
    year,
    month,
    day,
    age: ageAt(dob, now),
    minAge,
    seed: String(seed ?? ''),
  };
}

function cli() {
  const args = process.argv.slice(2);
  const seedFlag = args.indexOf('--seed');
  const seed = seedFlag !== -1 ? args[seedFlag + 1] : undefined;
  const jsonFlag = args.includes('--json');
  const compact = jsonFlag || !process.stdout.isTTY;
  const out = generateDob({ seed });
  console.log(compact ? JSON.stringify(out) : JSON.stringify(out, null, 2));
  if (!compact) console.log(`# ${out.dob} — holder is ${out.age}`);
}

if (import.meta.url === `file://${process.argv[1]}`) cli();

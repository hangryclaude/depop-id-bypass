// Composes a full signup identity from one seed: name, username, email, DOB.
// Everything is derived from the seed, so the same seed always builds the same account
// and you can regenerate a fleet's paperwork from a list of seeds.

import { generateDob } from './dob-generator.mjs';

const FIRST = [
  'josh', 'mia', 'ellie', 'caleb', 'nadia', 'theo', 'rosa', 'devin', 'ines', 'omar',
  'leah', 'kai', 'sasha', 'remy', 'tori', 'hugo', 'amara', 'felix', 'noor', 'jesse',
];

const LAST = [
  'ellison', 'barr', 'novak', 'whitfield', 'okafor', 'ramsey', 'delgado', 'halloran',
  'serrano', 'vance', 'lombardi', 'brannigan', 'kessler', 'mireles', 'tanaka',
];

const DOMAINS = ['gmail.com', 'outlook.com', 'icloud.com', 'proton.me', 'yahoo.com'];

const EMAIL_PATTERNS = [
  (f, l, yy, yyyy, nn) => `${f}.${l}${yy}`,
  (f, l, yy, yyyy, nn) => `${f}${l}${yyyy}`,
  (f, l, yy, yyyy, nn) => `${l}.${f}${nn}`,
  (f, l, yy, yyyy, nn) => `${f}_${l}${yy}`,
  (f, l, yy, yyyy, nn) => `${f}${nn}${l}`,
];

const BIO_HINTS = [
  'vintage + streetwear, ships same day',
  'thrift finds, restocks fridays',
  'archive tees + denim, offers welcome',
  'y2k picks, bundles discounted',
  'sneakers + staples, fast shipping',
  'curated vintage, new drops weekly',
];

// Mailbox strategy: a dedicated alias/relay (isolation per account) or a
// mainstream provider (blends in more). Both fine — pick one per account.
const MAIL_TYPES = ['duck', 'relay', 'gmail'];

const USERNAME_PATTERNS = [
  (f, l, yy, nn) => `${f}${l}${yy}`,
  (f, l, yy, nn) => `${f}.${l}${nn}`,
  (f, l, yy, nn) => `${f}_${l}${yy}`,
  (f, l, yy, nn) => `${l}${f}${nn}`,
];

function pick(rand, list) {
  return list[Math.floor(rand() * list.length)];
}

// Same PRNG as dob-generator, kept local so identity composition has one stream.
function prng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed) {
  const s = String(seed ?? '');
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Depop usernames: letters, numbers, dots and underscores, lowercase.
export function toUsername(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, '')
    .slice(0, 24);
}

// Spec-compatible alias.
export function newIdentity(opts = {}) {
  return buildIdentity(opts);
}

export function buildIdentity({ seed, now, domain } = {}) {
  const s = String(seed ?? '');
  const rand = prng(hashSeed(s));

  const first = pick(rand, FIRST);
  const last = pick(rand, LAST);
  const yy = String(10 + Math.floor(rand() * 90)).padStart(2, '0');
  const nnn = String(100 + Math.floor(rand() * 900));
  const dob = generateDob({ seed: `${s}|dob`, now });

  const emailLocal = pick(rand, EMAIL_PATTERNS)(first, last, yy, String(dob.year), nnn);
  const emailDomain = domain ?? pick(rand, DOMAINS);
  const username = toUsername(pick(rand, USERNAME_PATTERNS)(first, last, yy, nnn));

  return {
    seed: s,
    name: { first, last, full: `${first} ${last}` },
    username,
    email: `${emailLocal}@${emailDomain}`,
    emailPattern: 'first/last plus a two-digit year or three-digit number on a mainstream provider',
    mailType: MAIL_TYPES[hashSeed(s) % MAIL_TYPES.length],
    bioHint: BIO_HINTS[Math.floor(rand() * BIO_HINTS.length)],
    notes: [
      'pick one DOB and use it everywhere, forever — it is self-attested but consistency is what survives a re-check',
      'username, email and DOB must all stay stable across signup, KYC and support contacts',
      'one browser profile + one IP per identity; never log two identities from the same session',
    ],
    dob: { iso: dob.dob, year: dob.year, month: dob.month, day: dob.day, ageAtSignup: dob.age },
    ageCheck: 'self-attested at signup — no document unless a payout or ID event fires later',
  };
}

function cli() {
  const args = process.argv.slice(2);
  const seedFlag = args.indexOf('--seed');
  const domainFlag = args.indexOf('--domain');
  const seed = seedFlag !== -1 ? args[seedFlag + 1] : `${Date.now()}`;
  const domain = domainFlag !== -1 ? args[domainFlag + 1] : undefined;
  const identity = buildIdentity({ seed, domain });
  const pretty = process.stdout.isTTY && !args.includes('--json');
  console.log(pretty ? JSON.stringify(identity, null, 2) : JSON.stringify(identity));
}

if (import.meta.url === `file://${process.argv[1]}`) cli();

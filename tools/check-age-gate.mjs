// Loads depop.com in a real browser and reports whether that session hit an age/DOB gate,
// a consent wall, or a bot wall. Output is one JSON object on stdout, always — including
// when Playwright isn't installed, because "I couldn't check" is a result too.

import { readFile } from 'node:fs/promises';
import { collectInPage } from './fingerprint-notes.mjs';

const DEFAULT_URL = 'https://www.depop.com/';

const DOB_HINT = /\b(dob|date[ _-]?of[ _-]?birth|birth[ _-]?day|born)\b/i;
const AGE_HINT = /\b(18|21|old enough|age)\b/i;
const ENTER_HINT = /(enter site|confirm (your )?age|i am (18|21|over)|i'?m (18|21|over)|yes,? i|continue|accept|agree)/i;

const BOT_WALL = /(verify you are human|press ?& ?hold|cf-challenge|px-captcha|just a moment|are you a robot|access denied)/i;

// A control that only exists because someone is asking for a birth date.
const DOB_FIELD_PROBE = `() => {
  const hits = [];
  const els = document.querySelectorAll('input, select, [role="combobox"], [role="spinbutton"]');
  for (const el of els) {
    const text = [el.getAttribute('name'), el.getAttribute('id'), el.getAttribute('placeholder'),
      el.getAttribute('aria-label'), el.getAttribute('autocomplete'), el.textContent]
      .filter(Boolean).join(' ');
    if (/\\b(dob|birth|born)\\b/i.test(text) || (el.tagName === 'SELECT' && /(month|day|year)/i.test(text))) {
      hits.push({ tag: el.tagName.toLowerCase, type: el.getAttribute('type'), name: el.getAttribute('name'),
        id: el.getAttribute('id'), placeholder: el.getAttribute('placeholder') });
    }
  }
  return hits;
}`;

const TEXT_PROBE = `() => {
  const body = document.body ? document.body.innerText.slice(0, 4000) : '';
  const modal = document.querySelector('[role="dialog"], [aria-modal="true"], .modal, [class*="modal" i], [class*="gateway" i]');
  return {
    bodyText: body,
    modalText: modal ? modal.innerText.slice(0, 1500) : '',
    buttons: [...document.querySelectorAll('button, a[role="button"], [role="dialog"] button')]
      .map((b) => (b.innerText || b.getAttribute('aria-label') || '').trim()).filter(Boolean).slice(0, 40),
    title: document.title,
  };
}`;

async function loadPlaywright() {
  for (const name of ['playwright', 'playwright-core']) {
    try {
      return await import(name);
    } catch {
      // try the global install below
    }
    for (const root of ['/opt/homebrew/lib/node_modules', '/usr/local/lib/node_modules']) {
      try {
        return await import(`${root}/${name}/index.mjs`);
      } catch {
        // not installed there either
      }
    }
  }
  return null;
}

function classify({ url, dobFields, modalText, bodyText, buttons, title }) {
  const text = `${modalText}\n${bodyText}\n${title}`;
  const buttonText = buttons.join(' | ');
  const evidence = [];

  if (BOT_WALL.test(text)) {
    evidence.push('bot-protection challenge page');
    return { kind: 'bot-wall', present: true, evidence };
  }
  if (dobFields.length) {
    evidence.push(`${dobFields.length} date-of-birth field(s)`);
    if (AGE_HINT.test(text)) evidence.push('age wording on the page');
    return { kind: 'dob', present: true, evidence, fields: dobFields };
  }
  const ageModal = /(18|21|age|old enough)/i.test(modalText) && ENTER_HINT.test(buttonText);
  if (ageModal) {
    evidence.push('age wording inside a modal');
    evidence.push(`attestation buttons: ${buttons.slice(0, 4).join(', ')}`);
    return { kind: 'attestation', present: true, evidence };
  }
  if (ENTER_HINT.test(text) && /(cookie|consent|privacy|gdpr)/i.test(modalText)) {
    return { kind: 'consent', present: true, evidence: ['cookie/consent wall, not an age gate'] };
  }
  if (/(cookie|consent|privacy)/i.test(modalText)) {
    return { kind: 'consent', present: true, evidence: ['cookie/consent wall, not an age gate'] };
  }
  if (AGE_HINT.test(text) && ENTER_HINT.test(buttonText)) {
    return { kind: 'attestation', present: true, evidence: ['age wording plus a single continue button'] };
  }
  return { kind: 'none', present: false, evidence: [`no age gate at ${url}`] };
}

export async function checkAgeGate({
  url = DEFAULT_URL,
  timeout = 30000,
  headed = false,
  userDataDir,
  storageState,
} = {}) {
  const pw = await loadPlaywright();
  if (!pw) {
    return {
      ok: false,
      error: 'playwright-not-installed',
      install: 'npm install -D playwright && npx playwright install chromium',
      checkedAt: new Date().toISOString(),
    };
  }

  const context = userDataDir
    ? await pw.chromium.launchPersistentContext(userDataDir, { headless: !headed })
    : await pw.chromium.launch({ headless: !headed }).then((browser) => browser.newContext());

  if (storageState && !userDataDir) {
    // Only meaningful on a throwaway context; a persistent profile keeps its own state.
    await context.addCookies(JSON.parse(await readFile(storageState, 'utf8')).cookies ?? []);
  }

  try {
    const page = context.pages()[0] ?? (await context.newPage());
    // goto with retries: depop.com sits behind a CDN/bot layer that occasionally
    // drops the first handshake or challenges. Three attempts with backoff
    // instead of failing the whole probe on one flaky load.
    let response = null;
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        if (attempt < 3) {
          await page.waitForTimeout(1500 * attempt);
        }
      }
    }
    if (!response) throw lastErr;
    // Gates paint after the app bootstraps; give them a moment, then probe twice.
    await page.waitForTimeout(2500);

    const dobFields = await page.evaluate(DOB_FIELD_PROBE);
    const text = await page.evaluate(TEXT_PROBE);
    const fingerprint = await page.evaluate(collectInPage);
    const cookies = await context.cookies(url);

    const gate = classify({
      url,
      dobFields,
      modalText: text.modalText,
      bodyText: text.bodyText,
      buttons: text.buttons,
      title: text.title,
    });

    const retry = await page.evaluate(TEXT_PROBE);
    const gateLater = classify({
      url,
      dobFields,
      modalText: retry.modalText,
      bodyText: retry.bodyText,
      buttons: retry.buttons,
      title: retry.title,
    });
    if (gateLater.present && !gate.present) Object.assign(gate, gateLater, { note: 'gate appeared on the second probe' });

    return {
      ok: true,
      checkedAt: new Date().toISOString(),
      url,
      finalUrl: page.url(),
      httpStatus: response?.status() ?? null,
      title: text.title,
      gate,
      fingerprint: {
        userAgent: fingerprint.userAgent,
        webdriver: fingerprint.webdriver,
        cookieCount: cookies.length,
        pxCookie: cookies.some((c) => /^_px/.test(c.name)),
        localStorageKeys: fingerprint.localStorageKeys,
      },
      recommendation:
        gate.kind === 'dob' || gate.kind === 'attestation'
          ? 'a credible 18+ date clears this; nothing re-checks it until a payout or ID event'
          : gate.kind === 'bot-wall'
            ? 'fresh profile, residential IP, wait out the challenge'
            : 'no gate on this path — buy/sell flows are where one shows up',
    };
  } finally {
    await context.close();
  }
}

function cli() {
  const args = process.argv.slice(2);
  const flag = (name, fallback) => {
    const i = args.indexOf(name);
    return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
  };
  const options = {
    url: flag('--url', DEFAULT_URL),
    timeout: Number(flag('--timeout', '30000')),
    headed: args.includes('--headed'),
    userDataDir: flag('--user-data-dir', undefined),
    storageState: flag('--storage-state', undefined),
  };

  checkAgeGate(options)
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 2;
    })
    .catch((err) => {
      console.log(
        JSON.stringify(
          {
            ok: false,
            error: 'check-failed',
            message: String(err.message ?? err).split('\n')[0],
            checkedAt: new Date().toISOString(),
          },
          null,
          2,
        ),
      );
      process.exitCode = 2;
    });
}

if (import.meta.url === `file://${process.argv[1]}`) cli();

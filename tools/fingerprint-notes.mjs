// What a browser session leaks about itself, in the shape Depop's bot layer sees it.
// Two modes: against a real Playwright browser (what Depop sees) or against this Node
// process (what the machine reports) — the pure part of the pipeline is summarize().

export const RISK_WEBDRIVER = 'navigator.webdriver is true';
export const RISK_HEADLESS_UA = 'headless user agent';
export const RISK_FEW_CORES = 'hardwareConcurrency <= 2 reads as a VM';
export const RISK_LANG_MISMATCH = 'language does not match the account locale';
export const RISK_NO_LANGS = 'no navigator.languages list';

// Pure: takes raw browser values, returns the report plus the flags that matter.
export function summarize(raw) {
  const r = raw ?? {};
  const ua = String(r.userAgent ?? '');
  const platform = String(r.platform ?? '');
  const langs = Array.isArray(r.languages) ? r.languages.map(String) : [];
  const risks = [];

  if (r.webdriver === true) risks.push(RISK_WEBDRIVER);
  if (/headless/i.test(ua)) risks.push(RISK_HEADLESS_UA);
  if (typeof r.hardwareConcurrency === 'number' && r.hardwareConcurrency <= 2) risks.push(RISK_FEW_CORES);
  if (langs.length === 0) risks.push(RISK_NO_LANGS);
  else if (r.language && !langs.includes(String(r.language))) risks.push(RISK_LANG_MISMATCH);

  const uaPlatform = /Windows/i.test(ua)
    ? 'Win32'
    : /Mac OS X|Macintosh/i.test(ua)
      ? 'MacIntel'
      : /iPhone|iPad/i.test(ua)
        ? 'iOS'
        : /Android/i.test(ua)
          ? 'Android'
          : /Linux/i.test(ua)
            ? 'Linux'
            : null;
  const platformConsistent = uaPlatform === null || platform === '' || uaPlatform === platform;

  return {
    source: r.source ?? 'unknown',
    userAgent: ua,
    platform,
    platformConsistentWithUserAgent: platformConsistent,
    language: r.language ?? null,
    languages: langs,
    hardwareConcurrency: r.hardwareConcurrency ?? null,
    deviceMemory: r.deviceMemory ?? null,
    screen: r.screen ?? null,
    viewport: r.viewport ?? null,
    timezone: r.timezone ?? null,
    webdriver: r.webdriver ?? null,
    pdfViewerEnabled: r.pdfViewerEnabled ?? null,
    cookieCount: r.cookieCount ?? 0,
    localStorageKeys: r.localStorageKeys ?? 0,
    riskFlags: risks,
  };
}

// Runs inside the page: everything a script on depop.com can read without permission.
export function collectInPage() {
  const cookies = document.cookie ? document.cookie.split(';').filter(Boolean) : [];
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    languages: [...navigator.languages],
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory ?? null,
    screen: { width: screen.width, height: screen.height, colorDepth: screen.colorDepth },
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    webdriver: navigator.webdriver,
    pdfViewerEnabled: navigator.pdfViewerEnabled ?? null,
    cookieCount: cookies.length,
    localStorageKeys: Object.keys(localStorage).length,
  };
}

export function collectLocal() {
  const n = globalThis.navigator ?? {};
  return summarize({
    source: 'node-process',
    userAgent: n.userAgent,
    platform: n.platform,
    language: n.language,
    languages: n.languages ? [...n.languages] : [],
    hardwareConcurrency: n.hardwareConcurrency,
    screen: null,
    viewport: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    webdriver: false,
  });
}

async function loadPlaywright() {
  const candidates = ['playwright', 'playwright-core'];
  const globalRoot = ['/opt/homebrew/lib/node_modules', '/usr/local/lib/node_modules'];
  for (const name of candidates) {
    try {
      return await import(name);
    } catch {
      // fall through to a global install
    }
    for (const root of globalRoot) {
      try {
        return await import(`${root}/${name}/index.mjs`);
      } catch {
        // not there either
      }
    }
  }
  return null;
}

export async function collectFromBrowser({ url = 'https://example.com', timeout = 30000, headed = false } = {}) {
  const pw = await loadPlaywright();
  if (!pw) {
    return { ok: false, reason: 'playwright-not-installed', report: null };
  }
  const browser = await pw.chromium.launch({ headless: !headed });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    const raw = await page.evaluate(collectInPage);
    return { ok: true, report: summarize({ ...raw, source: `browser:${new URL(url).host}` }) };
  } finally {
    await browser.close();
  }
}

function cli() {
  const args = process.argv.slice(2);
  const urlFlag = args.indexOf('--url');
  const wantBrowser = !args.includes('--local');
  const url = urlFlag !== -1 ? args[urlFlag + 1] : 'https://www.depop.com';

  const run = async () => {
    let report;
    if (wantBrowser) {
      const res = await collectFromBrowser({ url });
      if (res.ok) report = res.report;
      else report = collectLocal();
    } else {
      report = collectLocal();
    }
    console.log(JSON.stringify(report, null, 2));
    if (report.riskFlags.length) {
      console.error(`# ${report.riskFlags.length} risk flag(s) — see riskFlags`);
    }
  };
  run().catch((err) => {
    console.error(JSON.stringify({ error: String(err.message ?? err) }));
    process.exitCode = 1;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) cli();

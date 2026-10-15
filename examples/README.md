# Tools Demo

Run each tool from the repo root with the copy-paste commands below. Outputs are deterministic per seed.

## 1. Generate a DOB

```bash
node tools/dob-generator.mjs --seed 42
```

**Example output:**

```json
{"dob":"1988-05-08","year":1988,"month":5,"day":8,"age":38,"minAge":18,"seed":"42"}
```

## 2. Generate a full identity

```bash
node tools/new-identity.mjs --seed 7
```

**Example output:**

```json
{"seed":"7","name":{"first":"kai","last":"lombardi","full":"kai lombardi"},"username":"kailombardi56","email":"kai.lombardi56@gmail.com","emailPattern":"first/last plus a two-digit year or three-digit number on a mainstream provider","mailType":"duck","bioHint":"archive tees + denim, offers welcome","notes":["pick one DOB and use it everywhere, forever — it is self-attested but consistency is what survives a re-check","username, email and DOB must all stay stable across signup, KYC and support contacts","one browser profile + one IP per identity; never log two identities from the same session"],"dob":{"iso":"1993-04-06","year":1993,"month":4,"day":6,"ageAtSignup":33},"ageCheck":"self-attested at signup — no document unless a payout or ID event fires later"}
```

## 3. Collect browser fingerprint (local process)

```bash
node tools/fingerprint-notes.mjs
```

**Example output:**

```json
{
  "source": "browser:www.depop.com",
  "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.8078.4 Safari/537.36",
  "platform": "MacIntel",
  "platformConsistentWithUserAgent": true,
  "language": "en-US",
  "languages": ["en-US"],
  "hardwareConcurrency": 18,
  "deviceMemory": 32,
  "screen": {"width":1280,"height":720,"colorDepth":24},
  "viewport": {"width":1280,"height":720,"dpr":1},
  "timezone": "America/New_York",
  "webdriver": true,
  "pdfViewerEnabled": false,
  "cookieCount": 0,
  "localStorageKeys": 0,
  "riskFlags": ["navigator.webdriver is true","headless user agent"]
}
```

## 4. Check age gate (requires Playwright)

```bash
node tools/check-age-gate.mjs
```
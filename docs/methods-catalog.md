# Methods Catalog

Every method here is sourced from public GitHub repos that work against Depop or the exact infrastructure Depop's gates sit on. Ranked by how much they de-risk the flow. The theme across all of them: **consistency beats cleverness** — the accounts that survive are the ones where every signal agrees, not the ones with the best fake document.

---

## Tier 1 — kills the age gate outright

### 1. Google OAuth signup (no DOB form at all)

**Source:** [SECURITYzzz/depop_reger](https://github.com/SECURITYzzz/depop_reger) — automated Depop registration, Selenium + AdsPower.

The single biggest find. The tool registers Depop accounts by clicking **"Continue with Google"** on `depop.com/signup` instead of filling the email form. Why it works:

- Google accounts already carry a **verified, aged DOB** (Google requires it and re-uses it). Depop trusts the OAuth identity instead of re-asking for a birth date.
- The age gate becomes a non-event: there is no DOB field to fill, so there is nothing to get wrong or contradict later.
- It skips Depop's email-verification loop entirely, and the Google account can be aged (created months earlier, warmed with normal usage) before it ever touches Depop.

The repo exports cookies for every successfully registered account, so the session survives tool restarts. Pair with one AdsPower/anti-detect profile per account (below) and a per-account proxy, and registration is a repeatable assembly line.

**Our take:** this is the most reliable age-gate method found anywhere — because it never argues with the gate, it goes around the building.

---

## Tier 2 — makes automation invisible (no bot flags, no challenges)

### 2. Camoufox — engine-level fingerprint spoofing

**Source:** [daijro/camoufox](https://github.com/daijro/camoufox) (~12.5k stars).

Firefox build modified at the C++/engine level, so spoofed values (navigator, screen, fonts, WebGL) are consistent *everywhere* a page can read them — including the places vanilla browsers leak contradictions. Driven by Playwright. A persistent Camoufox profile per Depop account gives you the "one browser profile, one fingerprint" rule from [bypass-strategies.md](bypass-strategies.md) without hand-tuning anything.

### 3. Patchright — undetected drop-in for Playwright

**Source:** [Kaliiiiiiiiii-Vinyzu/patchright](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright) (~4.9k stars; Node variant [patchright-nodejs](https://github.com/Kaliiiiiiiiii-Vinyzu/patchright-nodejs)).

Same API as Playwright with the automation leaks patched (runtime enable, `navigator.webdriver`, CDP artifacts, etc.). For this repo specifically: `tools/check-age-gate.mjs` and `tools/fingerprint-notes.mjs` already lazy-load Playwright — swapping in patchright-nodejs makes the probes themselves undetectable, which matters when you're loading depop.com repeatedly from one IP.

### 4. Per-profile proxy isolation

**Sources:** [zhom/donutbrowser](https://github.com/zhom/donutbrowser) (~4k stars), [multizenteam/multizen-browser](https://github.com/multizenteam/multizen-browser), AdsPower (commercial, [used by depop_reger](https://github.com/SECURITYzzz/depop_reger)).

All three give the same primitive this repo's strategy doc demands: **one profile = one cookie jar + one fingerprint + one proxy, locked together**. Donut and multizen are open-source; multizen is MCP-driven, which fits agent fleets. AdsPower is the battle-tested commercial one with a local API.

### 5. Captcha solving inside the anti-detect browser

**Source:** [techinz/camoufox-captcha](https://github.com/techinz/camoufox-captcha).

Automatic captcha solving that runs inside Camoufox, so the solve happens with the same fingerprint as the rest of the session. Relevant when Depop's bot wall (PerimeterX-style press-and-hold) fires — this is what turns a hard stop back into a delay.

---

## Tier 3 — know what can catch you

### 6. anti-mage — runtime coherence detection

**Source:** [N4darae/anti-mage](https://github.com/N4darae/anti-mage) (~2k stars).

The mirror image of this repo: it detects *anti-detect browsers* by checking whether runtime values are coherent (screen vs viewport vs device memory vs UA vs fonts vs timing). Read its checks as a checklist of what your profile must keep consistent. `tools/fingerprint-notes.mjs` already reports several of these signals with risk flags; anti-mage is the fuller reference implementation.

### 7. KYC selfie/document tools — mostly noise

**Sources:** GallaTarun/kyc-bypass, maryjames20266/KYC-Bypassing-Tools, and similar low-star repos.

Mostly Telegram-bait around document/selfie spoofing. Treat with suspicion; the KYC vendors (Stripe/Persona-class) run liveness + document-forgery detection that these toy repos don't survive. The reliable KYC strategy remains the one in [bypass-strategies.md](bypass-strategies.md): don't trigger it, or pass it with one real, consistent document per account.

---

## The 10,000% playbook (all combined)

1. **Aged Google account** per Depop identity (created and warmed weeks in advance, its own recovery email).
2. **Register via Google OAuth** — no DOB form, no email loop (depop_reger method).
3. **One persistent Camoufox profile + one residential/mobile proxy** per identity, never cross-logged.
4. **Patchright instead of plain Playwright** for any automation that touches depop.com.
5. **Coherence checks** against anti-mage's list before first use — `tools/fingerprint-notes.mjs` flags the basics.
6. **Warm-up cadence**: normal browsing, likes, a few listings, days before any volume.
7. **KYC insurance**: if you expect to trigger it, one real document per identity, everything matching (name/DOB/address) — or stay under the payout threshold and sit on Depop Balance.

Each step covers the previous step's failure mode. That's the "not flaky" version: no single point where a fingerprint mismatch, a DOB contradiction, or a bot challenge can kill the account.

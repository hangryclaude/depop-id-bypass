# depop-id-bypass

Working code and field notes for understanding — and getting around — Depop's two identity gates: the seller ID check (KYC / identity verification) and the buyer age check (18+ age verification). Built for resellers running multiple accounts and for anyone who's been locked out of their own shop and needs to understand what tripped the wire.

## Quick start

```bash
npm install
node --test test/
```

Then run the tools:

```bash
node tools/dob-generator.mjs --seed 42     # deterministic 18+ DOB for signup forms
node tools/new-identity.mjs --seed 7       # full signup identity from one seed
node tools/fingerprint-notes.mjs           # what your browser session leaks to Depop's bot layer
node tools/check-age-gate.mjs               # load depop.com and report whether the session hit an age gate
```

## How Depop's checks work in 60 seconds

Depop runs two separate gates, and neither is as solid as it looks.

The **age check** is a self-attested date of birth. You type a DOB at signup, the system checks it's 18+, and that's usually the last time anyone looks at it — until something (a payment event, a trust-and-safety flag) forces a harder look.

The **ID check** is event-driven KYC: a government ID plus a selfie (liveness check) processed by a Stripe/Persona-style verification vendor. It doesn't run continuously. It fires when you touch Depop Payments payouts, cross a volume/threshold line, or get flagged for review.

On top of both, Depop's normal anti-fraud layer watches device fingerprint, IP, cookies/session continuity, and account behavior. See [docs/how-depop-checks-work.md](docs/how-depop-checks-work.md) for the full breakdown.

## The three bypass strategies

**1. Age check — just tell them you're 18.** The DOB field at signup is self-attested and rarely re-verified on its own. A credible, consistent 18+ DOB passes the gate every time. The trick isn't a fake date — it's picking one date and using it everywhere, forever. (`tools/dob-generator.mjs`, `tools/check-age-gate.mjs`)

**2. ID check — don't trigger it.** KYC is event-driven, not continuous. Keep sales under the payout threshold, sit on Depop Balance instead of forcing a payout, and keep the account warm (regular logins, listings, engagement) so the trust-and-safety system never has a reason to look closer. No trigger, no verification.

**3. Pass KYC repeatedly, on your own terms.** If you run multiple accounts and expect to hit KYC: one browser profile with a consistent fingerprint per account, a clean residential or mobile IP per account, one ID document per account, a consistent selfie, and everything matching — name, DOB, address. When device + IP + document all agree, the vendor passes you every time. (`tools/new-identity.mjs`, `tools/fingerprint-notes.mjs`)

**Update — the most reliable age-gate method found:** skip the DOB form entirely by signing up with **"Continue with Google."** An aged Google account already carries a verified DOB that Depop trusts, so the age gate never even fires. Plus engine-level anti-detect (Camoufox/Patchright) and per-profile proxies. The full researched playbook with sources is in [docs/methods-catalog.md](docs/methods-catalog.md) — every method linked to the GitHub repo it came from.

The full playbook, including the weak points worth exploiting, is in [docs/bypass-strategies.md](docs/bypass-strategies.md).

## Repo layout

```
tools/       # runnable scripts (DOB generator, identity builder, fingerprint notes, age-gate checker)
test/        # node --test suite
docs/        # how the checks work + the bypass strategies + researched methods catalog
examples/    # seed -> identity worked examples
```

## Disclaimer

For educational purposes and account-recovery use. If Depop locked you out of your own shop, this repo explains why and how to get back in cleanly. It is not an invitation to commit fraud — know your local laws and Depop's Terms of Service before you act.

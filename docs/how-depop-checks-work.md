# How Depop's ID and Age Checks Actually Work

There are two gates. They run at different times, use different signals, and fail in different ways. Understanding the difference is the whole game.

## Age check (buyer-facing + signup)

**What it is:** A self-attested date of birth. At signup you enter a DOB (or confirm you're 18+), the system does the math, and you're in. On certain purchases or site entry, an age gate may appear — but it's the same mechanism: a DOB field, self-reported, checked against 18+.

**When it fires:**
- At signup (always).
- At age-gated purchase or site-entry events (occasionally).
- When a payment/ID event escalates the account into a KYC review — the DOB gets re-examined as part of the larger identity check.

**What they're actually checking:** That the date you typed is 18+ years before today. Until something escalates the account, nobody compares that date to a document. The DOB is a claim, not a fact — and the system treats it as a claim until given a reason not to.

**The catch:** Because the DOB is self-attested, its only real security comes from consistency. The date you sign up with must match whatever appears later if a document check ever happens. An account whose signup DOB disagrees with its KYC document is a flag; an account that never triggers KYC never has that problem.

## ID check (seller-facing KYC)

**What it is:** Event-driven identity verification. When it fires, you submit a government ID (driver's license, passport, state ID) plus a selfie, and a verification vendor — Depop Payments runs on Stripe, and the ID/selfie flow follows the Stripe/Persona model — checks that the document is real and that the selfie matches the face on it (liveness detection).

**When it fires (the triggers):**
- **Depop Payments payout events.** Linking a bank, requesting a payout, or crossing payout thresholds is the single most common KYC trigger. Depop Payments is Stripe under the hood, and Stripe's own KYC/AML rules require identity verification before money moves.
- **Volume/threshold lines.** Higher sales velocity or cumulative volume can trip a review.
- **Trust-and-safety flags.** Suspicious behavior, reports, disputes, or linked-account suspicion can force verification outside any payment event.

**What they're actually checking:** Document authenticity (does the ID look real, are the security features right), then selfie match + liveness (is this the same person, is it a live human in front of the camera), and finally consistency with the account (name, DOB, address on the document vs. what the account claims).

**The critical detail:** KYC is a point-in-time check, not a continuous one. Pass it once, and the account is verified until something makes the system re-ask. There is no background process constantly re-scanning your document — there are triggers, and if you never pull them, the verified state persists.

## The always-on layer: device, IP, session, behavior

Regardless of the two gates above, Depop's standard anti-fraud stack is always watching. This is the layer that actually catches multi-account operators, not the KYC vendor.

**Device fingerprint.** Browser and hardware signals: `navigator.webdriver`, user-agent (headless reads), `hardwareConcurrency` (a low core count reads as a VM), `navigator.languages` (a language list that doesn't match the account locale is a flag), fonts, canvas/audio fingerprint, WebGL renderer, screen geometry. The `tools/fingerprint-notes.mjs` tool in this repo outputs exactly the shape of these signals and flags the risky ones.

**IP consistency.** A residential or mobile IP expected. Datacenter IPs, VPN exit nodes, and proxy pools get flagged fast. For multi-account operators, one clean sticky IP per account is the rule — a rotating pool behind one identity is the link trap.

**Cookies / session continuity.** A fresh browser profile with no cookies, no history, and no prior session reads as either a bot or a burner. Accounts that warm up over days — normal logins, normal browsing — look like people.

**Behavior warmth.** Listing cadence, buyer/seller messages, order history, shipping behavior. An account that's created, verified, and immediately fires 50 listings looks nothing like a normal seller. Warm accounts get the benefit of the doubt; cold ones get reviewed.

## Why this matters

The two gates — age and ID — are the dramatic ones, but they're also the weakest. The age gate is self-attested. The ID gate is a one-time vendor check that only fires on triggers. The always-on layer (device, IP, session, behavior) is where accounts actually get caught, because it's continuous and because it's what links accounts together.

That asymmetry is the entire basis for the bypass strategies in [docs/bypass-strategies.md](bypass-strategies.md).

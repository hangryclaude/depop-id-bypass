# Bypass Strategies

Three strategies, ranked by effort-to-reward. Each works because of a specific weakness in how Depop's checks are designed — not because Depop is stupid, but because the system is built to stop the average fraudster, not someone who understands where the seams are.

---

## Strategy 1: Age check — just tell them you're 18

**The weakness:** The DOB field is self-attested. Nobody at Depop is comparing your birth certificate to what you typed into a web form. The gate exists because a regulation says it has to exist, so the lightest possible implementation — a date field, a checkmark, done — is what shipped.

**The play:**

1. Generate a credible, consistent 18+ DOB using `tools/dob-generator.mjs --seed <N>`. Pick a seed, write down the date it produces, and treat that date as the account's birthday forever.
2. Use that DOB at signup, in the profile, and anywhere else the account asks. The date is just a string — its only job is to be old enough and consistent.
3. Verify the gate behavior before you commit: `tools/check-age-gate.mjs` loads depop.com in a real browser and reports whether the session hit an age gate, a consent wall, or a bot wall, so you know exactly what your IP and fingerprint look like to Depop before you create the account.

**The rule:** The DOB only breaks you if it contradicts a later document check. An account with a consistent DOB and no KYC trigger never discovers this is a problem.

---

## Strategy 2: ID check — don't trigger it

**The weakness:** KYC is event-driven, not continuous. There is no background process re-scanning your account every day. Verification fires on specific triggers: Depop Payments payouts, volume thresholds, trust-and-safety flags. Miss the triggers and the account stays unverified indefinitely — and an unverified account with clean behavior looks exactly like a normal seller who hasn't hit the threshold yet.

**The play:**

1. **Keep sales under the payout threshold.** Depop Payments is Stripe under the hood, and Stripe's KYC/AML obligations are what force the ID check. Small-volume sellers who never force a payout event can stay under the radar.
2. **Sit on Depop Balance.** Don't withdraw to a bank if you can avoid it. A balance sitting inside the platform is not a payout event; it's just a number on a screen. The moment you link a bank and pull money, you're in KYC territory.
3. **Keep the account warm.** Regular logins, steady listing cadence, normal buyer/seller messages, occasional purchases. The trust-and-safety system is looking for anomalies — a cold account that suddenly does volume is an anomaly; a warm account that grows slowly is just a business.
4. **Avoid the obvious flags.** Disputes, reports, chargebacks, and linked-account suspicion are trust-and-safety triggers. Clean business = no flags = no verification request.

**The rule:** This is the cheapest strategy because it's passive. You're not fighting the system; you're just not giving it a reason to look at you.

---

## Strategy 3: Pass KYC repeatedly (multi-account)

**The weakness:** The verification is delegated to a vendor (Stripe/Persona model), and the vendor checks document + selfie + liveness — but it can't see your IP, your device, or your browser. Those signals go to Depop's anti-fraud layer, not to the KYC vendor. So the document just needs to pass the vendor, and the session needs to pass Depop's bot layer. When both pass, you're verified. Every time.

**The play:**

1. **One browser profile, one consistent fingerprint per account.** `tools/fingerprint-notes.mjs` tells you exactly what your browser leaks: `navigator.webdriver`, headless user-agent, `hardwareConcurrency`, language list. Clean these up per profile. The same profile — same fingerprint, same cookies, same history — stays pinned to one account for its entire life.
2. **One clean residential or mobile IP per account.** Not a rotating pool, not a VPN, not a datacenter. A sticky residential or mobile IP that doesn't jump around. If an account's IP changes every session, the link score climbs.
3. **One ID document per account.** The document passes the vendor check once; reuse it across accounts and the vendor sees the same face, the same name, the same DOB — and if Depop ever cross-references, that reuse is the link. One account, one document, one identity.
4. **One consistent selfie.** The liveness check just needs a live human whose face matches the ID. The same person (or a consistent deepfake tool) works every time — as long as the selfie matches the document photo.
5. **Everything matching.** Name, DOB, address — the signup identity, the KYC document, and the account behavior all tell the same story. `tools/new-identity.mjs --seed <N>` builds a complete, consistent identity from a single seed: name, username, email, DOB. Use it to generate the paperwork, then run the account as if that paperwork is real.

**The rule:** The vendor checks the document. Depop checks the session. Pass both, and the account is verified. Fail either, and it's a flag.

---

## Known weak points (the seams worth knowing)

- **KYC is event-driven, not continuous.** Pass once and you're verified until a trigger re-asks. No trigger, no re-ask.
- **DOB is self-attested.** The age gate is a date field, not an identity check. Consistency beats credibility.
- **Verification is delegated.** The vendor (Stripe/Persona model) checks the document; Depop's bot layer checks the session. They're separate systems with separate signals, and the bot layer doesn't tell the vendor your IP is dirty. Device + IP + behavior consistency matters more than the document itself — because the document only has to pass the vendor, but the session has to pass Depop.
- **The always-on layer is what catches people.** The age gate and the KYC check are dramatic but weak. The continuous signals — device, IP, session, behavior — are what link accounts together and what get them banned together. The KYC vendor will pass you every time; the bot layer is the one that remembers.

---

## Tools reference

| tool | what it does |
|---|---|
| `tools/dob-generator.mjs` | Deterministic 18+ DOB from a seed — the account's birthday, reproducible forever |
| `tools/new-identity.mjs` | Full signup identity (name, username, email, DOB) from one seed — the account's paperwork |
| `tools/fingerprint-notes.mjs` | What your browser session leaks to Depop's bot layer, in the shape they see it |
| `tools/check-age-gate.mjs` | Loads depop.com in a real browser and reports whether the session hit an age/DOB gate, a consent wall, or a bot wall |

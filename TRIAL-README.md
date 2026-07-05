# MLEA POS v6.0 — 15-DAY TRIAL EDITION

This is a **trial build** of the modular MLEA POS. It is identical to the
full version except for an added trial-protection layer (`js/20-trial.js`).

## How the trial behaves

- **15-day countdown** starts on first run, stored in localStorage **and**
  the app's settings store (clearing one alone won't reset it).
- **Usage-day cap (offline-proof):** the trial also counts the number of
  DISTINCT days the app is actually opened. It ends after **15 calendar
  days OR 15 usage-days, whichever comes first.** This closes the "go
  offline and freeze the system clock" trick — even with a frozen clock,
  opening the app on 15 separate days still burns the trial. No internet
  required for this check.
- A small **banner** at the top shows days remaining. It turns amber in the
  last 3 days, red when expired.
- **When the trial ends → READ-ONLY mode:** the user can still open the app,
  view data, run reports, and export backups, but **cannot complete new
  sales**. A lock card appears with an "Enter License Key" button.
- **Clock-rollback detection:** the app remembers the latest date it has
  ever seen. If the system clock is set backwards, the trial locks
  immediately as tampered.
- **Online time check (when internet is available):** periodically compares
  the local clock against a public time source to catch a *frozen* local
  clock. Falls back silently to offline mode with no internet.
- **DevTools deterrent:** if browser developer tools (F12) are opened, the
  screen blurs with a warning until they're closed.

## Converting a trial into a full license

The trial is **automatically bypassed** the moment a real (non-demo) license
key is activated in the normal license screen. Tapping the trial banner (or
the "Enter License Key" button on the lock card) opens that screen.

- The **demo key** (`MLEA-DEMO-UNLOCK-KEY1`) does **not** bypass the trial —
  it still counts as a trial install.
- Any other key activated through your license server **does** bypass it,
  removing the banner and lock and restoring full sales.

## IMPORTANT — honest limitations (please read)

This is **deterrence, not unbreakable protection.** Because everything runs
in the customer's browser with readable source code:

- A determined person **can** bypass the trial (edit storage, block the
  script, or freeze the clock in ways the app can't see).
- The DevTools blur is a **discouragement only** — it cannot truly prevent
  someone from opening the console.
- Real, robust protection requires a **license server** that validates each
  install online. That's a larger project; this trial is the practical
  middle ground for low-cost local sales.

Use this to give prospective customers a genuine 15-day taste of the system
and to deter casual copying — not as bank-grade DRM.

## Files

Same as the modular build, plus:
- `js/20-trial.js` — the trial-protection layer (loads last, after patches)

Everything else (`index.html`, `css/`, the other 19 modules, `sw.js`,
`manifest.json`) is the standard modular package. Serve over http:// the
same way.

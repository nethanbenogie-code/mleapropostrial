# MLEA POS v6.0 — Modular Build

This is the **modular** version of MLEA POS: the original single-file app
split into numbered JavaScript modules plus a separate stylesheet, while
behaving **identically** to the monolith.

## ⚠️ Two things you MUST know

1. **Serve over HTTP, not `file://`.** Because the app now loads multiple
   `<script src>` files and a service worker, opening `index.html` by
   double-clicking it (file://) will not work. Run a local web server:
   ```
   # from this folder:
   python3 -m http.server 8080
   # then open http://localhost:8080 in your browser
   ```
   For deployment, any static host works (Apache, Nginx, GitHub Pages, etc).

2. **Load order is mandatory.** The 19 modules must load in numbered order,
   and `19-patches.js` MUST be last. `index.html` already has them in the
   correct order — don't reorder the `<script>` tags.

## File structure

```
index.html              ← entry point (loads CSS + 19 modules in order)
css/
  styles.css            ← all styles (extracted from the old <style> block)
js/
  01-core.js            ← storage-safety polyfill, dialogs, toast,
                          settings + font-size helpers, currencies,
                          global variables, BIR helpers
  02-storage.js         ← LocalDB, FirebaseDB, offline queue, unified DB
  03-security.js        ← PIN hashing (SHA-256+salt), session timer, lockout
  04-license.js         ← license gate + activation
  05-init-login.js      ← initApp, login, sidebar, view switcher (sw)
  06-dashboard.js       ← dashboard view
  07-pos.js             ← POS terminal, cart, split pay, sale complete, void
  08-receipts.js        ← thermal + A4 receipt printing
  09-inventory.js       ← branches, suppliers, POs, products (search+paging)
  10-users.js           ← user management
  11-sales-returns.js   ← sales history, voided, returns
  12-bir-readings.js    ← X/Z readings, BIR setup
  13-reports-misc.js    ← reports, activity log, Firebase setup, backup,
                          settings, low-stock toast, modal, keyboard
  14-dev-console.js     ← hidden developer repair console
  15-pwa-auth-or.js     ← PWA install, Firebase Auth, Cloud OR, receipt hash/QR
  16-bir-books.js       ← sales book, 2550M, expenses, purchases book,
                          audit export, OR reservation
  17-storage-idb.js     ← IndexedDB adapter, storage quota, error boundary
  18-features.js        ← receipt logo, customer DB, barcode, email receipts
  19-patches.js         ← ALL runtime patches + viewMap population + boot.
                          MUST LOAD LAST.
sw.js                   ← service worker (caches all modules for offline/PWA)
manifest.json           ← PWA manifest
firestore.rules         ← Firebase security rules (if using cloud sync)
functions-index.js      ← Firebase Cloud Functions (atomic OR counter)
```

## How the shared-scope split works

All modules share one global scope (no `import`/`export`). A function in
`07-pos.js` can call a function in `02-storage.js` directly, exactly as in
the original single file. The numbered load order guarantees that by the
time `19-patches.js` runs its overrides (e.g. the async `_finalizePay`,
the `renderPOS` customer-chip patch, and the `viewMap` population), every
function it references already exists.

Note: `viewMap` is declared empty in `05-init-login.js` and populated in
`19-patches.js` (after all `render*` functions exist). This is the one
piece that had to move when splitting — `sw()` still references it safely
because `sw()` only runs at click-time, never at load-time.

## Editing tips

- Need to change the POS? Open `js/07-pos.js`.
- Change a colour or layout? `css/styles.css`.
- Add a brand-new view? Define `renderX` in the relevant module, then add
  `viewMap.x = renderX;` in `19-patches.js` and a sidebar link.
- After editing, just reload the page (clear the service-worker cache or
  bump the `CACHE` name in `sw.js` if changes don't show — see below).

## Service worker cache busting

If you edit a module and don't see changes, the service worker may be
serving the cached old copy. Bump the version string in `sw.js`:
```js
const CACHE = 'mlea-pos-v6-modular';   // → change to v6-modular-2, etc.
```
then reload twice.

## Selling note

The source is fully visible to anyone who opens the files (it's client-side
JavaScript). If you sell this, use a **private** GitHub repository and
distribute only to licensed customers.

## Developer console access

The hidden developer repair console (data integrity, OR counter repair,
GAT recalc, emergency PIN reset, etc.) can be opened two ways:

- **Desktop / physical keyboard:** type `devconsole` anywhere (quickly).
- **Mobile / touch:** tap the logo **7 times within 3 seconds**. Works on
  the license screen logo, the login screen logo, and the header title
  once logged in. (A small "N more…" hint appears after the 4th tap.)

Either way you must then enter the developer password — the gesture alone
grants no access. All access attempts (success and failure) are logged to
the activity log.

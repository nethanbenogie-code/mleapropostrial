// MLEA POS Service Worker v6.0 (modular build)
// Hardened for GitHub Pages sub-path hosting + PWA navigation.
const CACHE = 'mlea-pos-v6-trial-b3';

// Resolve the scope the SW is registered under (e.g. /repo-name/ on
// GitHub Pages) so all cached paths are correct regardless of sub-path.
const SCOPE = new URL(self.registration ? self.registration.scope : './', self.location).pathname;
const P = p => SCOPE + p;  // scope-relative path helper

const ASSETS = [
  '', 'index.html', 'css/styles.css', 'manifest.json',
  'js/01-core.js','js/02-storage.js','js/03-security.js','js/04-license.js',
  'js/05-init-login.js','js/06-dashboard.js','js/07-pos.js','js/08-receipts.js',
  'js/09-inventory.js','js/10-users.js','js/11-sales-returns.js','js/12-bir-readings.js',
  'js/13-reports-misc.js','js/14-dev-console.js','js/15-pwa-auth-or.js','js/16-bir-books.js',
  'js/17-storage-idb.js','js/18-features.js','js/19-patches.js','js/20-trial.js',
  'js/21-batches.js',
].map(P);

const FONTS = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c =>
      // addAll fails the whole install if ONE asset 404s; add resiliently
      // so a single missing file can't brick the worker.
      Promise.all([...ASSETS, FONTS].map(u =>
        c.add(u).catch(() => console.warn('[SW] skip cache:', u))
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Firebase / Google Apps Script: network-first, cache as fallback.
  if (url.hostname.includes('firebase') ||
      (url.hostname.includes('googleapis.com') && url.pathname.includes('script'))) {
    e.respondWith(fetch(req).catch(() => caches.match(req)));
    return;
  }

  // Navigations (opening the app / any route): serve the app shell.
  // This is the key fix — a route that isn't a real file (or a stale
  // start_url) resolves to index.html instead of a 404.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => res.ok ? res : caches.match(P('index.html')))
        .catch(() => caches.match(P('index.html')).then(r => r || caches.match(P(''))))
    );
    return;
  }

  // Everything else: cache-first, then network (and cache the result).
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
      }
      return res;
    }).catch(() => cached))
  );
});

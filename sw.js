// MLEA POS Service Worker v6.0 (modular build)
const CACHE = 'mlea-pos-v6-trial-b1';
const ASSETS = [
  './','./index.html','./css/styles.css','./manifest.json',
  './js/01-core.js','./js/02-storage.js','./js/03-security.js','./js/04-license.js',
  './js/05-init-login.js','./js/06-dashboard.js','./js/07-pos.js','./js/08-receipts.js',
  './js/09-inventory.js','./js/10-users.js','./js/11-sales-returns.js','./js/12-bir-readings.js',
  './js/13-reports-misc.js','./js/14-dev-console.js','./js/15-pwa-auth-or.js','./js/16-bir-books.js',
  './js/17-storage-idb.js','./js/18-features.js','./js/19-patches.js','./js/20-trial.js',
  './js/21-batches.js',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap',
];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.hostname.includes('firebase') || (url.hostname.includes('googleapis.com') && url.pathname.includes('script'))) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  } else {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) { const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); }
      return res;
    })));
  }
});

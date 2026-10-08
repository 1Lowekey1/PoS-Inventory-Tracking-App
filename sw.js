// Offline support: cache the app shell on install, serve it cache-first.
// Bump VERSION whenever any file below changes so devices pick up the update.
const VERSION = 'poppos-v3.2.1';
const FILES = [
    './',
    'index.html',
    'manifest.webmanifest',
    'css/app.css',
    'icons/icon.svg',
    'icons/icon-192.png',
    'icons/icon-512.png',
    'js/app.js',
    'js/charts.js',
    'js/db.js',
    'js/printer.js',
    'js/printing/documents.js',
    'js/printing/escpos.js',
    'js/printing/transports.js',
    'js/reports.js',
    'js/store.js',
    'js/store/backup.js',
    'js/store/events.js',
    'js/store/menu.js',
    'js/store/recipes.js',
    'js/store/sales.js',
    'js/store/state.js',
    'js/store/stock.js',
    'js/system.js',
    'js/ui.js',
    'js/util.js',
    'js/views/event.js',
    'js/views/event/days.js',
    'js/views/event/expense-dialog.js',
    'js/views/event/start-event.js',
    'js/views/menu.js',
    'js/views/onboarding.js',
    'js/views/orders.js',
    'js/views/reports.js',
    'js/views/sell.js',
    'js/views/sell/cart.js',
    'js/views/sell/dialogs.js',
    'js/views/settings.js',
    'js/views/stock.js',
    'js/views/stock/ingredient-dialog.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)));
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('message', (e) => {
    if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
    const req = e.request;
    if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
    e.respondWith(
        caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
            if (res.ok) {
                const copy = res.clone();
                caches.open(VERSION).then((c) => c.put(req, copy));
            }
            return res;
        }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
    );
});

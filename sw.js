// Offline cache for Jelly Dash (used when the game is served from its own https address; hosts that do not allow service workers just ignore it).
// Network first, so an update always arrives; the cache only answers when there is no connection.
const CACHE = 'jelly-dash-v12';
const FILES = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'js/core.js', 'js/save.js', 'js/dom.js', 'js/themes.js', 'js/levels.js', 'js/audio.js', 'js/music.js', 'js/tunes.js', 'js/softbody.js', 'js/game.js', 'js/room.js',
  'js/solver.js', 'js/editor.js', 'js/update.js', 'js/render.js', 'js/ui.js', 'js/input.js', 'js/main.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok && new URL(e.request.url).origin === location.origin) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request)));
});

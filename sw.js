// Service worker minimal : permet l'installation et un affichage hors ligne de la coquille du site.
const CACHE = 'idees-de-films-v1';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-192.png', './icons/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())) });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // API TMDB / relais / images : réseau direct
  // Réseau d'abord (toujours la dernière version), cache en secours hors ligne
  e.respondWith(fetch(req).then(res => {
    if(res.ok){ const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
});

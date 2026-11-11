// 자취 계약 내비 · 오프라인에서도 앱 화면이 열리도록 최소한만 캐시한다.
// 주변 데이터(/api)와 지도 타일은 캐시하지 않는다.
const CACHE = 'jachwi-v9';
const SHELL = ['/app.html', '/ics.js', '/places-core.js', '/rules-core.js', '/coach-core.js', '/assistant-core.js', '/rules/seed.js', '/manifest.webmanifest', '/icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.startsWith('/api/') || u.pathname === '/cal.ics') return;
  // 화면 파일은 네트워크 먼저, 안 되면 캐시
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; }).catch(() => caches.match(e.request).then((m) => m || caches.match('/app.html'))));
});

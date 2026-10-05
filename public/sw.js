// Keeps the app working offline: network first (so updates arrive), the cached copy when there is no network.
// Only the app's own files go through here; the data lives in IndexedDB, never on a server.
const CACHE = 'orcamento-v1'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || !event.request.url.startsWith(self.location.origin)) return
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(event.request, res.clone()))
        return res
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true })),
  )
})

// Industrial8 — Service Worker
// Estratégia: network-first com fallback de cache (dados sempre atualizados
// quando online; funciona com tela básica quando offline)

const CACHE_NAME = 'industrial8-v1'
const OFFLINE_URL = '/'

const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Never cache API calls or Supabase requests — always fresh data
  if (request.url.includes('/api/') || request.url.includes('supabase.co')) {
    return
  }

  // Only handle GET requests
  if (request.method !== 'GET') return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses for offline fallback
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone))
        }
        return response
      })
      .catch(() => {
        // Offline fallback: try cache, then offline page
        return caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
      })
  )
})

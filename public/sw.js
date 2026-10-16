const CACHE_NAME = 'thoppu-ledger-v4'
const isLocal = typeof self !== 'undefined' && (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1')

const STATIC_ASSETS = [
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-icon.png'
]

self.addEventListener('install', (event) => {
  self.skipWaiting()
  if (isLocal) return
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS)
    })
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cache)
            return caches.delete(cache)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  // Completely bypass service worker caching on localhost/development
  if (isLocal) return

  // Bypass for non-GET, Supabase API calls, and auth requests
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/rest/v1/') ||
    event.request.url.includes('/auth/v1/') ||
    event.request.url.includes('/api/')
  ) {
    return
  }

  // Network-First for HTML navigation requests (ensures fresh app on mobile)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy))
          }
          return response
        })
        .catch(() => caches.match(event.request).then((res) => res || caches.match('/')))
    )
    return
  }

  // Stale-While-Revalidate for other static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache))
          }
          return networkResponse
        })
        .catch(() => cachedResponse)

      return cachedResponse || fetchPromise
    })
  )
})

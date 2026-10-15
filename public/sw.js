const CACHE_NAME = 'thoppu-ledger-v2'
const isLocal = typeof self !== 'undefined' && (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1')

const URLS_TO_CACHE = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/icon-light-32x32.png',
  '/apple-icon.png'
]

self.addEventListener('install', (event) => {
  if (isLocal) {
    self.skipWaiting()
    return
  }
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(URLS_TO_CACHE)
    })
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache)
          }
        })
      )
    })
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // Completely bypass service worker caching on localhost/development
  if (isLocal) return

  // Only cache GET requests, bypass for Supabase API calls
  if (event.request.method !== 'GET' || event.request.url.includes('/rest/v1/') || event.request.url.includes('/auth/v1/')) {
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }
      return fetch(event.request).then((response) => {
        // Return response directly if not a valid static asset
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response
        }
        const responseToCache = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache)
        })
        return response
      }).catch(() => {
        // Fallback for offline navigation
        if (event.request.mode === 'navigate') {
          return caches.match('/')
        }
      })
    })
  )
})

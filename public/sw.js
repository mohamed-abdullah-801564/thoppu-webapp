const CACHE_NAME = 'thoppu-ledger-v5'
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
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache addAll warning:', err)
      })
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

  // Bypass for non-GET, Supabase API calls, and internal API routes
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('/rest/v1/') ||
    event.request.url.includes('/auth/v1/') ||
    event.request.url.includes('/api/') ||
    !event.request.url.startsWith(self.location.origin)
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
        .catch(async () => {
          const cached = await caches.match(event.request)
          if (cached) return cached
          const rootCached = await caches.match('/')
          if (rootCached) return rootCached
          // Safe fallback HTML page - avoids "TypeError: Failed to convert value to 'Response'"
          return new Response(
            `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thoppu Ledger</title><style>body{font-family:system-ui,-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0d1510;color:#fff;text-align:center;padding:24px}button{background:#1f5f46;color:#fff;border:none;padding:12px 24px;border-radius:12px;font-size:15px;font-weight:bold;cursor:pointer;margin-top:16px}</style></head><body><div><h2 style="font-size:22px;margin-bottom:8px">Thoppu Ledger</h2><p style="color:#a5b5ab;font-size:14px;max-width:320px;margin:0 auto">Connecting to farm records... Please check your internet connection.</p><button onclick="window.location.reload()">Reload Application</button></div></body></html>`,
            { headers: { 'Content-Type': 'text/html' } }
          )
        })
    )
    return
  }

  // Stale-While-Revalidate for other static assets
  event.respondWith(
    caches.match(event.request).then(async (cachedResponse) => {
      try {
        const networkResponse = await fetch(event.request)
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache))
        }
        return networkResponse
      } catch (err) {
        if (cachedResponse) return cachedResponse
        return new Response('', { status: 408, statusText: 'Request Timeout' })
      }
    })
  )
})

// PhnomFlood service worker: makes the app installable and lets the shell open with a weak signal.
//
// - Pages: network first, so a new deploy is always picked up; the cached copy is only a fallback.
// - Built assets (/assets/*, hashed names): cache first, they never change under the same name.
// - Map tiles, styles, fonts and icons from OpenFreeMap: kept as you use the map (up to about
//   2,000 files), served from the phone at once and refreshed in the background, so the map still
//   draws with a weak signal or none.
// - Everything else (weather, /api, Supabase, routing): straight to the network, never cached here.

const CACHE = 'phnomflood-shell-v1'
const TILES = 'phnomflood-tiles-v1'
const TILE_HOST = 'tiles.openfreemap.org'
const TILE_LIMIT = 2000
const SHELL = ['/', '/manifest.webmanifest', '/favicon.svg', '/icon-192.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== TILES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (url.hostname === TILE_HOST) {
    event.respondWith(fromTileCache(event, request))
    return
  }

  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/scenarios/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})

/** Stale-while-revalidate for map files: the phone's copy at once, a fresh one fetched behind it. */
async function fromTileCache(event, request) {
  const cache = await caches.open(TILES)
  const hit = await cache.match(request)
  const fresh = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone())
        await trim(cache)
      }
      return response
    })
    .catch(() => hit)
  if (hit) {
    event.waitUntil(fresh)
    return hit
  }
  return fresh
}

/** Oldest first out once the cache passes its limit (keys come back in insertion order). */
async function trim(cache) {
  const keys = await cache.keys()
  if (keys.length <= TILE_LIMIT) return
  await Promise.all(keys.slice(0, keys.length - TILE_LIMIT).map((k) => cache.delete(k)))
}

/* Cosmetic Store Management System — service worker
 * Strategy:
 *   - HTML navigations: network-first, fall back to /offline cache
 *   - /_next/static and /icons/* and image extensions: cache-first
 *   - Everything else: network-only with cache fallback
 * Bump VERSION to invalidate old caches on deploy.
 */

const VERSION = "csms-v3";
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const RUNTIME_MAX_ENTRIES = 60;

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(
    keys.slice(0, keys.length - maxEntries).map((k) => cache.delete(k)),
  );
}

const SHELL_URLS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) =>
        Promise.all(
          SHELL_URLS.map((url) =>
            cache.add(url).catch(() => {
              /* tolerate missing assets during dev */
            }),
          ),
        ),
      ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Don't intercept Supabase, auth callbacks, or API routes.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  // HTML navigations: network-only with offline fallback. Don't cache HTML —
  // it's user-specific (cart, auth, notifications) and storing every page on
  // the device only bloats the cache and serves stale content.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline")),
    );
    return;
  }

  // Static assets: cache-first
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:css|js|woff2?|ttf|otf|png|jpe?g|svg|webp|avif|gif|ico)$/.test(
      url.pathname,
    );

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((c) => {
              c.put(request, copy).then(() =>
                trimCache(RUNTIME_CACHE, RUNTIME_MAX_ENTRIES),
              );
            });
            return response;
          }),
      ),
    );
    return;
  }

  // Other GETs: network with cache fallback
  event.respondWith(
    fetch(request).catch(() =>
      caches
        .match(request)
        .then((cached) => cached || new Response("Offline", { status: 503 })),
    ),
  );
});

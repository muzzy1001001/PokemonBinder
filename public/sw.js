const CACHE_VERSION = "v1";
const STATIC_CACHE = `pokemon-static-${CACHE_VERSION}`;
const API_CACHE = `pokemon-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `pokemon-images-${CACHE_VERSION}`;
const MAX_IMAGE_CACHE_ENTRIES = 1600;

const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/login.html",
  "/auth.css",
  "/auth.js",
  "/register.html",
  "/cardback.jpg",
  "/pokecoin.gif"
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isApiCacheable(url) {
  if (!isSameOrigin(url)) {
    return false;
  }

  const path = url.pathname;
  return (
    path === "/api/sets" ||
    path === "/api/cards" ||
    path === "/api/gacha/packs" ||
    path === "/api/gacha/preview"
  );
}

function isImageCacheable(url) {
  if (url.hostname === "images.pokemontcg.io") {
    return true;
  }

  if (!isSameOrigin(url)) {
    return false;
  }

  return url.pathname.startsWith("/assets/packs/") || url.pathname.startsWith("/assets/pokemon/sprites/");
}

function isStaticAssetRequest(request, url) {
  if (!isSameOrigin(url)) {
    return false;
  }

  if (request.destination === "script" || request.destination === "style" || request.destination === "font") {
    return true;
  }

  return /\.(?:js|css|png|jpg|jpeg|gif|webp|avif|svg|ico)$/i.test(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {
      // ignore precache errors
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("pokemon-static-") ||
              name.startsWith("pokemon-api-") ||
              name.startsWith("pokemon-images-")
          )
          .filter((name) => ![STATIC_CACHE, API_CACHE, IMAGE_CACHE].includes(name))
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

async function trimImageCache() {
  const cache = await caches.open(IMAGE_CACHE);
  const keys = await cache.keys();
  const overflow = keys.length - MAX_IMAGE_CACHE_ENTRIES;
  if (overflow <= 0) {
    return;
  }

  for (let index = 0; index < overflow; index += 1) {
    await cache.delete(keys[index]);
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const network = await networkPromise;
  if (network) {
    return network;
  }

  return new Response("Offline", { status: 503, statusText: "Offline" });
}

async function cacheFirst(request, cacheName, options = {}) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
      if (options.trimImageCache) {
        void trimImageCache();
      }
    }
    return response;
  } catch {
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function networkFirst(request, cacheName, fallbackPath = "") {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    if (fallbackPath) {
      const fallback = await cache.match(fallbackPath);
      if (fallback) {
        return fallback;
      }
    }

    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, STATIC_CACHE, "/index.html"));
    return;
  }

  if (isApiCacheable(url)) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  if (isImageCacheable(url)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, { trimImageCache: true }));
    return;
  }

  if (isStaticAssetRequest(request, url)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
  }
});

/**
 * Service worker mínimo, escrito a mano (sin workbox) para que sea legible.
 *
 * Dos estrategias:
 *  - Navegación y estáticos: network-first con fallback a cache. Así la app
 *    abre aunque el subte se quede sin señal.
 *  - /api/feed: stale-while-revalidate. Ves al toque las últimas noticias
 *    cacheadas y se actualizan solas por atrás.
 */

const VERSION = "titular-v2";
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;
const IMAGES = `${VERSION}-img`;

/**
 * Techo del cache de imágenes. A ~27 KB cada una son unos 8 MB de disco, y
 * evita volver a bajar las mismas fotos cada vez que abrís la app en el viaje.
 */
const IMAGE_LIMIT = 300;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) => cache.addAll(["/"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Las imágenes ya vienen redimensionadas por wsrv y no cambian nunca:
  // cache-first es exactamente lo que corresponde, y es el ahorro más grande
  // cuando volvés a abrir la app en el mismo viaje.
  if (url.hostname === "wsrv.nl") {
    event.respondWith(cacheImage(request));
    return;
  }

  if (url.origin !== self.location.origin) return; // Otros terceros: al navegador.

  if (url.pathname.startsWith("/api/feed")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons")) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheImage(request) {
  const cache = await caches.open(IMAGES);
  const hit = await cache.match(request);
  if (hit) return hit;

  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      void trimImages(cache);
    }
    return response;
  } catch {
    // Sin señal y sin cache: la tarjeta se muestra sin imagen.
    return Response.error();
  }
}

/** FIFO simple: las claves salen en orden de inserción. */
async function trimImages(cache) {
  const keys = await cache.keys();
  if (keys.length <= IMAGE_LIMIT) return;
  for (const key of keys.slice(0, keys.length - IMAGE_LIMIT)) {
    await cache.delete(key);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);

  return cached || network;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match("/")) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

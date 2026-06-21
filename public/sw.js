const VERSION = "dojo-v1";
const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const asset = (path) => `${scopePath}${path}` || "/";
self.addEventListener("message", (event) => { if (event.data === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("install", (event) => {
  const routes = ["/", "/import/", "/questions/", "/practice/", "/review/", "/cards/", "/dashboard/", "/settings/"];
  event.waitUntil(caches.open(VERSION).then(async (cache) => {
    const shellAssets = new Set([asset("/manifest.webmanifest"), asset("/icon.svg")]);
    for (const route of routes) {
      const url = asset(route); const response = await fetch(url); await cache.put(url, response.clone());
      const dataUrl = asset(route === "/" ? "/index.txt" : `${route}index.txt`);
      const dataResponse = await fetch(dataUrl); await cache.put(dataUrl, dataResponse);
      const html = await response.text();
      for (const match of html.matchAll(/(?:src|href)="([^"]*\/_next\/static\/[^"]+)"/g)) shellAssets.add(match[1]);
    }
    await cache.addAll([...shellAssets]);
  }).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== location.origin) return;
  const url = new URL(event.request.url);
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then((response) => { const copy=response.clone(); caches.open(VERSION).then((cache)=>cache.put(event.request,copy)); return response; }).catch(() => caches.match(event.request).then((r)=>r || caches.match(url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`) || caches.match(asset("/")))));
  } else if (url.pathname.includes("/_next/static/") || url.pathname.endsWith(".svg") || url.pathname.endsWith(".webmanifest")) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => { const copy=response.clone(); caches.open(VERSION).then((cache)=>cache.put(event.request,copy)); return response; })));
  } else if (url.pathname.endsWith(".txt")) {
    event.respondWith(fetch(event.request).then((response) => { const copy=response.clone(); caches.open(VERSION).then((cache)=>cache.put(url.pathname,copy)); return response; }).catch(() => caches.match(event.request).then((r)=>r || caches.match(url.pathname))));
  }
});

const CACHE = "wild-links-v1.3.0";
const FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./navigation.js",
  "./life.js",
  "./life-render.js",
  "./club.js",
  "./cloud.js",
  "./records.js",
  "./range.js",
  "./facilities.js",
  "./pwa.js",
  "./design.js",
  "./world.js",
  "./golf.js",
  "./simulation.js",
  "./render.js",
  "./persistence.js",
  "./icon.svg",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./manifest.webmanifest",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("wild-links-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== location.origin
  )
    return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() =>
        caches.match(e.request).then((r) => r || caches.match("./index.html")),
      ),
  );
});

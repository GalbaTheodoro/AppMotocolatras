// Service worker simples: deixa o sistema instalável e mostra uma página amigável sem internet.
// Não guarda dados do sistema em cache (tudo continua vindo do servidor).
const CACHE = "motocolatras-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/logo.png", "/icons/icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }
  const url = new URL(req.url);
  if (url.pathname === "/logo.png" || url.pathname.startsWith("/icons/")) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req)));
  }
});

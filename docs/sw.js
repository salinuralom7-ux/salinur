/* Nearse service worker — app shell caching.
   Deliberately conservative: only this app's own static files are cached.
   Supabase API calls and the separate /cars/ site always go to the network. */
const CACHE = "nearse-shell-v4";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/maskable-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;                       // never touch writes
  const url = new URL(req.url);

  if (url.origin !== location.origin) {
    if (url.hostname.endsWith("gstatic.com") || url.hostname.endsWith("googleapis.com")) {
      e.respondWith(
        caches.open(CACHE).then(async c => {
          const hit = await c.match(req);
          if (hit) return hit;
          const res = await fetch(req);
          if (res.ok) c.put(req, res.clone());
          return res;
        })
      );
    }
    return;                                               // Supabase and everything else: live network
  }

  if (url.pathname.includes("/cars")) return;             // Budget Cars is a separate site

  if (req.mode === "navigate") {                          // fresh page, cached fallback offline
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy));
          return res;
        })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
      return res;
    }))
  );
});

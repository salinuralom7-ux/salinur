/* Repto service worker — app shell caching.
   Deliberately conservative: only this app's own static files are cached.
   Supabase API calls always go to the network. */
const CACHE = "repto-shell-v47";
const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png?v=2",
  "./icons/icon-512.png?v=2",
  "./icons/maskable-512.png?v=2",
  "./icons/logo.png?v=2",
  "./fonts/plus-jakarta-sans-latin.woff2",
  "./icons/wordmark.png?v=3"
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

/* ---------- job alerts ----------
   A worker has 60 seconds to accept an instant job, so the notification has
   to be loud and land straight on the job when tapped. requireInteraction
   keeps it on screen rather than fading after a few seconds, and the tag
   means a second offer replaces the first instead of stacking up. */
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  const title = d.title || "New job on Repto";
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || "A customer near you needs work done now.",
    icon: "./icons/icon-192.png?v=2",
    badge: "./icons/icon-192.png?v=2",
    tag: d.tag || "nearse-job",
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 80, 200],
    data: { url: d.url || "./?src=push#job" }
  }));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || "./?src=push#job";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      // reuse a tab that already has Repto open rather than piling up windows
      for (const c of list) {
        if (c.url.includes(self.registration.scope) && "focus" in c) {
          c.navigate(target).catch(() => {});
          return c.focus();
        }
      }
      return self.clients.openWindow(target);
    })
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


  if (req.mode === "navigate") {
    // Only the app itself is the shell. The standalone pages (about, privacy,
    // terms, cancellations, account deletion) are cached under their own URL —
    // caching one as "./index.html" would serve a policy page when somebody
    // opens the app offline. Matching the root exactly means a page added
    // later is handled correctly without anyone remembering to list it.
    const isApp = url.pathname === "/" || url.pathname === "/index.html";
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(isApp ? "./index.html" : req, copy));
          return res;
        })
        .catch(() => caches.match(req)
          .then(r => r || (isApp ? caches.match("./index.html").then(x => x || caches.match("./")) : undefined)))
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

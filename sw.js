/* Flutter Batter service worker — offline shell + smart caching.
   v1: network-first for pages/API (freshness), cache-first for
   immutable assets (images, css, js with version query). */
const VERSION = "fb-v3";
const SHELL = ["./", "menu.html", "css/site.css", "js/config.js", "js/data.js", "js/app.js", "manifest.json", "icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // immutable assets: cache-first
  if (/\/assets\/|\/icons\/|\.woff2?$|\.(jpe?g|png|webp|mp4)$/i.test(url.pathname)) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit ||
        fetch(e.request).then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
          return res;
        }))
    );
    return;
  }
  // everything else: network-first with offline fallback to cache
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit || caches.match("/")))
  );
});

/* push notifications (OneSignal replaces this handler when it loads) */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window" }).then((list) => {
    for (const c of list) if ("focus" in c) return c.focus();
    return clients.openWindow("/");
  }));
});

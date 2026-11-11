// Roamio service worker: shows push notifications and opens the app when one is clicked,
// and keeps the app shell so the site still opens with no connection (read only).
// API calls are cross-origin and never touched here; see api/client.js for the data cache.

const CACHE = "roamio-shell-v1"; // bump to drop old shells

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // network first so a new deploy shows up; the cached shell only when offline
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
  } else if (url.pathname.startsWith("/assets/")) {
    // hashed filenames never change, so cache first is safe
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return response;
          })
      )
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Roamio", {
      body: data.body || "",
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: data.tag,
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // same-site paths only
  const raw = event.notification.data?.url || "/";
  const path = /^\/(?!\/)/.test(raw) ? raw : "/";
  const target = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows[0];
      if (open) return open.navigate(target).then((client) => (client || open).focus());
      return self.clients.openWindow(target);
    })
  );
});

// The browser rotated the subscription: tell the page, which holds the login and re-subscribes.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => windows.forEach((w) => w.postMessage({ type: "push-subscription-changed" })))
  );
});

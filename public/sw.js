/* MetU PWA service worker
 * - Navigations / HTML / RSC: network-only (avoid stale logged-in UI)
 * - Hashed static assets: cache-first
 * - POST /share-target: stash in share-inbox-v1 (client reads; no server image storage)
 */
const CACHE_VERSION = "metu-static-v2";
const STATIC_CACHE = CACHE_VERSION;
const SHARE_INBOX = "share-inbox-v1";
const SHARE_MAX_FILE_BYTES = 5 * 1024 * 1024;
const SHARE_TTL_MS = 10 * 60 * 1000;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(["/offline.html", "/favicon.ico", "/icon.png"]).catch(() => undefined)
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("metu-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:js|css|png|jpg|jpeg|gif|webp|ico|svg|woff2?)$/i.test(url.pathname)
  );
}

function shouldBypass(url) {
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/_next/data/") ||
    url.search.includes("_rsc")
  );
}

function combineShareFields(title, text, url) {
  return [title, text, url]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);
}

function firstValidShareImage(formData) {
  for (const [, value] of formData.entries()) {
    if (!(value instanceof File) || value.size <= 0) continue;
    const type = (value.type || "").toLowerCase();
    if (!type.startsWith("image/")) continue;
    if (value.size > SHARE_MAX_FILE_BYTES) return null;
    return value;
  }
  return null;
}

async function purgeExpiredShareEntries(cache) {
  const keys = await cache.keys();
  const now = Date.now();
  await Promise.all(
    keys.map(async (req) => {
      try {
        const path = new URL(req.url).pathname;
        if (!path.includes("/__share/") || !path.endsWith("/meta.json")) return;
        const res = await cache.match(req);
        if (!res) {
          await cache.delete(req);
          return;
        }
        const meta = await res.json();
        if (now - (meta.createdAt || 0) > SHARE_TTL_MS) {
          const id = meta.id;
          if (id) {
            await cache.delete(`/__share/${id}/meta.json`);
            await cache.delete(`/__share/${id}/file-0`);
          }
        }
      } catch {
        await cache.delete(req);
      }
    })
  );
}

async function handleShareTargetPost(request) {
  const id = crypto.randomUUID();
  let title = "";
  let text = "";
  let url = "";
  let file = null;

  try {
    const formData = await request.formData();
    title = String(formData.get("title") ?? "").slice(0, 2000);
    text = String(formData.get("text") ?? "").slice(0, 2000);
    url = String(formData.get("url") ?? "").slice(0, 2000);
    file = firstValidShareImage(formData);
  } catch {
    /* empty share */
  }

  const cache = await caches.open(SHARE_INBOX);
  await purgeExpiredShareEntries(cache);

  const createdAt = Date.now();
  const meta = {
    id,
    title,
    text,
    url,
    hasFile: Boolean(file),
    fileName: file ? file.name : undefined,
    fileType: file ? file.type : undefined,
    createdAt,
  };

  await cache.put(
    `/__share/${id}/meta.json`,
    new Response(JSON.stringify(meta), {
      headers: { "Content-Type": "application/json" },
    })
  );

  if (file) {
    await cache.put(
      `/__share/${id}/file-0`,
      new Response(file, {
        headers: { "Content-Type": file.type || "application/octet-stream" },
      })
    );
  }

  const combined = combineShareFields(title, text, url);
  if (!file && !combined) {
    return Response.redirect("/share-target", 303);
  }

  return Response.redirect(`/share-target?id=${encodeURIComponent(id)}`, 303);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method === "POST") {
    let url;
    try {
      url = new URL(request.url);
    } catch {
      return;
    }
    if (
      url.origin === self.location.origin &&
      (url.pathname === "/share-target" || url.pathname === "/api/share-target")
    ) {
      event.respondWith(handleShareTargetPost(request));
      return;
    }
    return;
  }

  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  if (url.origin !== self.location.origin) return;
  if (shouldBypass(url)) return;

  // App shell navigations: always prefer network
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match("/offline.html");
          return cached || new Response("오프라인입니다.", { status: 503 });
        }
      })()
    );
    return;
  }

  if (!isStaticAsset(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        return cached || Response.error();
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function parsePushPayload(event) {
  const fallback = {
    title: "Met-U",
    body: "",
    url: "/",
    tag: "metu",
  };
  try {
    if (!event.data) return fallback;
    const parsed = event.data.json();
    return {
      title: String(parsed.title || fallback.title).slice(0, 120),
      body: String(parsed.body || "").slice(0, 240),
      url: String(parsed.url || fallback.url).slice(0, 512),
      tag: String(parsed.tag || parsed.url || fallback.tag).slice(0, 64),
    };
  } catch {
    return fallback;
  }
}

self.addEventListener("push", (event) => {
  const data = parsePushPayload(event);
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icon.png",
      badge: "/icon.png",
      data: { url: data.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  const absolute = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const windowClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windowClients) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(absolute);
          }
          return;
        }
      }
      if (clients.openWindow) {
        await clients.openWindow(absolute);
      }
    })()
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (!sub) return;
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(sub.toJSON()),
        });
      } catch {
        /* best effort */
      }
    })()
  );
});

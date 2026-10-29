"use client";

export type PushSupport = {
  supported: boolean;
  reason?: "no-sw" | "no-push" | "no-notification" | "no-vapid";
};

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function getPushSupport(): PushSupport {
  if (typeof window === "undefined") {
    return { supported: false, reason: "no-sw" };
  }
  if (!("serviceWorker" in navigator)) {
    return { supported: false, reason: "no-sw" };
  }
  if (!("PushManager" in window)) {
    return { supported: false, reason: "no-push" };
  }
  if (!("Notification" in window)) {
    return { supported: false, reason: "no-notification" };
  }
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (!vapid) {
    return { supported: false, reason: "no-vapid" };
  }
  return { supported: true };
}

async function registrationReady(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return existing;
  const build = process.env.NEXT_PUBLIC_BUILD_TAG?.slice(0, 8) ?? "dev";
  return navigator.serviceWorker.register(`/sw.js?v=${encodeURIComponent(build)}`, {
    scope: "/",
  });
}

export async function enablePush(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const support = getPushSupport();
  if (!support.supported) {
    return { ok: false, error: support.reason ?? "unsupported" };
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    return { ok: false, error: "permission-denied" };
  }

  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.trim();
  const registration = await registrationReady();
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    const keyBytes = urlBase64ToUint8Array(vapid);
    const applicationServerKey = new Uint8Array(keyBytes.byteLength);
    applicationServerKey.set(keyBytes);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
    credentials: "include",
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? `http-${res.status}` };
  }

  return { ok: true };
}

export async function disablePush(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!("serviceWorker" in navigator)) {
    return { ok: false, error: "no-sw" };
  }

  const registration = await navigator.serviceWorker.getRegistration("/");
  const subscription = registration
    ? await registration.pushManager.getSubscription()
    : null;

  const endpoint = subscription?.endpoint;

  if (subscription) {
    await subscription.unsubscribe().catch(() => undefined);
  }

  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(endpoint ? { endpoint } : {}),
    credentials: "include",
  }).catch(() => undefined);

  return { ok: true };
}

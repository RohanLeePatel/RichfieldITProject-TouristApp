import { apiFetch, authedFetch } from "../api/client";

// Browser push: register the service worker, subscribe with the server's VAPID
// key, and tell the server about it. Nothing here asks for permission by
// itself; enablePush is called from the Settings toggle.

const SW_URL = "/sw.js";

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

// the key arrives as URL-safe base64; pushManager wants bytes
function keyToBytes(key) {
  const padded = (key + "=".repeat((4 - (key.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const registration = () => navigator.serviceWorker.register(SW_URL).then(() => navigator.serviceWorker.ready);

const post = (path, method, body) =>
  authedFetch(`/api/notifications/push/${path}`, { method, body: body ? JSON.stringify(body) : undefined });

// Asks permission (when still undecided), subscribes this browser and saves it.
// Returns the resulting permission; "granted" means it is subscribed.
export async function enablePush() {
  if (!pushSupported()) return "unsupported";
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") return permission;

  const [{ publicKey }, reg] = await Promise.all([authedFetch("/api/notifications/push/public-key"), registration()]);
  const subscription =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) }));
  await post("subscribe", "POST", subscription.toJSON());
  return "granted";
}

// Removes this browser's subscription from the server and the browser. Logout
// passes the access token it is about to discard, so the request still carries it.
export async function disablePush(token) {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration(SW_URL);
  const subscription = await reg?.pushManager.getSubscription();
  if (!subscription) return;
  const body = JSON.stringify({ endpoint: subscription.endpoint });
  await (token
    ? apiFetch("/api/notifications/push/subscribe", { method: "DELETE", body, headers: { Authorization: `Bearer ${token}` } })
    : post("subscribe", "DELETE", { endpoint: subscription.endpoint })
  ).catch(() => {});
  await subscription.unsubscribe();
}

export async function showTestNotification() {
  if (Notification.permission !== "granted") {
    throw new Error("Allow notifications in your browser settings to send a test.");
  }

  const existing = await navigator.serviceWorker.getRegistration(SW_URL);
  const reg = existing?.active ? existing : await registration();
  await reg.showNotification("Roamio", {
    body: "This is a test of Roamio browser notifications.",
    icon: "/favicon.svg",
    badge: "/favicon.svg",
    tag: "roamio-test",
    renotify: true,
    data: { url: "/settings" },
  });
}

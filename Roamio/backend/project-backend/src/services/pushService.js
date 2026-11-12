const webpush = require('web-push');
const prisma = require('../config/prisma');

const MAX_FAILURES = 5; // consecutive failed sends before a subscription is dropped
const GONE = [404, 410]; // the browser has unsubscribed: the endpoint is dead for good

// VAPID keys come from the environment (npx web-push generate-vapid-keys).
// Without them push is off and notifications still reach the inbox.
let configured = null;
function isConfigured() {
  if (configured === null) {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
    configured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);
    if (configured) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  }
  return configured;
}

// Browser push needs the channel on (set when the user subscribes) and the
// topic not switched off. Topics are on unless the user muted them.
async function wantsPush(userId, topic) {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });
  const prefs = row?.prefs || {};
  return prefs.channels?.browser === true && prefs.topics?.[topic]?.browser !== false;
}

// Only same-site paths: the click handler opens this, so it must not leave the app
const safePath = (url) => (typeof url === 'string' && /^\/(?!\/)/.test(url) ? url : '/');

async function sendOne(subscription, payload, options) {
  try {
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      payload,
      options
    );
  } catch (err) {
    if (GONE.includes(err.statusCode) || subscription.failureCount + 1 >= MAX_FAILURES) {
      await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
    } else {
      await prisma.pushSubscription.update({
        where: { id: subscription.id },
        data: { failureCount: { increment: 1 } },
      });
    }
    return false;
  }
  await prisma.pushSubscription.update({
    where: { id: subscription.id },
    data: { lastUsedAt: new Date(), failureCount: 0 },
  });
  return true;
}

async function sendToSubscriptions(subscriptions, payload) {
  const results = await Promise.all(subscriptions.map((subscription) => sendOne(subscription, payload)));
  return results.filter(Boolean).length;
}

// Writes the inbox notification, then pushes it to the user's browsers when
// they have opted in. A repeat of the same dedupeKey is dropped, so a cron that
// runs again never notifies twice. Never throws: a notification failing must not
// break the request or job that raised it.
async function notifyUser(userId, { type = 'INFO', topic, title, body, url, tripId, dedupeKey }) {
  try {
    try {
      await prisma.notification.create({
        data: { userId, title, message: body, type, url: url ? safePath(url) : null, tripId: tripId ?? null, dedupeKey: dedupeKey ?? null },
      });
    } catch (err) {
      if (err.code === 'P2002') return { duplicate: true, pushed: 0 };
      throw err;
    }

    if (!isConfigured() || !(await wantsPush(userId, topic))) return { duplicate: false, pushed: 0 };

    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });
    const payload = JSON.stringify({ title, body, url: safePath(url), tag: dedupeKey || undefined });
    const pushed = await sendToSubscriptions(subscriptions, payload);
    return { duplicate: false, pushed };
  } catch (err) {
    console.error('Notification failed:', err.message);
    return { duplicate: false, pushed: 0, error: true };
  }
}

// Settings tests the current browser even if all topics are muted.
async function sendTestPush(userId, endpoint) {
  const subscription = await prisma.pushSubscription.findFirst({ where: { userId, endpoint } });
  if (!subscription) return null;
  const payload = JSON.stringify({ title: 'Roamio', body: 'This is a test of Roamio browser notifications.', url: '/settings', tag: 'roamio-test' });
  return sendOne(subscription, payload, { urgency: 'high', TTL: 30, timeout: 5000 });
}

module.exports = { notifyUser, sendTestPush, isConfigured, safePath, MAX_FAILURES };

const express = require('express');
const { z } = require('zod');
const prisma = require('../config/prisma');
const requireAuth = require('../middleware/authMiddleware');
const validate = require('../middleware/validate');
const { pushLimiter } = require('../middleware/rateLimiter');
const pushService = require('../services/pushService');

// Browser push subscriptions, mounted at /api/notifications/push. A
// subscription's endpoint is a bearer capability to message that browser, so
// it is never sent back or logged.
const router = express.Router();
router.use(requireAuth);

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048).refine((url) => url.startsWith('https://'), 'Endpoint must be https.'),
  keys: z.object({ p256dh: z.string().min(1).max(256), auth: z.string().min(1).max(256) }),
});
const endpointSchema = z.object({ endpoint: z.string().url().max(2048) });

// The public VAPID key the browser subscribes with
router.get('/public-key', (req, res) => {
  if (!pushService.isConfigured()) return res.status(503).json({ message: 'Browser notifications are not set up yet.' });
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Saves this browser for the signed-in user. A browser shared by two people
// moves to whoever subscribed last, so the first never receives the second's alerts.
router.post('/subscribe', pushLimiter, validate(subscriptionSchema), async (req, res, next) => {
  try {
    const { endpoint, keys } = req.body;
    const data = {
      userId: req.user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: String(req.get('user-agent') || '').slice(0, 300),
      lastUsedAt: new Date(),
      failureCount: 0,
    };
    await prisma.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...data }, update: data });
    res.status(201).json({ subscribed: true });
  } catch (error) {
    next(error);
  }
});

// Removes this browser. Only the owner's row matches, so nobody can unsubscribe another user.
router.delete('/subscribe', pushLimiter, validate(endpointSchema), async (req, res, next) => {
  try {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: req.body.endpoint, userId: req.user.id } });
    res.json({ subscribed: false });
  } catch (error) {
    next(error);
  }
});

router.post('/test', pushLimiter, async (req, res, next) => {
  try {
    if (!pushService.isConfigured()) return res.status(503).json({ message: 'Browser notifications are not set up yet.' });
    const sent = await pushService.sendTestPush(req.user.id);
    if (!sent) return res.status(404).json({ message: 'This browser is not subscribed yet.' });
    res.json({ sent });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

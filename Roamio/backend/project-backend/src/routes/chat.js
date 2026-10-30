const express = require('express');
const prisma = require('../config/prisma');
const requireAuth = require('../middleware/authMiddleware');
const safetyService = require('../services/safetyService');
const { accessibleTrips } = require('../utils/tripFormat');
const { buildContext } = require('../services/chatContext');

const router = express.Router();
router.use(requireAuth);

const aiFeaturesUrl = (
  process.env.AI_FEATURES_URL ||
  'https://richfield-it-project-tourist-app.vercel.app'
).replace(/\/$/, '');

const HISTORY_MESSAGES = 10; // sent to the model with each question
const MAX_MESSAGE = 2000;

const parseId = (value) => (/^\d+$/.test(String(value)) ? Number(value) : null);

// The trip's facts for this traveller; undefined when they cannot see the trip
// (a 404, same as everywhere else).
async function tripContext(userId, tripId) {
  const trip = await prisma.trip.findFirst({
    where: accessibleTrips(userId, { id: tripId }),
    include: {
      itineraries: { orderBy: [{ dayNumber: 'asc' }, { startTime: 'asc' }] },
      destinations: { include: { destination: { include: { city: { include: { country: true } } } } } },
    },
  });
  if (!trip) return undefined;
  const country = trip.destinations[0]?.destination.city.country;
  const safety = country
    ? await safetyService.getCountrySafety(country.code, country.name).catch(() => null)
    : null;
  return buildContext(trip, safety);
}

// POST /api/chat { message, conversationId?, tripId? } -> { conversationId, reply }
router.post('/', async (req, res) => {
  const nodeSecretKey = process.env.superSecretKey;
  if (!nodeSecretKey) return res.status(500).json({ message: 'Assistant authentication is not configured.' });

  const userId = req.user.userId;
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  if (!message || message.length > MAX_MESSAGE) {
    return res.status(400).json({ message: `Write a message of 1 to ${MAX_MESSAGE} characters.` });
  }

  try {
    let conversation = null;
    if (req.body.conversationId != null) {
      const id = parseId(req.body.conversationId);
      conversation = id && await prisma.chatConversation.findFirst({ where: { id, userId } });
      if (!conversation) return res.status(404).json({ message: 'Conversation not found.' });
    }

    // a continuing chat keeps the trip it started with
    const tripId = conversation ? conversation.tripId : parseId(req.body.tripId);
    let context = '';
    if (tripId) {
      context = await tripContext(userId, tripId);
      if (context === undefined) return res.status(404).json({ message: 'Trip not found.' });
    }

    const history = conversation
      ? (await prisma.chatMessage.findMany({
          where: { conversationId: conversation.id },
          orderBy: { id: 'desc' },
          take: HISTORY_MESSAGES,
        })).reverse().map(({ role, content }) => ({ role, content }))
      : [];

    const response = await fetch(`${aiFeaturesUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'node-secretkey': nodeSecretKey },
      body: JSON.stringify({ messages: [...history, { role: 'user', content: message }], context }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.reply) {
      return res.status(response.status === 429 ? 429 : 502).json({
        message: (typeof data?.detail === 'string' && data.detail) || 'The assistant is unavailable right now.',
      });
    }

    // saved only once there is an answer, so a failed ask leaves no half chat
    if (!conversation) {
      conversation = await prisma.chatConversation.create({
        data: { userId, tripId: tripId || null, title: message.slice(0, 60) },
      });
    }
    await prisma.chatMessage.createMany({
      data: [
        { conversationId: conversation.id, role: 'user', content: message },
        { conversationId: conversation.id, role: 'assistant', content: data.reply },
      ],
    });
    await prisma.chatConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

    return res.json({ conversationId: conversation.id, reply: data.reply });
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(502).json({ message: 'The assistant is unavailable right now.' });
  }
});

// GET /api/chat/conversations - newest first, optionally only one trip's
router.get('/conversations', async (req, res) => {
  try {
    const tripId = parseId(req.query.tripId);
    const conversations = await prisma.chatConversation.findMany({
      where: { userId: req.user.userId, ...(tripId ? { tripId } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: { id: true, title: true, tripId: true, updatedAt: true },
    });
    res.json({ conversations });
  } catch (error) {
    console.error('Chat list error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

router.get('/conversations/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const conversation = id && await prisma.chatConversation.findFirst({
      where: { id, userId: req.user.userId },
      include: { messages: { orderBy: { id: 'asc' }, select: { id: true, role: true, content: true, createdAt: true } } },
    });
    if (!conversation) return res.status(404).json({ message: 'Conversation not found.' });
    res.json({ conversation });
  } catch (error) {
    console.error('Chat read error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

router.delete('/conversations/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const { count } = id ? await prisma.chatConversation.deleteMany({ where: { id, userId: req.user.userId } }) : { count: 0 };
    if (!count) return res.status(404).json({ message: 'Conversation not found.' });
    res.status(204).end();
  } catch (error) {
    console.error('Chat delete error:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
});

module.exports = router;

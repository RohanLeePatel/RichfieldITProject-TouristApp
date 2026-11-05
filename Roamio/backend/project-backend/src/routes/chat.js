const express = require('express');
const prisma = require('../config/prisma');
const requireAuth = require('../middleware/authMiddleware');
const safetyService = require('../services/safetyService');
const { accessibleTrips } = require('../utils/tripFormat');
const { buildContext } = require('../services/chatContext');
const { addItineraryItem, logExpense } = require('../services/chatActions');
const { aiApiUrl } = require('../utils/aiService');

const router = express.Router();
router.use(requireAuth);

const aiFeaturesUrl = aiApiUrl();

const HISTORY_MESSAGES = 10; // sent to the model with each question
const MAX_MESSAGE = 2000;
const MAX_CONVERSATION_QUESTIONS = 100; // a chat this long should start over
const MAX_ADVISORY_COUNTRIES = 3;
const WEATHER_TIMEOUT_MS = 8000;
// Per traveller, counted in the database so it holds across serverless
// instances (the per-IP chatLimiter in server.js cannot see the traveller).
// The daily cap protects the free Gemini quota shared by every traveller.
const PER_MINUTE = 8;
const PER_DAY = Number(process.env.CHAT_DAILY_LIMIT) || 60;

const parseId = (value) => (/^\d+$/.test(String(value)) ? Number(value) : null);

// Chat answers hold a traveller's trip details: never cache them anywhere.
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

const questionsSince = (userId, since) =>
  prisma.chatMessage.count({ where: { role: 'user', createdAt: { gte: since }, conversation: { userId } } });

// Current weather and the short forecast for the trip's first city, through the
// same ai-features route as the Weather page; null when it cannot be had.
async function tripWeather(city) {
  if (!city || !process.env.superSecretKey) return null;
  try {
    const response = await fetch(`${aiFeaturesUrl}/weather/${encodeURIComponent(city)}`, {
      headers: { 'node-secretkey': process.env.superSecretKey },
      signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

// Is this named place within reach of the trip? ai-features answers { found, ... };
// null when it could not be asked (the stop is then added without a location).
async function searchPlace({ text, near, lat, lon }) {
  if (!process.env.superSecretKey) return null;
  const params = new URLSearchParams({ text, near });
  if (lat != null && lon != null) {
    params.set('lat', lat);
    params.set('lon', lon);
  }
  try {
    const response = await fetch(`${aiFeaturesUrl}/places/search?${params}`, {
      headers: { 'node-secretkey': process.env.superSecretKey },
      signal: AbortSignal.timeout(WEATHER_TIMEOUT_MS),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

// The trip's facts for this traveller; undefined when they cannot see the trip
// (a 404, same as everywhere else). Only these relations are loaded, and
// documents are loaded without their bytes. -> { context, trip, canEdit, near }
async function tripContext(userId, tripId) {
  const trip = await prisma.trip.findFirst({
    where: accessibleTrips(userId, { id: tripId }),
    include: {
      itineraries: { orderBy: [{ dayNumber: 'asc' }, { startTime: 'asc' }] },
      destinations: { orderBy: { orderIndex: 'asc' }, include: { destination: { include: { city: { include: { country: true } } } } } },
      members: { select: { userId: true, role: true } },
      travelGroup: { select: { description: true } },
      budget: { include: { categoryLimits: true } },
      expenses: { select: { title: true, amount: true, currency: true, exchangeRate: true, category: true, paidById: true, date: true } },
      safetyAlerts: { where: { resolvedAt: null }, select: { riskLevel: true, message: true } },
      documents: { select: { kind: true } },
    },
  });
  if (!trip) return undefined;

  const countries = new Map();
  for (const { destination } of trip.destinations) {
    const { code, name } = destination.city.country;
    countries.set(code, name);
  }
  const [advisories, weather] = await Promise.all([
    Promise.all(
      [...countries].slice(0, MAX_ADVISORY_COUNTRIES).map(async ([code, country]) => ({
        country,
        safety: await safetyService.getCountrySafety(code, country).catch(() => null),
      })),
    ),
    tripWeather(trip.destinations[0]?.destination.city.name),
  ]);
  const first = trip.destinations[0]?.destination.city;
  const mine = trip.members.find((m) => m.userId === userId);
  return {
    context: buildContext(trip, { advisories, weather, userId }),
    trip,
    // a group member with no TripMember row is checked again by the action itself
    canEdit: mine?.role !== 'VIEWER',
    near: first ? `${first.name}, ${first.country.name}` : null,
  };
}

// Runs (or, with dryRun, only checks) an action the assistant asked for.
// -> { reply, item?, expense?, proposal? }
async function runAction(name, args, { facts, userId, dryRun }) {
  if (name === 'add_itinerary_item') return addItineraryItem({ userId, trip: facts.trip, near: facts.near, args, searchPlace, dryRun });
  if (name === 'log_expense') return logExpense({ userId, trip: facts.trip, args, dryRun });
  return { reply: "I can't do that." };
}
const ACTIONS = ['add_itinerary_item', 'log_expense'];

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
    const now = Date.now();
    const [lastMinute, today] = await Promise.all([
      questionsSince(userId, new Date(now - 60 * 1000)),
      questionsSince(userId, new Date(new Date(now).setUTCHours(0, 0, 0, 0))),
    ]);
    if (lastMinute >= PER_MINUTE) {
      res.set('Retry-After', '60');
      return res.status(429).json({ message: 'You are sending messages too quickly. Wait a minute and try again.' });
    }
    if (today >= PER_DAY) {
      return res.status(429).json({ message: `You have reached today's limit of ${PER_DAY} questions. It resets at midnight UTC.` });
    }

    let conversation = null;
    if (req.body.conversationId != null) {
      const id = parseId(req.body.conversationId);
      conversation = id && await prisma.chatConversation.findFirst({ where: { id, userId } });
      if (!conversation) return res.status(404).json({ message: 'Conversation not found.' });
      const asked = await prisma.chatMessage.count({ where: { conversationId: conversation.id, role: 'user' } });
      if (asked >= MAX_CONVERSATION_QUESTIONS) {
        return res.status(400).json({ message: 'This chat is full. Start a new chat.' });
      }
    }

    // a continuing chat keeps the trip it started with
    const tripId = conversation ? conversation.tripId : parseId(req.body.tripId);
    let facts = null;
    if (tripId) {
      facts = await tripContext(userId, tripId);
      if (facts === undefined) return res.status(404).json({ message: 'Trip not found.' });
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
      body: JSON.stringify({
        messages: [...history, { role: 'user', content: message }],
        context: facts?.context || '',
        can_edit: Boolean(facts?.canEdit && facts.near),
      }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || (!data.reply && !data.action)) {
      return res.status(response.status === 429 ? 429 : 502).json({
        message: (typeof data?.detail === 'string' && data.detail) || 'The assistant is unavailable right now.',
      });
    }

    // The assistant asked to change the trip. Nothing is changed yet: the change is
    // checked here and offered back as a proposal the traveller must confirm, and the
    // words they read come from the app, never from the model.
    let reply = data.reply;
    let proposal = null;
    if (data.action) {
      if (ACTIONS.includes(data.action.name) && facts) {
        const checked = await runAction(data.action.name, data.action.args || {}, { facts, userId, dryRun: true });
        proposal = checked.proposal || null;
        reply = proposal ? `${proposal.summary}. Shall I go ahead?` : checked.reply;
      } else {
        reply = 'Choose a trip first (the Active trip in the sidebar), then ask again.';
      }
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
        { conversationId: conversation.id, role: 'assistant', content: reply },
      ],
    });
    await prisma.chatConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

    return res.json({ conversationId: conversation.id, reply, proposal, tripId: facts ? facts.trip.id : null });
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(502).json({ message: 'The assistant is unavailable right now.' });
  }
});

// POST /api/chat/confirm { conversationId, name, args } -> { reply, added, expense, tripId }
// The traveller said yes to a proposal. Everything is checked again, as if they had used the
// itinerary or budget screen themselves, and the result is written into the chat.
router.post('/confirm', async (req, res) => {
  const userId = req.user.userId;
  const { name, args } = req.body;
  const id = parseId(req.body.conversationId);
  if (!ACTIONS.includes(name) || !args || typeof args !== 'object' || Array.isArray(args)) {
    return res.status(400).json({ message: 'That action is not recognised.' });
  }
  try {
    const conversation = id && await prisma.chatConversation.findFirst({ where: { id, userId } });
    if (!conversation || !conversation.tripId) return res.status(404).json({ message: 'Conversation not found.' });
    const facts = await tripContext(userId, conversation.tripId);
    if (!facts) return res.status(404).json({ message: 'Trip not found.' });

    const done = await runAction(name, args, { facts, userId, dryRun: false });
    await prisma.chatMessage.create({ data: { conversationId: conversation.id, role: 'assistant', content: done.reply } });
    await prisma.chatConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
    return res.json({ reply: done.reply, added: done.item || null, expense: done.expense || null, tripId: facts.trip.id });
  } catch (error) {
    console.error('Chat confirm error:', error);
    return res.status(502).json({ message: 'I could not do that right now. Try again.' });
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

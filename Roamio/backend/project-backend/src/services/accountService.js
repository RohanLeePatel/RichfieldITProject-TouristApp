const prisma = require('../config/prisma');
const { comparePassword } = require('../auth/tokenService');
const { unpackGroupMeta } = require('../utils/groupMeta');
const { toTraveller } = require('./travellerService');
const sessionService = require('./sessionService');
const { httpError } = require('./tripAccessService');

// "Download my data" and "Delete my account" (POPIA: access and erasure).

const aiFeaturesUrl = () =>
  (process.env.AI_FEATURES_URL || 'https://richfield-it-project-tourist-app.vercel.app').replace(/\/$/, '');
const AI_TIMEOUT_MS = 15000;
const HISTORY_PAGE = 100;
const HISTORY_PAGES = 5; // up to 500 translations in the file

// A call to ai-features on this traveller's behalf (it trusts x-user-id because
// this API sends it, with the shared key). null when there is no key to send.
function expert(path, userId, init = {}) {
  const key = process.env.superSecretKey;
  if (!key) return null;
  return fetch(`${aiFeaturesUrl()}${path}`, {
    ...init,
    headers: { 'node-secretkey': key, 'x-user-id': String(userId) },
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
  });
}

// Translation history lives in the translation service's own table. Text only,
// with the links to the photographs; null if it can't be reached right now.
async function translationHistory(userId) {
  try {
    const items = [];
    for (let page = 0; page < HISTORY_PAGES; page += 1) {
      const response = await expert(`/api/translate/history?limit=${HISTORY_PAGE}&offset=${page * HISTORY_PAGE}`, userId);
      if (!response?.ok) return null;
      const data = await response.json();
      items.push(...(data.items || []));
      if (items.length >= data.total) break;
    }
    return items.map(({ id, translation_type, source_text, translated_text, source_lang, detected_lang, target_lang, image_url, created_at }) => ({
      id, type: translation_type, sourceText: source_text, translatedText: translated_text,
      sourceLanguage: source_lang, detectedLanguage: detected_lang, targetLanguage: target_lang, imageUrl: image_url, at: created_at,
    }));
  } catch {
    return null;
  }
}

// Everything held about the traveller, as one JSON document (never stored: built on request).
// Left out on purpose: the password hash, one-time codes and the stored bytes of uploaded documents.
async function exportData(userId) {
  const [user, notificationPreferences, travellers, memberships, notifications, chats, activity, uploads] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, avatarUrl: true, createdAt: true, termsAcceptedAt: true, termsVersion: true, preferences: true },
    }),
    prisma.notificationPreference.findUnique({ where: { userId } }),
    prisma.savedTraveller.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
    prisma.travelGroupMember.findMany({
      where: { userId },
      include: {
        travelGroup: {
          include: {
            members: { select: { role: true, joinedAt: true, user: { select: { fullName: true } } } },
            trips: {
              where: { deletedAt: null },
              include: {
                itineraries: true,
                budget: { include: { categoryLimits: true } },
                expenses: { include: { splits: true } },
              },
            },
          },
        },
      },
    }),
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    prisma.chatConversation.findMany({ where: { userId }, include: { messages: { orderBy: { id: 'asc' } } }, orderBy: { createdAt: 'asc' } }),
    sessionService.activity(userId),
    prisma.tripDocument.findMany({ where: { uploadedById: userId }, select: { id: true, tripId: true, filename: true, mimeType: true, sizeBytes: true, kind: true, createdAt: true } }),
  ]);
  if (!user) throw httpError(404, 'Account not found.');

  return {
    exportedAt: new Date().toISOString(),
    format: 'Roamio personal data export (v2)',
    profile: user,
    notificationPreferences: notificationPreferences?.prefs ?? null,
    savedTravellers: travellers.map(toTraveller),
    groups: memberships.map(({ role, joinedAt, travelGroup }) => {
      const { description, companions } = unpackGroupMeta(travelGroup.description);
      return {
        id: travelGroup.id,
        name: travelGroup.name,
        description,
        yourRole: role,
        joinedAt,
        members: travelGroup.members.map((member) => ({ name: member.user.fullName, role: member.role, joinedAt: member.joinedAt })),
        companions,
        trips: travelGroup.trips,
      };
    }),
    documentsYouUploaded: uploads,
    notifications,
    assistantChats: chats,
    translationHistory: await translationHistory(userId),
    signInHistory: activity,
  };
}

// P-17. Needs the password as well as the typed word, so a stolen session can't erase the account.
async function deleteAccount(userId, { confirmation, password } = {}) {
  if (confirmation !== 'DELETE') throw httpError(400, 'Type DELETE to confirm.');
  if (typeof password !== 'string' || !password) throw httpError(400, 'Enter your password to confirm.');

  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true, passwordHash: true } });
  if (!user) throw httpError(404, 'Account not found.');
  if (!(await comparePassword(password, user.passwordHash))) throw httpError(401, 'Password is incorrect.');

  // First, and fatal: if the translation history (and its photographs) can't be
  // erased now, nothing is deleted and the traveller can simply try again.
  let erased;
  try {
    erased = await expert('/api/translate/history', userId, { method: 'DELETE' });
  } catch {
    erased = { ok: false };
  }
  if (erased && !erased.ok && erased.status !== 404) {
    throw httpError(502, "We couldn't erase your translation history just now, so nothing was deleted. Please try again in a minute.");
  }

  await prisma.$transaction(async (tx) => {
    const memberships = await tx.travelGroupMember.findMany({ where: { userId }, select: { travelGroupId: true, role: true } });
    for (const { travelGroupId, role } of memberships) {
      const others = await tx.travelGroupMember.findMany({
        where: { travelGroupId, userId: { not: userId } },
        orderBy: { joinedAt: 'asc' },
        select: { id: true, role: true },
      });
      if (others.length === 0) {
        await tx.travelGroup.delete({ where: { id: travelGroupId } }); // trips, itinerary, expenses, documents go with it
      } else if (role === 'OWNER' && !others.some((member) => member.role === 'OWNER')) {
        await tx.travelGroupMember.update({ where: { id: others[0].id }, data: { role: 'OWNER' } });
      }
    }
    // the one relation that doesn't cascade: documents this person put on trips that stay
    await tx.tripDocument.deleteMany({ where: { uploadedById: userId } });
    await tx.user.delete({ where: { id: userId } }); // memberships, splits, notifications, sessions, travellers...
  });
}

module.exports = { exportData, deleteAccount };

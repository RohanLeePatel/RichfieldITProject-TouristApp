const prisma = require('../config/prisma');
const { notifyUser } = require('./pushService');

const CHANGE_WINDOW_MS = 30 * 60 * 1000; // a trip's members hear about edits at most once per window
const DAY_MS = 24 * 60 * 60 * 1000;

// Both functions are best effort and never throw: telling people about a change
// must not fail the invite or the edit that caused it.

// Someone with an account was invited by email: it reaches their inbox and
// browser, linking to the invite page. People without an account get nothing
// here (the invite isn't emailed yet). One per group per day, so re-sending
// invites can't be used to spam someone.
async function notifyInvite({ groupId, groupName, inviterName, email, token, now = Date.now() }) {
  try {
    const invitee = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    if (!invitee) return false;
    await notifyUser(invitee.id, {
      type: 'INVITE',
      topic: 'groupActivity',
      title: `${inviterName} invited you to "${groupName}"`,
      body: 'Open the invitation to see the trip group and join.',
      url: `/invite/${token}`,
      dedupeKey: `invite:${groupId}:${invitee.id}:${Math.floor(now / DAY_MS)}`,
    });
    return true;
  } catch (error) {
    console.error('Invite notification failed:', error.message);
    return false;
  }
}

// A member changed a trip: everyone else on it (trip members and the group's)
// is told. Bursts of edits make one notification per trip per 30 minutes.
// what: "changed the trip dates", "added a stop to the itinerary", ...
async function notifyTripChange({ tripId, actorId, what, now = Date.now() }) {
  try {
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, deletedAt: null },
      select: {
        title: true,
        members: { select: { userId: true } },
        travelGroup: { select: { members: { select: { userId: true } } } },
      },
    });
    if (!trip) return 0;

    const recipients = new Set([...trip.members, ...trip.travelGroup.members].map((m) => m.userId));
    recipients.delete(actorId);
    if (!recipients.size) return 0;

    const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { fullName: true } });
    const bucket = Math.floor(now / CHANGE_WINDOW_MS);
    await Promise.all([...recipients].map((userId) => notifyUser(userId, {
      type: 'TRIP_UPDATE',
      topic: 'groupActivity',
      title: `"${trip.title}" was updated`,
      body: `${actor?.fullName || 'Someone'} ${what}.`,
      url: `/trips/${tripId}`,
      tripId,
      dedupeKey: `tripchange:${tripId}:${bucket}`,
    })));
    return recipients.size;
  } catch (error) {
    console.error('Trip change notification failed:', error.message);
    return 0;
  }
}

module.exports = { notifyInvite, notifyTripChange };

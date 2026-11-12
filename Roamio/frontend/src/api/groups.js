import { apiFetch, authedFetch } from "./client";

// Shared travel groups only - every user also has a personal group (no invite
// code) that holds their solo trips, which isn't a group anyone else is in.
export async function fetchMyGroups({ fresh = false } = {}) {
  const data = await authedFetch("/api/groups/me", fresh ? { cache: "no-store" } : undefined);
  return (data.groups || []).filter((group) => group.inviteCode !== null);
}

export async function createGroup(name) {
  const data = await authedFetch("/api/groups", { method: "POST", body: JSON.stringify({ name }) });
  return data.group;
}

export function joinGroup(inviteCode) {
  return authedFetch("/api/groups/join", { method: "POST", body: JSON.stringify({ inviteCode }) });
}

// The token also lets the sender copy the invitation if email delivery fails.
export async function createInvite(groupId, email, tripId) {
  const data = await authedFetch(`/api/groups/${encodeURIComponent(groupId)}/invites`, {
    method: "POST",
    body: JSON.stringify({ email, role: "MEMBER", tripId }),
  });
  return { token: data.invitationToken, emailed: Boolean(data.emailed) };
}

// public: { groupName, inviterName, role, expiresAt }. Signed in, the token is
// sent too, so a link this account already accepted says so (error code
// ALREADY_ACCEPTED). Errors carry data.code: INVALID, EXPIRED, USED, ...
export function previewInvite(token, signedIn = false, tripId) {
  const query = tripId ? `?trip=${encodeURIComponent(tripId)}` : "";
  return apiFetch(`/api/invites/${encodeURIComponent(token)}${query}`, { auth: signedIn });
}

export function acceptInvite(token, tripId) {
  return authedFetch("/api/invites/accept", { method: "POST", body: JSON.stringify({ token, tripId }) });
}

export function emailInvitePath(token, tripId) {
  return `/invite/${encodeURIComponent(token)}${tripId ? `?trip=${encodeURIComponent(tripId)}` : ""}`;
}

// Replaces a group's companions - people on its trips without an account.
// [{ id, name, type: "Adult" | "Child", age, relationship, interests, color }]
export async function saveCompanions(groupId, companions) {
  const data = await authedFetch(`/api/groups/${encodeURIComponent(groupId)}/companions`, {
    method: "PUT",
    body: JSON.stringify({ companions }),
  });
  return data.companions;
}

// What a join link opens: { id, name, memberCount, alreadyMember }
export async function previewGroupCode(code) {
  const data = await authedFetch(`/api/groups/code/${encodeURIComponent(code)}`);
  return data.group;
}

// The link to send someone: joins the group, then opens the trip (if given)
export function inviteLink(inviteCode, tripId) {
  return `${window.location.origin}/join/${inviteCode}${tripId ? `?trip=${tripId}` : ""}`;
}

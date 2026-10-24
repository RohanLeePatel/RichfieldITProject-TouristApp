import { apiFetch, authedFetch } from "./client";

// Shared travel groups only - every user also has a personal group (no invite
// code) that holds their solo trips, which isn't a group anyone else is in.
export async function fetchMyGroups() {
  const data = await authedFetch("/api/groups/me");
  return (data.groups || []).filter((group) => group.inviteCode !== null);
}

export async function createGroup(name) {
  const data = await authedFetch("/api/groups", { method: "POST", body: JSON.stringify({ name }) });
  return data.group;
}

export function joinGroup(inviteCode) {
  return authedFetch("/api/groups/join", { method: "POST", body: JSON.stringify({ inviteCode }) });
}

// The invite isn't emailed yet - the server returns the token, and the page
// turns it into a link to send yourself.
export async function createInvite(groupId, email) {
  const data = await authedFetch(`/api/groups/${groupId}/invites`, {
    method: "POST",
    body: JSON.stringify({ email, role: "MEMBER" }),
  });
  return data.invitationToken;
}

// public: { groupName, inviterName, role, expiresAt }
export function previewInvite(token) {
  return apiFetch(`/api/invites/${encodeURIComponent(token)}`);
}

export function acceptInvite(token) {
  return authedFetch("/api/invites/accept", { method: "POST", body: JSON.stringify({ token }) });
}

// Replaces a group's companions - people on its trips without an account.
// [{ id, name, type: "Adult" | "Child", age, relationship, interests, color }]
export async function saveCompanions(groupId, companions) {
  const data = await authedFetch(`/api/groups/${groupId}/companions`, {
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

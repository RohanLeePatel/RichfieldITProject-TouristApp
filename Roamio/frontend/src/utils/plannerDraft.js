import { authedFetch } from "../api/client.js";

// The trip planner's unfinished plan. Kept in this browser (so a reload is
// instant, even offline) and on the server (so it follows the traveller to
// another device). One draft per user; dropped after a week, on logout (the
// browser copy only) and once the trip is saved.
const PREFIX = "roamio_planner_draft_v1:";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const REMOTE_PATH = "/api/users/me/planner-draft";
const SAVE_DELAY_MS = 1500;
const FETCH_TIMEOUT_MS = 2500;

// the signed-in user is stored under "user" (authStore)
function key() {
  try {
    return PREFIX + (JSON.parse(localStorage.getItem("user"))?.id ?? "anon");
  } catch {
    return PREFIX + "anon";
  }
}

// null when the draft is missing, too old or finished
function usable(draft) {
  if (!draft || typeof draft !== "object" || Date.now() - draft.savedAt > MAX_AGE_MS || draft.stage === "done") return null;
  // a stage whose data is missing would render empty: fall back to the wizard
  const needs = { results: draft.recommendationData, landmarks: draft.selectedCity, itinerary: draft.itineraryDays?.length };
  return draft.stage in needs && !needs[draft.stage] ? { ...draft, stage: "wizard" } : draft;
}

function loadLocal() {
  try {
    return usable(JSON.parse(localStorage.getItem(key())));
  } catch {
    return null;
  }
}

async function loadRemote() {
  const timeout = new Promise((resolve) => setTimeout(resolve, FETCH_TIMEOUT_MS, null));
  const fetched = authedFetch(REMOTE_PATH).then((result) => usable(result?.draft)).catch(() => null);
  return Promise.race([fetched, timeout]);
}

// The draft the planner starts from: the newer of this browser's and the
// server's. A template or dates in the URL mean a fresh start. Never throws.
export async function pickDraft() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("template") || params.has("start")) return {};
  const local = loadLocal();
  const remote = await loadRemote();
  return [local, remote].filter(Boolean).sort((a, b) => b.savedAt - a.savedAt)[0] || {};
}

let pending = null;
let timer = null;

function sendPending() {
  clearTimeout(timer);
  const draft = pending;
  pending = null;
  if (draft) authedFetch(REMOTE_PATH, { method: "PUT", body: JSON.stringify(draft) }).catch(() => {});
}

// Browser copy now, server copy once the traveller pauses
export function saveDraft(draft) {
  pending = { ...draft, savedAt: Date.now() };
  try {
    localStorage.setItem(key(), JSON.stringify(pending));
  } catch {
    // storage full or blocked: the server copy still keeps it
  }
  clearTimeout(timer);
  timer = setTimeout(sendPending, SAVE_DELAY_MS);
}

// Send the waiting save now, e.g. when the tab is hidden or closing
export const flushDraft = sendPending;

export function clearDraft() {
  clearTimeout(timer);
  pending = null;
  try {
    localStorage.removeItem(key());
  } catch {
    // nothing to clear
  }
  authedFetch(REMOTE_PATH, { method: "DELETE" }).catch(() => {});
}

// Every user's browser copy, for logout on a shared device. The server copy
// stays: it is what lets them carry on elsewhere.
export function clearAllDrafts() {
  clearTimeout(timer);
  pending = null;
  try {
    Object.keys(localStorage)
      .filter((name) => name.startsWith(PREFIX))
      .forEach((name) => localStorage.removeItem(name));
  } catch {
    // nothing to clear
  }
}

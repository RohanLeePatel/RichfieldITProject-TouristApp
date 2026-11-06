// Translates a short piece of text through the Core API's translator route
// (the same one the Translator page uses). No sign-in needed.
import { apiFetch, ensureToken } from "./client";

const API_BASE = String(import.meta.env?.VITE_BACKEND_API_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

// Resolves to { text, from } - `from` is the language the source was detected as.
export async function translateText(text, targetLang) {
  let response;
  try {
    response = await fetch(`${API_BASE}/api/translate/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target_lang: targetLang }),
    });
  } catch {
    throw new Error("Could not reach the translator. Check your connection and try again.");
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.translation) {
    throw new Error(data?.detail?.[0]?.msg || data?.detail || data?.message || "Could not translate that.");
  }
  return { text: data.translation, from: data.detected_lang || "" };
}

// Headers that tie a translate request to the signed-in traveller, so the server
// saves it to their history. Guests get none and are translated but not saved.
// Uses ensureToken (not authedFetch) because a guest must not be sent to /login.
export async function translateAuthHeaders() {
  const token = await ensureToken().catch(() => null);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// The signed-in traveller's saved translations, newest first. Resolves to []
// for guests and when history can't be loaded; it never blocks translating.
export async function fetchTranslationHistory(limit = 20) {
  const headers = await translateAuthHeaders();
  if (!headers.Authorization) return [];
  try {
    const data = await apiFetch(`/api/translate/history?limit=${limit}`, { headers });
    return Array.isArray(data?.items) ? data.items : [];
  } catch {
    return [];
  }
}

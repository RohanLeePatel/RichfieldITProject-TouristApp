// Translates a short piece of text through the Core API's translator route
// (the same one the Translator page uses). No sign-in needed.
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

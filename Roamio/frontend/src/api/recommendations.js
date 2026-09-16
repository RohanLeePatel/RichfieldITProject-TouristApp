// /recommendations and /recommendations/catalog go through the Node backend's
// proxy (routes/recommendations.js), which injects the node-secretkey server
// side - see server.js `app.use('/api/recommendations', ...)`. /landmarks has
// no such proxy yet, so it's called directly against the FastAPI service,
// same pattern as api/weather.js and Translator.jsx's OCR call.
const NODE_API_BASE_URL =
  import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:3000";
const AI_API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
const API_SECRET_KEY =
  import.meta.env.VITE_TRANSLATION_SECRET_KEY || "";

const SESSION_ID_KEY = "roamio_recommendation_session_id";

function getSessionId() {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  return sessionId;
}

async function readJsonResponse(response, invalidMessage, fallbackMessage) {
  let data = null;

  try {
    data = await response.json();
  } catch {
    throw new Error(invalidMessage);
  }

  if (!response.ok) {
    throw new Error(data?.message || data?.detail || fallbackMessage);
  }

  return data;
}

export async function fetchRecommendations(preferences, level, parentId) {
  const request = {
    request_id: crypto.randomUUID(),
    session_id: getSessionId(),
    level,
    preferences,
  };

  if (level === "city" && parentId) {
    request.parent_id = parentId;
  }

  const response = await fetch(
    `${NODE_API_BASE_URL.replace(/\/$/, "")}/api/recommendations`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }
  );

  const data = await readJsonResponse(
    response,
    "The recommendation service returned an invalid response.",
    "Recommendations are currently unavailable."
  );

  if (!data || !Array.isArray(data.results)) {
    throw new Error("No valid recommendations were returned.");
  }

  return data;
}

export async function fetchRecommendationCatalog() {
  const response = await fetch(
    `${NODE_API_BASE_URL.replace(/\/$/, "")}/api/recommendations/catalog`
  );
  const data = await response.json().catch(() => null);

  if (!response.ok || !data || !Array.isArray(data.countries)) {
    throw new Error("The recommendation catalog is currently unavailable.");
  }

  return data.countries;
}

export async function fetchLandmarks(destination, interests, radiusM = 5000) {
  const params = new URLSearchParams({
    destination,
    interests: interests.join(","),
    radius_m: radiusM,
  });

  const headers = {};
  if (API_SECRET_KEY.trim()) {
    headers["node-secretkey"] = API_SECRET_KEY.trim();
  }

  const response = await fetch(
    `${AI_API_BASE_URL.replace(/\/$/, "")}/landmarks?${params.toString()}`,
    { headers }
  );

  const data = await readJsonResponse(
    response,
    "The landmarks service returned an invalid response.",
    "Landmarks are currently unavailable for that destination."
  );

  if (!data || !Array.isArray(data.groups)) {
    throw new Error("No landmarks were returned for that destination.");
  }

  return data;
}

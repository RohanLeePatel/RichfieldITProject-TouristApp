const API_BASE_URL =
  import.meta.env.VITE_BACKEND_API_URL || "http://127.0.0.1:3000";

const SESSION_ID_KEY = "roamio_recommendation_session_id";

function getSessionId() {
  let sessionId = sessionStorage.getItem(SESSION_ID_KEY);

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem(SESSION_ID_KEY, sessionId);
  }

  return sessionId;
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
    `${API_BASE_URL.replace(/\/$/, "")}/api/recommendations`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );

  let data = null;

  try {
    data = await response.json();
  } catch {
    throw new Error("The recommendation service returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.detail ||
        "Recommendations are currently unavailable."
    );
  }

  if (!data || !Array.isArray(data.results)) {
    throw new Error("No valid recommendations were returned.");
  }

  return data;
}

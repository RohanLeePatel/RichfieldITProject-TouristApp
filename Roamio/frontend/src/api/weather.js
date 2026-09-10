const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export async function fetchWeather(city) {
  const normalizedCity = city?.trim();

  if (!normalizedCity) {
    throw new Error("Please choose a destination.");
  }

  const apiUrl =
    `${API_BASE_URL.replace(/\/$/, "")}/weather/` +
    `${encodeURIComponent(normalizedCity)}?units=metric`;

  const response = await fetch(apiUrl);
  let data = null;

  try {
    data = await response.json();
  } catch {
    throw new Error("The weather service returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(
      data?.detail ||
        data?.error ||
        "Weather information is currently unavailable."
    );
  }

  if (!data?.current || !Array.isArray(data.forecast)) {
    throw new Error("No weather data was returned for that destination.");
  }

  return data;
}

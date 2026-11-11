"""
Pulls current weather + forecast for a destination from OpenWeather.

Like live_translation.py, a missing key or failed request just comes back
as an error message on the response instead of throwing.

Two things the provider error text must never reach the caller for: the request
URL carries `appid=<key>` as a query parameter, so the raw exception message
would leak the API key. Failures are logged by type only and answered with a
fixed message.

Responses are cached for 30 minutes (NFR-13). If the provider then fails, the
expired entry is served with `stale: True` so the UI can show a "last updated"
label instead of an error.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

import http_client
from config import settings
from services.cache_utils import mark_failed, recently_failed, ttl_cache_get, ttl_cache_set

logger = logging.getLogger(__name__)

OPENWEATHER_API_KEY = settings.get("openWeatherAPIKey")
BASE_URL = "https://api.openweathermap.org/data/2.5"
REQUEST_TIMEOUT_SECONDS = 10
CACHE_TTL_SECONDS = 30 * 60

# (city, units) -> (payload, fetched_at_monotonic), shared across requests on purpose
_weather_cache: dict[tuple[str, str], tuple[dict, float]] = {}
_weather_failures: dict[tuple[str, str], tuple[bool, float]] = {}


def _precipitation_mm(entry: dict) -> float | None:
    """OpenWeather reports rain/snow as {"1h": mm} or {"3h": mm}, and omits the
    key entirely when there is none."""
    for kind in ("rain", "snow"):
        volumes = entry.get(kind) or {}
        for window in ("1h", "3h"):
            if window in volumes:
                return volumes[window]
    return None


def _stale_or_error(cache_key: tuple[str, str], message: str) -> dict:
    cached = ttl_cache_get(_weather_cache, cache_key, CACHE_TTL_SECONDS, allow_stale=True)
    if cached is None:
        return {"error": f"Weather error: {message}"}
    return {**cached, "stale": True}


def get_weather(city: str, units: str = "metric") -> dict:
    if not OPENWEATHER_API_KEY:
        return {"error": "Weather error: openWeatherAPIKey is not configured."}

    cache_key = (city.strip().lower(), units)
    cached = ttl_cache_get(_weather_cache, cache_key, CACHE_TTL_SECONDS)
    if cached is not None:
        return cached
    if recently_failed(_weather_failures, cache_key):
        return _stale_or_error(cache_key, "The weather service is unavailable right now.")

    try:
        current_resp = http_client.get(
            f"{BASE_URL}/weather",
            params={"q": city, "units": units, "appid": OPENWEATHER_API_KEY},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        forecast_resp = http_client.get(
            f"{BASE_URL}/forecast",
            params={"q": city, "units": units, "appid": OPENWEATHER_API_KEY},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except Exception as e:
        # the exception text contains the signed request URL - log the type only
        logger.warning("OpenWeather request failed: %s", type(e).__name__)
        mark_failed(_weather_failures, cache_key)
        return _stale_or_error(cache_key, "Could not reach the weather service.")

    if current_resp.status_code == 404 or forecast_resp.status_code == 404:
        mark_failed(_weather_failures, cache_key)
        return {"error": f'No weather data found for "{city}".'}
    if not current_resp.ok or not forecast_resp.ok:
        logger.warning(
            "OpenWeather returned %s/%s", current_resp.status_code, forecast_resp.status_code
        )
        mark_failed(_weather_failures, cache_key)
        return _stale_or_error(cache_key, "The weather service is unavailable right now.")

    current = current_resp.json()
    forecast = forecast_resp.json()

    payload = {
        "city": current.get("name", city),
        "units": units,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "stale": False,
        "current": {
            "description": current.get("weather", [{}])[0].get("description"),
            "temp": current.get("main", {}).get("temp"),
            "feels_like": current.get("main", {}).get("feels_like"),
            "humidity": current.get("main", {}).get("humidity"),
            "wind_speed": current.get("wind", {}).get("speed"),
            "precipitation_mm": _precipitation_mm(current),
        },
        # forecast API gives readings every 3 hours, just grab the midday one for each day
        "forecast": [
            {
                "date": entry["dt_txt"].split(" ")[0],
                "description": entry.get("weather", [{}])[0].get("description"),
                "temp": entry.get("main", {}).get("temp"),
                "humidity": entry.get("main", {}).get("humidity"),
                "wind_speed": entry.get("wind", {}).get("speed"),
                # `pop` is a probability from 0 to 1; show it as a percentage
                "precipitation_chance": (
                    round(entry["pop"] * 100) if entry.get("pop") is not None else None
                ),
                "precipitation_mm": _precipitation_mm(entry),
            }
            for entry in forecast.get("list", [])
            if "12:00:00" in entry.get("dt_txt", "")
        ],
        "error": None,
    }

    ttl_cache_set(_weather_cache, cache_key, payload)
    return payload

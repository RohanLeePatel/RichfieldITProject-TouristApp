"""
Pulls current weather + forecast for a destination from OpenWeather.

Like live_translation.py, a missing key or failed request just comes back
as an error message on the response instead of throwing.
"""

from __future__ import annotations

import os

import requests

OPENWEATHER_API_KEY = os.environ.get("openWeatherAPIKey")
BASE_URL = "https://api.openweathermap.org/data/2.5"
REQUEST_TIMEOUT_SECONDS = 10


def get_weather(city: str, units: str = "metric") -> dict:
    if not OPENWEATHER_API_KEY:
        return {"error": "Weather error: openWeatherAPIKey is not configured."}

    try:
        current_resp = requests.get(
            f"{BASE_URL}/weather",
            params={"q": city, "units": units, "appid": OPENWEATHER_API_KEY},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        forecast_resp = requests.get(
            f"{BASE_URL}/forecast",
            params={"q": city, "units": units, "appid": OPENWEATHER_API_KEY},
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except Exception as e:
        return {"error": f"Weather error: {e}"}

    if current_resp.status_code == 404 or forecast_resp.status_code == 404:
        return {"error": f'No weather data found for "{city}".'}
    if not current_resp.ok or not forecast_resp.ok:
        return {"error": f"Weather error: OpenWeather returned {current_resp.status_code}/{forecast_resp.status_code}."}

    current = current_resp.json()
    forecast = forecast_resp.json()

    return {
        "city": current.get("name", city),
        "units": units,
        "current": {
            "description": current.get("weather", [{}])[0].get("description"),
            "temp": current.get("main", {}).get("temp"),
            "feels_like": current.get("main", {}).get("feels_like"),
            "humidity": current.get("main", {}).get("humidity"),
            "wind_speed": current.get("wind", {}).get("speed"),
        },
        # forecast API gives readings every 3 hours, just grab the midday one for each day
        "forecast": [
            {
                "date": entry["dt_txt"].split(" ")[0],
                "description": entry.get("weather", [{}])[0].get("description"),
                "temp": entry.get("main", {}).get("temp"),
                "humidity": entry.get("main", {}).get("humidity"),
            }
            for entry in forecast.get("list", [])
            if "12:00:00" in entry.get("dt_txt", "")
        ],
        "error": None,
    }

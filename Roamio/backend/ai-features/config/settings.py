"""
Every environment variable the service reads, in one place.

Names are listed here once, with what they are for, so that:
  - a new developer can see what to set (`.env.example` is checked against this
    list by tests/test_service_quality.py, so the two cannot drift apart)
  - a missing key is reported at startup, in the log, instead of as a confusing
    failure on the first request that needs it
  - the modules read through get(), so there is one way to read configuration

The modules still copy a value into a module constant (for example
landmarks.GEOAPIFY_API_KEY) because the tests replace those; get() is only the
reader.
"""

from __future__ import annotations

import logging
import os
from typing import NamedTuple

logger = logging.getLogger(__name__)


class Setting(NamedTuple):
    name: str
    feature: str  # what stops working without it
    required: bool  # the service cannot start usefully without it
    purpose: str


SETTINGS: tuple[Setting, ...] = (
    Setting("superSecretKey", "all", True, "Shared secret the Core API sends in the node-secretkey header."),
    Setting("userSigningKey", "translation history", False, "Signs the x-user-id the Core API sends (has a default: superSecretKey)."),
    Setting("geoapifyAPIKey", "landmarks, destinations", False, "Geoapify: landmarks, place search, destination data."),
    Setting("openWeatherAPIKey", "weather", False, "OpenWeather: current weather and forecast."),
    Setting("deepLAPIKey", "translation", False, "DeepL: text translation."),
    Setting("ocrSpaceAPIKey", "photo translation", False, "OCR.space: reading text from photos."),
    Setting("exchangeRateAPIKey", "exchange rates", False, "FastForex: exchange rates for budgets in other currencies."),
    Setting("TRAVEL_RISK_API_KEY_1", "safety scores", False, "TravelRiskAPI: country advisory levels."),
    Setting("TRAVEL_RISK_API_URL_1", "safety scores", False, "TravelRiskAPI base URL (has a default)."),
    Setting("geminiAPIKey", "chat assistant", False, "Google AI Studio key for the trip chat."),
    Setting("geminiModel", "chat assistant", False, "Gemini model name (has a default)."),
    Setting("SUPABASE_URL", "translation history", False, "Supabase project URL, for saved translations."),
    Setting("SUPABASE_SERVICE_ROLE_KEY", "translation history", False, "Supabase service key, for saved translations."),
    Setting("TRANSLATION_BUCKET_NAME", "translation history", False, "Storage bucket for translated photos (has a default)."),
)

_KNOWN = {s.name for s in SETTINGS}


def get(name: str, default: str | None = None) -> str | None:
    """The value of a registered setting, or `default` when unset or empty."""
    if name not in _KNOWN:
        raise KeyError(f"{name} is not registered in config/settings.py")
    return os.environ.get(name) or default


def missing() -> list[Setting]:
    """Registered settings that have no value and no default worth relying on.
    A setting counts as having a default when its purpose text contains
    "(has a default)", so keep that exact wording on any setting with a default."""
    return [s for s in SETTINGS if not os.environ.get(s.name) and "(has a default)" not in s.purpose]


def check_environment() -> None:
    """Logs what is not configured. Never raises: a missing optional key only
    switches its feature off (the health endpoint reports which)."""
    for setting in missing():
        level = logging.ERROR if setting.required else logging.WARNING
        logger.log(level, "%s is not set: %s will not work.", setting.name, setting.feature)

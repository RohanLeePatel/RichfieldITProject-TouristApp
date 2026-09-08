"""maps our interest tags to Geoapify's category codes. lives here instead of
scripts/ because landmarks_router.py needs it at request time, and scripts/
is just dev tooling that doesn't get deployed. enrich_destinations.py also
imports from here."""

INTEREST_CATEGORY_MAP: dict[str, list[str]] = {
    "history": ["tourism.sights", "entertainment.museum"],
    "nature": ["leisure.park", "natural"],
    "food": ["catering.restaurant", "catering.cafe"],
    "family": [
        "entertainment.zoo",
        "entertainment.aquarium",
        "entertainment.theme_park",
        # note: "leisure.park.playground" isn't a real category, tried it and got a
        # 400 back. this is the actual correct code
        "leisure.playground",
    ],
}

# broader categories used just for the accessibility sample (checking wheelchair
# tags), not tied to a specific interest - accessibility gets scored per city, not per tag
ACCESSIBILITY_SAMPLE_CATEGORIES = ["tourism", "catering", "entertainment", "leisure"]

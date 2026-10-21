"""maps our interest tags to Geoapify's category codes. lives here instead of
scripts/ because landmarks_router.py needs it at request time, and scripts/
is just dev tooling that doesn't get deployed. enrich_destinations.py also
imports from here."""

INTEREST_CATEGORY_MAP: dict[str, list[str]] = {
    # broad dimensions - still used by the country/city scoring engine, which
    # only knows these 4 (see engine/weights.py, cities_seed.py)
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
    # specific tags - onboarding lets users pick these directly, they only
    # ever reach /landmarks (place level), never the scoring engine, so there's
    # no equivalent seed-data requirement for them
    "parks": ["leisure.park"],
    "hiking": ["natural.mountain", "leisure.park"],
    # not "natural.beach" - tried it, Geoapify 400s. "beach" is the real code.
    "beaches": ["beach"],
    # not "leisure.water_park" - also 400s. "entertainment.water_park" is real.
    "waterparks": ["entertainment.water_park"],
    "museums": ["entertainment.museum"],
    "historic_sites": ["tourism.sights"],
    "restaurants": ["catering.restaurant"],
    "cafes": ["catering.cafe"],
    "street_food": ["catering.fast_food"],
    "theme_parks": ["entertainment.theme_park"],
    "zoos_aquariums": ["entertainment.zoo", "entertainment.aquarium"],
    "playgrounds": ["leisure.playground"],
}

# broader categories used just for the accessibility sample (checking wheelchair
# tags), not tied to a specific interest - accessibility gets scored per city, not per tag
ACCESSIBILITY_SAMPLE_CATEGORIES = ["tourism", "catering", "entertainment", "leisure"]

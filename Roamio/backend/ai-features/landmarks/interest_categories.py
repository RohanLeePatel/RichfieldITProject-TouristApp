"""§2 interest -> Geoapify category map. Lives here (not scripts/) because
routers/landmarks_router.py imports it on the live request path, and
scripts/ is documented as dev-tooling not part of the deployed Vercel
function. scripts/enrich_destinations.py imports this same module."""

INTEREST_CATEGORY_MAP: dict[str, list[str]] = {
    "history": ["tourism.sights", "entertainment.museum"],
    "nature": ["leisure.park", "natural"],
    "food": ["catering.restaurant", "catering.cafe"],
    "family": [
        "entertainment.zoo",
        "entertainment.aquarium",
        "entertainment.theme_park",
        # The plan wrote "leisure.park.playground" — not a valid Geoapify
        # category (verified live, 400 Bad Request). Correct code is
        # "leisure.playground".
        "leisure.playground",
    ],
}

# Broad, tourist-relevant supercategories used only for the accessibility
# sample (§2's "wheelchair condition filter" query) — not tied to any one
# interest tag, since accessibility is scored city-wide.
ACCESSIBILITY_SAMPLE_CATEGORIES = ["tourism", "catering", "entertainment", "leisure"]

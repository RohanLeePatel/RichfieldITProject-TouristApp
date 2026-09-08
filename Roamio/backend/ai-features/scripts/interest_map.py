"""§2 interest -> Geoapify category map, as specified in the plan."""

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

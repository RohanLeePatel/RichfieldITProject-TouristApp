"""
§2 demo destination set — deliberately small starter batch (6 cities / 4
countries) rather than the plan's full 15-30/8-12, per build-session scope.
Expand this list and re-run enrich_destinations.py to grow the seed set;
nothing else in the pipeline needs to change.

cost_index (1-5) is hand-curated (§2: "not available from Geoapify... manual
seed work") from general knowledge of typical tourist daily spend
(accommodation + food + activities, per person), rough-converted to ZAR
band per engine/weights.py COST_BAND_ZAR_RANGE. This is a placeholder
estimate, not researched pricing data — refine before relying on it for
anything beyond a demo.

radius_m is a single approximate "city core + surrounds" bound for all
cities, not a per-city-tuned bounding box (§2 allows rect: or circle:,
tuned per city) — a shortcut for the starter batch.
"""

CITIES = [
    {
        "id": "za-cpt",
        "name": "Cape Town",
        "country": "South Africa",
        "lat": -33.9249,
        "lon": 18.4241,
        "radius_m": 15000,
        "cost_index": 3,  # ~R900-1500/day for a tourist — mid band
    },
    {
        "id": "za-dbn",
        "name": "Durban",
        "country": "South Africa",
        "lat": -29.8587,
        "lon": 31.0218,
        "radius_m": 15000,
        "cost_index": 2,  # cheaper than Cape Town for tourists — ~R500-900/day
    },
    {
        "id": "na-whk",
        "name": "Windhoek",
        "country": "Namibia",
        "lat": -22.5609,
        "lon": 17.0658,
        "radius_m": 12000,
        "cost_index": 3,
    },
    {
        "id": "pt-lis",
        "name": "Lisbon",
        "country": "Portugal",
        "lat": 38.7223,
        "lon": -9.1393,
        "radius_m": 15000,
        "cost_index": 4,  # EUR-priced destination, ~R1500-2500/day
    },
    {
        "id": "pt-opo",
        "name": "Porto",
        "country": "Portugal",
        "lat": 41.1579,
        "lon": -8.6291,
        "radius_m": 12000,
        "cost_index": 3,
    },
    {
        "id": "th-bkk",
        "name": "Bangkok",
        "country": "Thailand",
        "lat": 13.7563,
        "lon": 100.5018,
        "radius_m": 18000,
        "cost_index": 2,  # cheap for tourists relative to ZAR budgets
    },
]

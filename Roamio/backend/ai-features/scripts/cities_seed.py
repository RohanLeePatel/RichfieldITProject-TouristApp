"""
Small demo set of destinations - 6 cities across 4 countries, kept small on
purpose for now instead of the full 15-30 city list we could eventually build.
Add more cities here and re-run enrich_destinations.py to grow the dataset,
nothing else needs to change.

cost_index (1-5) is just a guess based on general knowledge of typical tourist
spend per day (accommodation + food + activities), mapped to the ZAR bands in
engine/weights.py's COST_BAND_ZAR_RANGE. Not actual researched pricing data,
should get refined before this is used for anything beyond a demo.

radius_m is one rough "city + surrounding area" radius for every city, not
tuned per city individually - good enough for now, could be more precise later.
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

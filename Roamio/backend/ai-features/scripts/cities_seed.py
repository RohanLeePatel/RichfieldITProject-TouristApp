"""Curated tourist-city catalog used to build recommendation seed data.

Geoapify enriches these cities offline with interest, accessibility, and
climate data. Add a city here, then run ``scripts/enrich_destinations.py``.
"""

CITIES = [
    # South Africa
    {"id": "za-cpt", "name": "Cape Town", "country": "South Africa", "lat": -33.9249, "lon": 18.4241, "radius_m": 15000, "cost_index": 3},
    {"id": "za-dbn", "name": "Durban", "country": "South Africa", "lat": -29.8587, "lon": 31.0218, "radius_m": 15000, "cost_index": 2},
    {"id": "za-jnb", "name": "Johannesburg", "country": "South Africa", "lat": -26.2041, "lon": 28.0473, "radius_m": 18000, "cost_index": 3},
    {"id": "za-pry", "name": "Pretoria", "country": "South Africa", "lat": -25.7479, "lon": 28.2293, "radius_m": 15000, "cost_index": 3},
    {"id": "za-els", "name": "Gqeberha", "country": "South Africa", "lat": -33.9608, "lon": 25.6022, "radius_m": 12000, "cost_index": 2},
    {"id": "za-eth", "name": "East London", "country": "South Africa", "lat": -33.0153, "lon": 27.9116, "radius_m": 12000, "cost_index": 2},
    {"id": "za-bfn", "name": "Bloemfontein", "country": "South Africa", "lat": -29.0852, "lon": 26.1596, "radius_m": 12000, "cost_index": 2},
    {"id": "za-pol", "name": "Polokwane", "country": "South Africa", "lat": -23.8962, "lon": 29.4486, "radius_m": 12000, "cost_index": 2},
    {"id": "za-mbp", "name": "Mbombela", "country": "South Africa", "lat": -25.4753, "lon": 30.9694, "radius_m": 15000, "cost_index": 2},
    {"id": "za-grj", "name": "George", "country": "South Africa", "lat": -33.963, "lon": 22.4617, "radius_m": 12000, "cost_index": 3},
    {"id": "za-kns", "name": "Knysna", "country": "South Africa", "lat": -34.0363, "lon": 23.0471, "radius_m": 10000, "cost_index": 3},
    {"id": "za-stb", "name": "Stellenbosch", "country": "South Africa", "lat": -33.9321, "lon": 18.8602, "radius_m": 10000, "cost_index": 3},
    {"id": "za-her", "name": "Hermanus", "country": "South Africa", "lat": -34.4187, "lon": 19.2345, "radius_m": 10000, "cost_index": 3},
    {"id": "za-pmb", "name": "Pietermaritzburg", "country": "South Africa", "lat": -29.6006, "lon": 30.3794, "radius_m": 10000, "cost_index": 2},
    {"id": "za-rst", "name": "Rustenburg", "country": "South Africa", "lat": -25.6676, "lon": 27.2421, "radius_m": 12000, "cost_index": 2},
    {"id": "za-kby", "name": "Kimberley", "country": "South Africa", "lat": -28.7282, "lon": 24.7499, "radius_m": 10000, "cost_index": 2},
    {"id": "za-uti", "name": "Upington", "country": "South Africa", "lat": -28.4572, "lon": 21.2425, "radius_m": 10000, "cost_index": 2},

    # Existing international seed destinations
    {"id": "na-whk", "name": "Windhoek", "country": "Namibia", "lat": -22.5609, "lon": 17.0658, "radius_m": 12000, "cost_index": 3},
    {"id": "pt-lis", "name": "Lisbon", "country": "Portugal", "lat": 38.7223, "lon": -9.1393, "radius_m": 15000, "cost_index": 4},
    {"id": "pt-opo", "name": "Porto", "country": "Portugal", "lat": 41.1579, "lon": -8.6291, "radius_m": 12000, "cost_index": 3},
    {"id": "th-bkk", "name": "Bangkok", "country": "Thailand", "lat": 13.7563, "lon": 100.5018, "radius_m": 18000, "cost_index": 2},

    # Major international tourist cities
    {"id": "us-nyc", "name": "New York", "country": "United States", "lat": 40.7128, "lon": -74.006, "radius_m": 18000, "cost_index": 5},
    {"id": "gb-lon", "name": "London", "country": "United Kingdom", "lat": 51.5074, "lon": -0.1278, "radius_m": 18000, "cost_index": 5},
    {"id": "fr-par", "name": "Paris", "country": "France", "lat": 48.8566, "lon": 2.3522, "radius_m": 15000, "cost_index": 5},
    {"id": "it-rom", "name": "Rome", "country": "Italy", "lat": 41.9028, "lon": 12.4964, "radius_m": 15000, "cost_index": 4},
    {"id": "es-bcn", "name": "Barcelona", "country": "Spain", "lat": 41.3874, "lon": 2.1686, "radius_m": 15000, "cost_index": 4},
    {"id": "es-mad", "name": "Madrid", "country": "Spain", "lat": 40.4168, "lon": -3.7038, "radius_m": 15000, "cost_index": 4},
    {"id": "nl-ams", "name": "Amsterdam", "country": "Netherlands", "lat": 52.3676, "lon": 4.9041, "radius_m": 12000, "cost_index": 5},
    {"id": "de-ber", "name": "Berlin", "country": "Germany", "lat": 52.52, "lon": 13.405, "radius_m": 15000, "cost_index": 4},
    {"id": "ae-dxb", "name": "Dubai", "country": "United Arab Emirates", "lat": 25.2048, "lon": 55.2708, "radius_m": 18000, "cost_index": 5},
    {"id": "jp-tyo", "name": "Tokyo", "country": "Japan", "lat": 35.6762, "lon": 139.6503, "radius_m": 18000, "cost_index": 4},
    {"id": "sg-sin", "name": "Singapore", "country": "Singapore", "lat": 1.3521, "lon": 103.8198, "radius_m": 12000, "cost_index": 4},
    {"id": "au-syd", "name": "Sydney", "country": "Australia", "lat": -33.8688, "lon": 151.2093, "radius_m": 18000, "cost_index": 4},
    {"id": "au-mel", "name": "Melbourne", "country": "Australia", "lat": -37.8136, "lon": 144.9631, "radius_m": 15000, "cost_index": 4},
    {"id": "br-rio", "name": "Rio de Janeiro", "country": "Brazil", "lat": -22.9068, "lon": -43.1729, "radius_m": 18000, "cost_index": 3},
    {"id": "ar-bue", "name": "Buenos Aires", "country": "Argentina", "lat": -34.6037, "lon": -58.3816, "radius_m": 15000, "cost_index": 3},
    {"id": "mx-cmx", "name": "Mexico City", "country": "Mexico", "lat": 19.4326, "lon": -99.1332, "radius_m": 18000, "cost_index": 3},
    {"id": "ca-tor", "name": "Toronto", "country": "Canada", "lat": 43.6532, "lon": -79.3832, "radius_m": 15000, "cost_index": 4},
    {"id": "ca-van", "name": "Vancouver", "country": "Canada", "lat": 49.2827, "lon": -123.1207, "radius_m": 15000, "cost_index": 4},
    {"id": "eg-cai", "name": "Cairo", "country": "Egypt", "lat": 30.0444, "lon": 31.2357, "radius_m": 18000, "cost_index": 2},
    {"id": "ke-nbo", "name": "Nairobi", "country": "Kenya", "lat": -1.2921, "lon": 36.8219, "radius_m": 15000, "cost_index": 3},
]

"""
The managed destination catalog: rows sent with a recommendation request, the
enrichment route the admin dashboard calls, and the provider code behind it.
No network - every provider call is stubbed.
"""

import importlib

import pytest
import requests
from fastapi.testclient import TestClient

import engine.enrich as enrich
from engine.catalog import load_city_candidates, load_country_catalog, raw_from_catalog
from schemas.recommendations import CatalogEntry
from tests.test_contract import VALID_PAYLOAD

SECRET = {"node-secretkey": "test-secret"}
TAGS = list(enrich.INTEREST_CATEGORY_MAP)


def entry(id_, name, country, cost=3, **counts):
    return {
        "id": id_,
        "name": name,
        "country": country,
        "cost_index": cost,
        "interest_counts": {tag: counts.get(tag, 0) for tag in TAGS},
        "accessibility": "supported",
        "accessible_ratio": 0.8,
        "tagged_total": 12,
        "avg_temp_by_month": {"6": 18.0},
        "avg_rain_mm_by_month": {"6": 40.0},
    }


CATALOG = [
    entry("jp-kyo", "Kyoto", "Japan", history=300, food=100),
    entry("jp-osa", "Osaka", "Japan", history=30, food=500),
    entry("is-rey", "Reykjavik", "Iceland", cost=5, nature=200),
]


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("superSecretKey", "test-secret")
    import config.auth as auth_module

    importlib.reload(auth_module)
    import main as main_module

    importlib.reload(main_module)
    return TestClient(main_module.app)


# ---------------------------------------------------------------------------
# catalog sent with the request
# ---------------------------------------------------------------------------


def test_normalize_scales_density_against_the_strongest_city():
    rows = enrich.normalize_entries(CATALOG)
    kyoto, osaka = rows[0]["features"], rows[1]["features"]
    assert kyoto["interest_density"]["history"] == pytest.approx(1.0)  # the batch maximum
    assert 0 < osaka["interest_density"]["history"] < 1
    assert rows[2]["features"]["interest_density"]["history"] == 0.0  # no count, no density
    assert kyoto["cost_index"] == 3 and rows[2]["features"]["cost_index"] == 5
    assert "image_url" not in rows[0]


def test_normalize_with_no_counts_at_all_gives_zero_density_not_a_crash():
    rows = enrich.normalize_entries([entry("x-y", "Nowhere", "Nowhere")])
    assert set(rows[0]["features"]["interest_density"].values()) == {0.0}


def test_a_managed_catalog_replaces_the_seed_file():
    raw = raw_from_catalog([CatalogEntry(**e) for e in CATALOG])
    assert {c.id for c in load_city_candidates(raw=raw)} == {"jp-kyo", "jp-osa", "is-rey"}
    assert {c.id for c in load_city_candidates(country_id="japan", raw=raw)} == {"jp-kyo", "jp-osa"}
    countries = {c.name: c for c in load_country_catalog(raw)}
    assert set(countries) == {"Japan", "Iceland"}
    assert len(countries["Japan"].children) == 2


def test_no_managed_catalog_means_use_the_seed():
    assert raw_from_catalog([]) is None


def test_recommendations_use_the_catalog_in_the_request(client):
    body = {**VALID_PAYLOAD, "level": "city", "parent_id": "japan", "catalog": CATALOG}
    body.pop("candidates", None)
    response = client.post("/recommendations", json=body, headers=SECRET)
    assert response.status_code == 200
    assert {r["id"] for r in response.json()["results"]} <= {"jp-kyo", "jp-osa"}


def test_country_level_groups_the_managed_cities(client):
    body = {**VALID_PAYLOAD, "level": "country", "catalog": CATALOG}
    body.pop("candidates", None)
    response = client.post("/recommendations", json=body, headers=SECRET)
    assert response.status_code == 200
    ids = {r["id"] for r in response.json()["results"]} | {x["id"] for x in response.json()["excluded"]}
    assert ids == {"japan", "iceland"}


def test_an_empty_catalog_falls_back_to_the_seed(client):
    body = {**VALID_PAYLOAD, "level": "city", "parent_id": "portugal", "catalog": []}
    body.pop("candidates", None)
    response = client.post("/recommendations", json=body, headers=SECRET)
    assert response.status_code == 200
    assert {r["id"] for r in response.json()["results"]} <= {"pt-lis", "pt-opo"}


def test_a_bad_catalog_row_is_rejected(client):
    bad = {**CATALOG[0], "cost_index": 9}
    body = {**VALID_PAYLOAD, "level": "city", "parent_id": "japan", "catalog": [bad]}
    body.pop("candidates", None)
    assert client.post("/recommendations", json=body, headers=SECRET).status_code == 422


# ---------------------------------------------------------------------------
# POST /destinations/enrich
# ---------------------------------------------------------------------------

ENRICH_BODY = {"name": "Kyoto", "country": "Japan", "lat": 35.01, "lon": 135.77, "radius_m": 12000}
RAW = {
    "interest_counts": {"history": 5},
    "accessibility": "unknown",
    "accessible_ratio": None,
    "tagged_total": 0,
    "avg_temp_by_month": {"1": 4.0},
    "avg_rain_mm_by_month": {"1": 50.0},
}


@pytest.fixture
def enrich_route(monkeypatch):
    import routers.destinations_router as router

    monkeypatch.setattr(router.landmarks_module, "GEOAPIFY_API_KEY", "geo-key")
    monkeypatch.setattr(router, "enrich_city_raw", lambda *a, **k: RAW)
    monkeypatch.setattr(router, "find_cover_image", lambda name, country: "https://img/kyoto.jpg")
    return router


def test_enrich_needs_the_service_key(client, enrich_route):
    assert client.post("/destinations/enrich", json=ENRICH_BODY).status_code == 422
    assert client.post("/destinations/enrich", json=ENRICH_BODY, headers={"node-secretkey": "no"}).status_code == 401


def test_enrich_returns_the_numbers_and_a_cover_image(client, enrich_route):
    response = client.post("/destinations/enrich", json=ENRICH_BODY, headers=SECRET)
    assert response.status_code == 200
    assert response.json()["interest_counts"] == {"history": 5}
    assert response.json()["image_url"] == "https://img/kyoto.jpg"


def test_enrich_without_a_provider_key_is_a_503(client, enrich_route, monkeypatch):
    monkeypatch.setattr(enrich_route.landmarks_module, "GEOAPIFY_API_KEY", None)
    assert client.post("/destinations/enrich", json=ENRICH_BODY, headers=SECRET).status_code == 503


def test_enrich_provider_failure_is_a_502(client, enrich_route, monkeypatch):
    def boom(*a, **k):
        raise enrich.EnrichmentError("A data provider did not answer (HTTPError).")

    monkeypatch.setattr(enrich_route, "enrich_city_raw", boom)
    response = client.post("/destinations/enrich", json=ENRICH_BODY, headers=SECRET)
    assert response.status_code == 502
    assert "did not answer" in response.json()["detail"]


def test_geocode_finds_a_place_by_name(client, enrich_route, monkeypatch):
    seen = []
    monkeypatch.setattr(
        enrich_route.landmarks_module, "geocode_destination", lambda text, radius: seen.append(text) or (35.0, 135.7)
    )
    body = {"name": "Kyoto", "country": "Japan"}
    response = client.post("/destinations/geocode", json=body, headers=SECRET)
    assert response.json() == {"lat": 35.0, "lon": 135.7}
    assert seen == ["Kyoto, Japan"]
    assert client.post("/destinations/geocode", json=body).status_code == 422  # no service key

    monkeypatch.setattr(enrich_route.landmarks_module, "geocode_destination", lambda text, radius: None)
    assert client.post("/destinations/geocode", json=body, headers=SECRET).status_code == 404
    monkeypatch.setattr(enrich_route.landmarks_module, "GEOAPIFY_API_KEY", None)
    assert client.post("/destinations/geocode", json=body, headers=SECRET).status_code == 503


@pytest.mark.parametrize("change", [{"lat": 91}, {"lon": -181}, {"radius_m": 10}, {"name": ""}])
def test_enrich_rejects_bad_coordinates_and_names(client, enrich_route, change):
    response = client.post("/destinations/enrich", json={**ENRICH_BODY, **change}, headers=SECRET)
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# provider code
# ---------------------------------------------------------------------------


class FakeResponse:
    def __init__(self, payload, ok=True):
        self._payload, self.ok = payload, ok

    def raise_for_status(self):
        if not self.ok:
            raise requests.HTTPError("403 for url ...apiKey=SECRET")

    def json(self):
        return self._payload


def test_estimated_count_is_exact_below_the_page_limit():
    assert enrich.estimated_poi_count([{}] * 10, 10000, 0, 0) == 10


def test_estimated_count_extrapolates_a_clipped_result():
    # 500 places all within ~1 km of the centre in a 10 km search: far denser than 500
    near = [{"lat": 0.0, "lon": 0.005 * (i / 500)} for i in range(enrich.PLACES_LIMIT)]
    assert enrich.estimated_poi_count(near, 10000, 0.0, 0.0) > enrich.PLACES_LIMIT * 10
    # no usable coordinates: stay at the clipped count
    assert enrich.estimated_poi_count([{}] * enrich.PLACES_LIMIT, 10000, 0, 0) == enrich.PLACES_LIMIT
    # every place at the centre: nothing to extrapolate from
    assert enrich.estimated_poi_count([{"lat": 0, "lon": 0}] * enrich.PLACES_LIMIT, 10000, 0, 0) == enrich.PLACES_LIMIT


def test_accessibility_states(monkeypatch):
    def with_tags(n, accessible):
        pois = [{"datasource": {"raw": {"wheelchair": "yes" if i < accessible else "no"}}} for i in range(n)]
        monkeypatch.setattr(enrich, "geoapify_places", lambda *a, **k: pois)
        return enrich.fetch_accessibility("k", 0, 0, 1000)

    assert with_tags(3, 3)["accessibility"] == "unknown"  # too few tagged to say
    assert with_tags(10, 8) == {"accessibility": "supported", "accessible_ratio": 0.8, "tagged_total": 10}
    assert with_tags(20, 1)["accessibility"] == "poor"
    assert with_tags(10, 3)["accessibility"] == "unknown"  # ambiguous middle is never "poor"
    assert with_tags(0, 0)["accessible_ratio"] is None


def test_geoapify_places_sends_the_conditions(monkeypatch):
    seen = {}

    def fake_get(url, params, timeout):
        seen.update(params)
        return FakeResponse({"features": [{"properties": {"name": "x"}}]})

    monkeypatch.setattr(enrich.requests, "get", fake_get)
    assert enrich.geoapify_places("k", ["a", "b"], 1.0, 2.0, 500, conditions="wheelchair") == [{"name": "x"}]
    assert seen["categories"] == "a,b" and seen["conditions"] == "wheelchair" and seen["filter"] == "circle:2.0,1.0,500"


def test_climate_normals_average_per_month(monkeypatch):
    daily = {
        "time": ["2023-01-01", "2023-01-02", "2023-02-01"],
        "temperature_2m_mean": [10.0, 12.0, None],
        "precipitation_sum": [1.0, 2.5, 4.0],
    }
    monkeypatch.setattr(enrich.requests, "get", lambda *a, **k: FakeResponse({"daily": daily}))
    temp, rain = enrich.fetch_climate_normals(0, 0)
    assert temp == {"1": 11.0}  # a missing reading is skipped, not zero
    assert rain == {"1": 3.5, "2": 4.0}  # rainfall is a monthly total


def test_enrich_city_raw_collects_every_tag(monkeypatch):
    monkeypatch.setattr(enrich, "geoapify_places", lambda *a, **k: [{}] * 4)
    monkeypatch.setattr(enrich, "fetch_accessibility", lambda *a: {"accessibility": "supported", "accessible_ratio": 1.0, "tagged_total": 9})
    monkeypatch.setattr(enrich, "fetch_climate_normals", lambda *a: ({"1": 5.0}, {"1": 6.0}))
    raw = enrich.enrich_city_raw("k", 1.0, 2.0, 5000, workers=3)
    assert raw["interest_counts"] == dict.fromkeys(TAGS, 4)
    assert raw["accessibility"] == "supported" and raw["avg_temp_by_month"] == {"1": 5.0}


def test_a_provider_failure_never_leaks_the_key(monkeypatch):
    monkeypatch.setattr(enrich.requests, "get", lambda *a, **k: FakeResponse({}, ok=False))
    with pytest.raises(enrich.EnrichmentError) as error:
        enrich.enrich_city_raw("SECRET", 1.0, 2.0, 5000)
    assert "SECRET" not in str(error.value) and "SECRET" not in repr(error.value.__cause__.__class__)


def test_cover_image_tries_the_qualified_title_first(monkeypatch):
    titles = []

    def fake_thumbnail(title):
        titles.append(title)
        return "https://img/x.jpg" if title == "East London" else None

    monkeypatch.setattr(enrich, "fetch_thumbnail", fake_thumbnail)
    assert enrich.find_cover_image("East London", "South Africa") == "https://img/x.jpg"
    assert titles == ["East London, South Africa", "East London"]
    monkeypatch.setattr(enrich, "fetch_thumbnail", lambda t: None)
    assert enrich.find_cover_image("Nowhere", "Nothing") is None


def test_thumbnail_handles_missing_disambiguation_and_network_errors(monkeypatch):
    monkeypatch.setattr(enrich.requests, "get", lambda *a, **k: FakeResponse({"thumbnail": {"source": "https://t/x.jpg"}}))
    assert enrich.fetch_thumbnail("Paris, France") == "https://t/x.jpg"
    monkeypatch.setattr(enrich.requests, "get", lambda *a, **k: FakeResponse({"type": "disambiguation", "thumbnail": {"source": "u"}}))
    assert enrich.fetch_thumbnail("Mercury") is None
    monkeypatch.setattr(enrich.requests, "get", lambda *a, **k: FakeResponse({}, ok=False))
    assert enrich.fetch_thumbnail("Nope") is None

    def boom(*a, **k):
        raise requests.ConnectionError()

    monkeypatch.setattr(enrich.requests, "get", boom)
    assert enrich.fetch_thumbnail("Nope") is None

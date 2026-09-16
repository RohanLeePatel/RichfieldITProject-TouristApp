import pytest

from engine.catalog import load_city_candidates, load_country_catalog, slugify_country


def test_load_country_catalog_has_one_entry_per_real_country():
    countries = load_country_catalog()
    names = {c.name for c in countries}
    assert len(names) >= 20
    assert {"South Africa", "Namibia", "Portugal", "Thailand"}.issubset(names)


def test_country_candidate_aggregates_children_interest_density():
    countries = load_country_catalog()
    south_africa = next(c for c in countries if c.name == "South Africa")
    # aggregated from its cities the same way cost/safety are - not left empty
    # (would otherwise only ever show up diluted through the child blend)
    assert south_africa.features.interest_density
    child_history = [
        c.features.interest_density.get("history", 0.0) for c in south_africa.children
    ]
    expected = sum(child_history) / len(child_history)
    assert south_africa.features.interest_density.get("history") == pytest.approx(expected)


def test_country_candidate_children_are_its_own_cities():
    countries = load_country_catalog()
    south_africa = next(c for c in countries if c.name == "South Africa")
    child_ids = {c.id for c in south_africa.children}
    assert {"za-cpt", "za-dbn", "za-jnb", "za-pry"}.issubset(child_ids)
    assert len(child_ids) >= 15


def test_load_city_candidates_filters_by_country_id():
    cities = load_city_candidates(country_id="portugal")
    assert {c.id for c in cities} == {"pt-lis", "pt-opo"}


def test_load_city_candidates_unknown_country_returns_empty():
    assert load_city_candidates(country_id="atlantis") == []


def test_load_city_candidates_no_filter_returns_all():
    assert len(load_city_candidates()) >= 35


def test_slugify_country():
    assert slugify_country("South Africa") == "south-africa"

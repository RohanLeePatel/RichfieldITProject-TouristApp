import engine.currency as currency
from engine.gates import check_accessibility_gate, check_budget_gate, check_landmark_availability_gate, run_gates
from tests.conftest import make_candidate


def test_budget_gate_excludes_over_budget(destinations, prefs_factory):
    prefs = prefs_factory(budget_per_day=400)  # below band 5's floor (2500)
    reason = check_budget_gate(prefs, destinations["expensive_untagged_beach"])
    assert reason is not None
    assert "budget" in reason.lower()


def test_budget_gate_passes_expensive_band_with_high_budget(destinations, prefs_factory):
    """band 5 has no ceiling so it should never get excluded no matter how high the budget is"""
    prefs = prefs_factory(budget_per_day=10000)
    reason = check_budget_gate(prefs, destinations["expensive_untagged_beach"])
    assert reason is None


def test_budget_gate_passes_within_budget(destinations, prefs_factory):
    prefs = prefs_factory(budget_per_day=1000)
    reason = check_budget_gate(prefs, destinations["cheap_accessible_historic"])
    assert reason is None


def test_budget_gate_no_cost_data_passes(destinations, prefs_factory):
    prefs = prefs_factory(budget_per_day=1)
    d = destinations["cheap_accessible_historic"]
    d.features.cost_index = None
    assert check_budget_gate(prefs, d) is None


def test_budget_gate_converts_non_zar_currency(destinations, prefs_factory, monkeypatch):
    """band 5's ZAR floor is 2500, converted at 0.055 that's about 137.50 USD"""
    currency._rate_cache.clear()
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")
    monkeypatch.setattr(
        currency.requests,
        "get",
        lambda url, timeout: type(
            "R", (), {"raise_for_status": lambda self: None, "json": lambda self: {"base": "ZAR", "result": {"USD": 0.055}}}
        )(),
    )

    prefs = prefs_factory(budget_per_day=100, currency="USD")
    reason = check_budget_gate(prefs, destinations["expensive_untagged_beach"])
    assert reason is not None
    assert "USD" in reason

    prefs = prefs_factory(budget_per_day=200, currency="USD")
    reason = check_budget_gate(prefs, destinations["expensive_untagged_beach"])
    assert reason is None


def test_budget_gate_unavailable_conversion_does_not_gate(destinations, prefs_factory, monkeypatch):
    """no key or a failed lookup should fail open, not wrongly exclude someone"""
    currency._rate_cache.clear()
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", None)

    prefs = prefs_factory(budget_per_day=1, currency="USD")
    reason = check_budget_gate(prefs, destinations["expensive_untagged_beach"])
    assert reason is None


def test_accessibility_gate_excludes_required_and_poor(destinations, prefs_factory):
    prefs = prefs_factory(wheelchair="required")
    reason = check_accessibility_gate(prefs, destinations["mid_poor_access_nightlife"])
    assert reason is not None


def test_accessibility_gate_does_not_exclude_unknown(destinations, prefs_factory):
    """unknown accessibility should never get gated out like it's poor"""
    prefs = prefs_factory(wheelchair="required")
    reason = check_accessibility_gate(prefs, destinations["mid_no_climate_data"])
    assert reason is None


def test_accessibility_gate_not_applied_when_not_required(destinations, prefs_factory):
    prefs = prefs_factory(wheelchair="preferred")
    reason = check_accessibility_gate(prefs, destinations["mid_poor_access_nightlife"])
    assert reason is None


def test_run_gates_returns_first_hit(destinations, prefs_factory):
    prefs = prefs_factory(budget_per_day=1, wheelchair="required")
    reason = run_gates(prefs, destinations["expensive_poor_access_historic"])
    assert reason is not None  # budget gate should hit first since it's earlier in GATES


def test_landmark_availability_gate_excludes_measured_zero(prefs_factory):
    candidate = make_candidate("d99", "No Museums Here", interest_counts={"museums": 0, "nature": 12})
    prefs = prefs_factory(interests=["museums"])
    reason = check_landmark_availability_gate(prefs, candidate)
    assert reason is not None
    assert "museums" in reason.lower()


def test_landmark_availability_gate_ignores_unmeasured_tags(prefs_factory):
    # "museums" key is entirely absent (never measured), not an explicit zero -
    # shouldn't be punished the same way a real measured zero would be
    candidate = make_candidate("d100", "Unmeasured City", interest_counts={"nature": 12})
    prefs = prefs_factory(interests=["museums"])
    assert check_landmark_availability_gate(prefs, candidate) is None


def test_landmark_availability_gate_passes_with_any_positive_count(prefs_factory):
    candidate = make_candidate("d101", "Some Museums", interest_counts={"museums": 1, "nature": 0})
    prefs = prefs_factory(interests=["museums", "nature"])
    assert check_landmark_availability_gate(prefs, candidate) is None


def test_interests_that_were_never_measured_do_not_exclude(destinations, prefs_factory):
    """A tag with no count at all means "never measured", not "measured as
    zero" - a thinly mapped city is not a bad one (BR-08)."""
    candidate = destinations["cheap_accessible_historic"]
    candidate.features.interest_counts = {}  # nothing measured for any tag
    assert check_landmark_availability_gate(prefs_factory(interests=["history"]), candidate) is None

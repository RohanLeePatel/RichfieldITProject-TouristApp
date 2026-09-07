import engine.currency as currency
from engine.gates import check_accessibility_gate, check_budget_gate, run_gates


def test_budget_gate_excludes_over_budget(destinations, prefs_factory):
    prefs = prefs_factory(budget_per_day=400)  # below band 5's floor (2500)
    reason = check_budget_gate(prefs, destinations["expensive_untagged_beach"])
    assert reason is not None
    assert "budget" in reason.lower()


def test_budget_gate_passes_expensive_band_with_high_budget(destinations, prefs_factory):
    """Regression: band 5 (open-ended) must not be excluded no matter the budget."""
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
    """Band 5's ZAR floor (2500) converted to USD at 0.055 is ~137.50."""
    currency._rate_cache.clear()
    monkeypatch.setattr(currency, "EXCHANGE_RATE_API_KEY", "test-key")
    monkeypatch.setattr(
        currency.requests,
        "get",
        lambda url, timeout: type(
            "R", (), {"raise_for_status": lambda self: None, "json": lambda self: {"result": "success", "conversion_rate": 0.055}}
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
    """No key / failed lookup must fail open, not wrongly exclude a candidate."""
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
    """§9 open risk: unknown must never be gated out as if it were poor."""
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
    assert reason is not None  # budget gate hits first, per GATES order

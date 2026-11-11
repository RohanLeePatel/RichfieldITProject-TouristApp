from engine.weights import WEIGHTS


def test_weights_sum_to_one_per_level():
    for level, vector in WEIGHTS.items():
        total = sum(vector.values())
        assert abs(total - 1.0) < 1e-9, f"{level} weights sum to {total}, not 1.0"

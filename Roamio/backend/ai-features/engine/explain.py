from __future__ import annotations

from schemas.recommendations import EvidenceEntry


def build_explanation(candidate_name: str, breakdown: list[EvidenceEntry]) -> str:
    weighted = [e for e in breakdown if e.weight > 0]
    if not weighted:
        return f"'{candidate_name}'"
    top = max(weighted, key=lambda e: e.weight * e.value)
    return f"{candidate_name}: {top.explanation}"


def build_comparison(
    name_1: str,
    breakdown_1: list[EvidenceEntry],
    name_2: str,
    breakdown_2: list[EvidenceEntry],
) -> str | None:

    by_dim_1 = {e.dimension: e for e in breakdown_1}
    by_dim_2 = {e.dimension: e for e in breakdown_2}
    shared = set(by_dim_1) & set(by_dim_2)
    if not shared:
        return None

    def contribution(entry: EvidenceEntry) -> float:
        return entry.weight * entry.value

    deltas = {
        dim: contribution(by_dim_1[dim]) - contribution(by_dim_2[dim])
        for dim in shared
        if by_dim_1[dim].weight > 0 or by_dim_2[dim].weight > 0
    }
    if not deltas:
        return None

    top_dim = max(deltas, key=lambda d: abs(deltas[d]))
    delta = deltas[top_dim]
    if delta == 0:
        return None

    winner, loser = (name_1, name_2) if delta > 0 else (name_2, name_1)
    return (
        f"{winner} ranked above {loser} mainly on {top_dim} "
        f"({abs(delta):.0%} more of the total score from that dimension)."
    )

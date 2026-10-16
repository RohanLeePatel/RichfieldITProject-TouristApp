from __future__ import annotations

from statistics import median

from schemas.recommendations import EvidenceEntry

# Contribution gaps below this are noise, not a reason. Used both to decide
# whether a candidate really stands out from its peers and whether two
# candidates are genuinely separable.
MEANINGFUL_GAP = 0.01


def _contribution(entry: EvidenceEntry) -> float:
    return entry.weight * entry.value


def build_explanation(
    candidate_name: str,
    breakdown: list[EvidenceEntry],
    peers: list[list[EvidenceEntry]] | None = None,
) -> str:
    """
    One sentence saying why this candidate is here.

    With `peers` (the other results in the same response), this names the
    dimension where the candidate stands out *from them*, rather than the one
    with the largest raw contribution. Those are very different sentences: the
    largest contribution is usually whichever dimension carries the most
    weight, which is the same dimension for every candidate scored against the
    same preferences - so every result ended up explained with an identical
    line ("Cost band 2/5 against your 1000 ZAR/day budget", six times over).
    A reason that every result shares explains nothing about any of them.

    Falls back to the largest contribution when there are no peers, or when
    the candidate genuinely leads on nothing.
    """
    weighted = [e for e in breakdown if e.weight > 0]
    if not weighted:
        return f"'{candidate_name}'"

    if peers:
        # how far this candidate's contribution sits above the typical peer's
        # for the same dimension
        peer_contributions: dict[str, list[float]] = {}
        for peer in peers:
            for entry in peer:
                if entry.weight > 0:
                    peer_contributions.setdefault(entry.dimension, []).append(_contribution(entry))

        def margin(entry: EvidenceEntry) -> float:
            others = peer_contributions.get(entry.dimension)
            if not others:
                return 0.0
            return _contribution(entry) - median(others)

        standout = max(weighted, key=margin)
        best_margin = margin(standout)

        if best_margin >= MEANINGFUL_GAP:
            return f"{candidate_name}: {standout.explanation}"

        # Below the pack on everything is not the same as tied with it. Only
        # a candidate whose best margin is ~0 is genuinely inseparable; one
        # with a clearly negative margin is simply weaker, and saying
        # "nothing separates it" there would be false.
        # Tied means tied on *everything* compared, not merely level on the
        # one dimension it happens to do best on: a candidate matching the
        # others on budget while trailing them on interests is behind, not
        # inseparable.
        comparable = any(e.dimension in peer_contributions for e in weighted)
        all_square = all(abs(margin(e)) < MEANINGFUL_GAP for e in weighted)
        if comparable and all_square:
            # The live tie: interest density saturates at 1.0 for many
            # countries, so four results scored identically. Repeating the
            # budget line for each implied a reason it could not support.
            return (
                f"{candidate_name}: {standout.explanation} "
                f"Nothing in the data separates it from the others shown here."
            )

    top = max(weighted, key=_contribution)
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

    deltas = {
        dim: _contribution(by_dim_1[dim]) - _contribution(by_dim_2[dim])
        for dim in shared
        if by_dim_1[dim].weight > 0 or by_dim_2[dim].weight > 0
    }
    if not deltas:
        return None

    top_dim = max(deltas, key=lambda d: abs(deltas[d]))
    delta = deltas[top_dim]

    if abs(delta) < MEANINGFUL_GAP:
        # Returning None here used to blank the comparison line exactly when it
        # was most needed: two candidates scoring the same is a real finding,
        # and silence let the #1 and #2 badges imply a difference the numbers
        # do not support.
        return (
            f"{name_1} and {name_2} scored evenly on everything measured here, "
            f"so the order between them is arbitrary - either is a reasonable first choice."
        )

    winner, loser = (name_1, name_2) if delta > 0 else (name_2, name_1)
    return (
        f"{winner} ranked above {loser} mainly on {top_dim} "
        f"({abs(delta):.0%} more of the total score from that dimension)."
    )

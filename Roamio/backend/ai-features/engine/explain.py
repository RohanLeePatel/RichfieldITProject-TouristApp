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

        def margin(entry: EvidenceEntry) -> float | None:
            # None, not 0.0: a dimension no peer was scored on cannot show a
            # lead *or* a tie. Counting it as level made "nothing separates
            # it" fire on candidates that had simply never been compared.
            others = peer_contributions.get(entry.dimension)
            if not others:
                return None
            return _contribution(entry) - median(others)

        compared = [(e, m) for e in weighted if (m := margin(e)) is not None]

        if compared:
            standout, best_margin = max(compared, key=lambda pair: pair[1])

            if best_margin >= MEANINGFUL_GAP:
                return f"{candidate_name}: {standout.explanation}"

            # Leads on nothing. Prefixing the biggest raw contribution here is
            # what produced identical lines in the first place - the heaviest
            # dimension is the same for every candidate scored against the
            # same preferences, so three results all opened "Cost band 2/5
            # (~700 ZAR/day) against your 1000 ZAR/day budget". Worse, the
            # tie sentence then contradicted the reason it had just given.
            # Say only what is true of *this* candidate relative to the rest.
            if all(abs(m) < MEANINGFUL_GAP for _, m in compared):
                # Too close to call a lead, but "too close" is not "identical".
                # Three results sat on the same cost band while their interest
                # densities ran 81% / 80% / 78%, so budget was the one thing
                # that could say nothing about any of them - and printing the
                # biggest contribution picked exactly that, three times over.
                # The dimension this candidate differs on at all is the only
                # one carrying a figure of its own.
                nearest, off_by = max(compared, key=lambda pair: abs(pair[1]))
                if off_by:
                    return f"{candidate_name}: {nearest.explanation}"

                # Genuinely flat across every dimension compared. The live
                # tie: interest density saturates at 1.0 for many countries,
                # so several results scored identically.
                return (
                    f"Nothing in the data separates {candidate_name} from the others "
                    f"shown here - it met your requirements just as evenly."
                )

            # Level on its best dimension but behind on another: naming where
            # it gives way is both honest and specific to this candidate.
            behind, _ = min(compared, key=lambda pair: pair[1])
            return (
                f"{candidate_name} is here on overall fit rather than any single "
                f"strength - it trails the others shown here on {behind.dimension}."
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

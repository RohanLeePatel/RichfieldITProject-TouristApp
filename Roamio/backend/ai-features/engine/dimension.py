"""What every scorer function hands back - one dimension's score plus the evidence behind it."""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class DimensionScore:
    dimension: str
    value: float  # 0..1, higher is better
    weight: float  # 0..1
    evidence: dict = field(default_factory=dict)
    explanation: str = ""

    def __post_init__(self) -> None:
        if not 0.0 <= self.value <= 1.0:
            raise ValueError(f"{self.dimension} value out of range: {self.value}")
        if not 0.0 <= self.weight <= 1.0:
            raise ValueError(f"{self.dimension} weight out of range: {self.weight}")

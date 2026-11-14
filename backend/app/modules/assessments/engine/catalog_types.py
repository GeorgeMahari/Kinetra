"""Result types shared by the catalogue and the norm tables (kept apart to avoid an import cycle)."""

from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Interpretation:
    reference_id: str
    scheme: str  # "percentile_band", "category" or "percentile"
    label: str  # stable code translated in the app, e.g. "p50_75", "who_overweight", "percentile"
    detail: dict[str, Any] = field(default_factory=dict)

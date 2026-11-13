from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ImportSource = Literal["health_connect"]
ImportKind = Literal["resting_hr_bpm", "weight_kg", "steps_daily"]

# Plausibility ranges per kind (same spirit as manual entry; values outside are rejected, not clamped).
RANGES: dict[str, tuple[Decimal, Decimal]] = {
    "resting_hr_bpm": (Decimal(25), Decimal(220)),
    "weight_kg": (Decimal(20), Decimal(400)),
    "steps_daily": (Decimal(0), Decimal(150_000)),
}


class ImportItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    kind: ImportKind
    value: Decimal = Field(max_digits=7, decimal_places=2)
    measured_at: datetime
    # The source's own record id (or a stable key such as "steps:2026-11-12") for idempotent re-imports.
    external_id: str = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def _plausible(self) -> "ImportItem":
        lo, hi = RANGES[self.kind]
        if not lo <= self.value <= hi:
            raise ValueError(f"{self.kind} value {self.value} outside {lo}–{hi}")
        if self.measured_at.tzinfo is None:
            raise ValueError("measured_at needs a time zone")
        return self


class ImportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source: ImportSource
    items: list[ImportItem] = Field(max_length=1000)


class ImportResult(BaseModel):
    source: ImportSource
    received: int
    inserted: int
    updated: int
    skipped_future: int


class MeasurementOut(BaseModel):
    kind: str
    value: float
    measured_at: datetime
    source: str


class SourceSummary(BaseModel):
    source: ImportSource
    connected: bool  # has imported data
    count: int
    last_measured_at: datetime | None
    last_imported_at: datetime | None

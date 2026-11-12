import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.modules.onboarding.vocab import Dimension, IntensityCeiling


class ReferenceOut(BaseModel):
    id: str
    citation: str
    url: str
    note: str


class InterpretationOut(BaseModel):
    reference_id: str
    scheme: str
    label: str
    detail: dict[str, Any] = Field(default_factory=dict)


class IndicatorOut(BaseModel):
    code: str
    value: float | None
    unit: str
    provenance: Literal["measured", "calculated", "estimated"]
    interpretation: InterpretationOut | None
    notes: list[str]
    reference_ids: list[str]


class TestOut(BaseModel):
    __test__ = False
    code: str
    version: str
    dimension: Dimension
    intensity: IntensityCeiling
    equipment: list[str]
    allowed: bool
    locked_reason: Literal["intensity_ceiling", "screening_needed"] | None
    input_schema: dict[str, Any]


class ResultCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    test_code: str = Field(min_length=1, max_length=40)
    performed_at: datetime | None = Field(
        default=None, description="Defaults to now. Must not be in the future."
    )
    stopped_early: bool = False
    inputs: dict[str, Any]


class ResultOut(BaseModel):
    id: uuid.UUID
    test_code: str
    test_version: str
    dimension: Dimension
    protocol_key: str
    performed_at: datetime
    status: Literal["completed", "stopped_early"]
    inputs: dict[str, Any]
    indicators: list[IndicatorOut]
    headline: str
    engine_version: str
    references: list[ReferenceOut]


class DimensionOverview(BaseModel):
    dimension: Dimension
    status: Literal["assessed", "reported", "not_assessed"]
    latest: list[ResultOut]
    suggested_tests: list[str]


class Overview(BaseModel):
    intensity_ceiling: IntensityCeiling | None
    dimensions: list[DimensionOverview]

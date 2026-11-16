import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from app.modules.assessments.schemas import Overview, ResultOut
from app.shared.vocab import Dimension


class PointOut(BaseModel):
    result_id: uuid.UUID
    performed_at: datetime
    value: float


class SeriesOut(BaseModel):
    protocol_key: str
    points: list[PointOut]
    change_vs_previous: float | None
    change_vs_first: float | None


class IndicatorSeries(BaseModel):
    indicator: str
    unit: str
    provenance: Literal["measured", "calculated", "estimated"]
    series: list[SeriesOut]


class ProgressOut(BaseModel):
    test_code: str
    indicators: list[IndicatorSeries]


class StandingBasisOut(BaseModel):
    indicator: str
    reference_id: str
    label: str
    percentile: float | None = None


class StandingOut(BaseModel):
    """Where the person sits on the spoke: 0.2 = a norm's lowest band, 1 = its best (D40)."""

    level: float
    basis: list[StandingBasisOut]


class CoverageOut(BaseModel):
    dimension: Dimension
    coverage: Literal["current", "dated", "reported", "unknown"]
    latest_at: datetime | None
    standing: StandingOut | None = None


class ReferenceOut(BaseModel):
    id: str
    citation: str
    url: str


class RecommendationOut(BaseModel):
    code: str
    kind: Literal["setup", "safety", "profile", "assess", "retest", "habit", "progress", "flag"]
    priority: int
    dimension: str | None
    test_code: str | None
    params: dict[str, Any]
    reasons: list[str]
    reference: ReferenceOut | None
    general_guidance: bool


class DashboardOut(BaseModel):
    generated_at: datetime
    insights_version: str
    profile_map: list[CoverageOut]
    recommendations: list[RecommendationOut]
    recent_results: list[ResultOut]
    overview: Overview

from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.modules.onboarding.vocab import (
    ActivityLevel,
    Dimension,
    FloorRise,
    FollowUp,
    Goal,
    IntensityCeiling,
    MobilityPractice,
    ReadinessQuestion,
    ReadinessResult,
    SleepQuality,
    SportCategory,
    SportLevel,
    StairsTolerance,
    TrainingExperience,
)

Sessions = Field(ge=0, le=21)


class SportOut(BaseModel):
    code: str
    category: SportCategory


class SportPractice(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=40)
    sessions_per_week: int = Sessions
    level: SportLevel | None = None  # optional, added in migration 0010


class ActivityAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")
    activity_level: ActivityLevel
    exercise_sessions_per_week: int = Sessions
    typical_session_minutes: int | None = Field(default=None, ge=5, le=600)
    training_experience: TrainingExperience
    sports: list[SportPractice] = Field(default_factory=list, max_length=10)

    @field_validator("sports")
    @classmethod
    def _unique_sports(cls, v: list[SportPractice]) -> list[SportPractice]:
        codes = [s.code for s in v]
        if len(codes) != len(set(codes)):
            raise ValueError("Each sport can be listed once.")
        return v


class FollowUpAnswers(BaseModel):
    """Every follow-up may be skipped (null). Skipped never becomes zero."""

    model_config = ConfigDict(extra="forbid")
    strength_sessions_per_week: int | None = Field(default=None, ge=0, le=21)
    cardio_sessions_per_week: int | None = Field(default=None, ge=0, le=21)
    mobility_practice: MobilityPractice | None = None
    stairs_tolerance: StairsTolerance | None = None
    floor_rise: FloorRise | None = None
    sleep_hours: Decimal | None = Field(default=None, ge=2, le=16, decimal_places=1)
    sleep_quality: SleepQuality | None = None


class OnboardingAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")
    goals: list[Goal] = Field(min_length=1, max_length=3)
    activity: ActivityAnswers
    follow_ups: FollowUpAnswers = Field(default_factory=FollowUpAnswers)
    # Safety screening must be fully answered (true/false per question). Pregnancy may be absent
    # here; whether it is required depends on the user's profile and is checked on completion.
    readiness: dict[ReadinessQuestion, bool]

    @field_validator("goals")
    @classmethod
    def _unique_goals(cls, v: list[Goal]) -> list[Goal]:
        if len(v) != len(set(v)):
            raise ValueError("Each goal can be chosen once.")
        return v

    @model_validator(mode="after")
    def _readiness_complete(self) -> "OnboardingAnswers":
        missing = set(ReadinessQuestion) - {ReadinessQuestion.pregnancy} - set(self.readiness)
        if missing:
            raise ValueError(f"Answer every screening question: {sorted(q.value for q in missing)}")
        return self


class DraftUpdate(BaseModel):
    """Partial progress. Stored as-is (size-limited) and only fully validated on completion."""

    step: int = Field(ge=0, le=20)
    answers: dict[str, Any] = Field(default_factory=dict)

    @field_validator("answers")
    @classmethod
    def _size_limit(cls, v: dict[str, Any]) -> dict[str, Any]:
        if len(repr(v)) > 20_000:
            raise ValueError("Draft is too large.")
        allowed = {"goals", "activity", "follow_ups", "readiness"}
        unknown = set(v) - allowed
        if unknown:
            raise ValueError(f"Unknown draft sections: {sorted(unknown)}")
        return v


class OnboardingStatus(BaseModel):
    status: Literal["not_started", "in_progress", "completed"]
    step: int
    draft: dict[str, Any]
    completed_at: datetime | None


class FollowUpRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    activity: ActivityAnswers


class FollowUpQuestionOut(BaseModel):
    code: FollowUp
    reason: str


class DimensionPriorityOut(BaseModel):
    dimension: Dimension
    score: int
    reasons: list[str]


class ReadinessOut(BaseModel):
    result: ReadinessResult
    intensity_ceiling: IntensityCeiling
    reasons: list[str]
    answered_at: datetime


class OnboardingSummary(BaseModel):
    """What onboarding established. Priorities rank what is worth *measuring*, not the person."""

    completed_at: datetime | None
    goals: list[Goal]
    readiness: ReadinessOut | None
    priorities: list[DimensionPriorityOut]
    rules_version: str

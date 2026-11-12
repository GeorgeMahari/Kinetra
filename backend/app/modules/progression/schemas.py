import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CheckinIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    week: Literal["current", "previous"] = "current"
    sessions: int = Field(ge=0, le=21)
    active_minutes: int | None = Field(default=None, ge=0, le=3000)
    strength_sessions: int | None = Field(default=None, ge=0, le=21)


class CheckinOut(BaseModel):
    week_start: date
    sessions: int
    active_minutes: int | None
    strength_sessions: int | None


class ObjectiveOut(BaseModel):
    code: Literal["assess_once", "active_sessions", "strength_sessions"]
    target: int
    current: int
    met: bool


class AchievementOut(BaseModel):
    code: str
    earned_at: datetime | None


class PersonalBestOut(BaseModel):
    test_code: str
    protocol_key: str
    indicator: str
    value: float
    unit: str
    result_id: uuid.UUID
    performed_at: datetime


class ProgressionOut(BaseModel):
    version: str
    points: int
    level: int
    level_floor: int
    next_level_at: int | None
    streak_weeks: int
    week_start: date
    checkin: CheckinOut | None
    objectives: list[ObjectiveOut]
    achievements: list[AchievementOut]
    newly_earned: list[str]
    personal_bests: list[PersonalBestOut]

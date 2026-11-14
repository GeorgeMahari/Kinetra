from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

Dimension = Literal[
    "cardio", "recovery", "strength", "muscularEndurance", "mobility", "balance", "body", "lifestyle"
]


class ZoneOut(BaseModel):
    dimension: str
    zone: Literal["attention", "fine", "strength", "unknown"]
    level: float | None


class FocusOut(BaseModel):
    primary: str
    secondary: str


class TaskOut(BaseModel):
    code: str
    dimension: str
    dose: int
    unit: str
    sets: int
    points: int
    done: bool


class DayOut(BaseModel):
    day: date
    total: int
    done: int
    status: Literal["done", "partial", "missed", "today", "upcoming", "outside"]


class TargetOut(BaseModel):
    dimension: str
    test_code: str
    indicator: str
    baseline: float
    target: float
    unit: str
    direction: Literal["up", "down"]
    reference_id: str
    latest: float | None
    reached: bool


class PlanOut(BaseModel):
    id: str
    version: str
    primary: str
    secondary: str
    started_on: date
    ends_on: date
    day_index: int
    week_index: int
    weeks: int
    today: list[TaskOut]
    week: list[DayOut]
    target: TargetOut | None


class PlanViewOut(BaseModel):
    today: date
    zones: list[ZoneOut]
    suggestion: FocusOut
    plan: PlanOut | None
    streak: int
    best_streak: int
    tasks_done: int
    perfect_days: int


class TodayIn(BaseModel):
    today: date = Field(description="The user's local calendar date.")


class StartIn(TodayIn):
    primary: Dimension | None = None


class TaskIn(TodayIn):
    day: date
    task_code: str = Field(max_length=40)
    done: bool


class TaskResultOut(BaseModel):
    view: PlanViewOut
    newly_earned: list[str]
    points: int
    level: int
    day_complete: bool

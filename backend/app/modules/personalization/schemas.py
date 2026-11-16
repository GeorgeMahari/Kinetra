"""Personalisation API shapes. Additive: no existing endpoint changes meaning."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.onboarding.vocab import Goal, SportLevel
from app.modules.personalization.capacities import Capacity
from app.modules.personalization.engine import Status, Tier
from app.modules.personalization.knowledge import Evidence
from app.shared.vocab import Dimension


class SportIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    code: str = Field(min_length=1, max_length=40)
    sessions_per_week: int = Field(ge=0, le=21)
    level: SportLevel | None = None


class PriorityIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    capacity: Capacity
    weight: int = Field(ge=1, le=3)


class SportProfileIn(BaseModel):
    """The whole sport profile. `goals` are ordered: the first is the primary goal."""

    model_config = ConfigDict(extra="forbid")
    sports: list[SportIn] = Field(default_factory=list, max_length=10)
    goals: list[Goal] = Field(min_length=1, max_length=3)
    priorities: list[PriorityIn] = Field(default_factory=list, max_length=len(Capacity))

    @field_validator("sports")
    @classmethod
    def _unique_sports(cls, v: list[SportIn]) -> list[SportIn]:
        if len({s.code for s in v}) != len(v):
            raise ValueError("Each sport can be listed once.")
        return v

    @field_validator("goals")
    @classmethod
    def _unique_goals(cls, v: list[Goal]) -> list[Goal]:
        if len(set(v)) != len(v):
            raise ValueError("Each goal can be chosen once.")
        return v

    @field_validator("priorities")
    @classmethod
    def _unique_priorities(cls, v: list[PriorityIn]) -> list[PriorityIn]:
        if len({p.capacity for p in v}) != len(v):
            raise ValueError("Each capacity can be prioritised once.")
        return v


class SportOutItem(BaseModel):
    code: str
    category: str
    sessions_per_week: int
    level: SportLevel | None


class SportProfileOut(BaseModel):
    sports: list[SportOutItem]
    goals: list[Goal]  # primary first when `goals_ranked`
    goals_ranked: bool
    priorities: list[PriorityIn]


class ReasonOut(BaseModel):
    source: str  # sport | goal | priority
    code: str
    capacity: Capacity


class CapacityOut(BaseModel):
    capacity: Capacity
    dimension: Dimension
    weight: float
    reasons: list[ReasonOut]


class BatteryTestOut(BaseModel):
    test_code: str
    tier: Tier
    relevance: float
    capacities: list[Capacity]
    evidence: Evidence
    retest_weeks: int
    status: Status
    allowed: bool
    why: list[ReasonOut]


class BatteryOut(BaseModel):
    version: str
    capacities: list[CapacityOut]  # only capacities with weight > 0, heaviest first
    tests: list[BatteryTestOut]

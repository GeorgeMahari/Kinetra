"""Loading plans and completions, and the plan stats the progression module needs.

Kept apart from `service` so progression can read plan stats without an import cycle.
"""

from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.assessments.models import TestResult
from app.modules.onboarding.vocab import IntensityCeiling
from app.modules.plans import rules
from app.modules.plans.models import ImprovementPlan, PlanTaskCompletion
from app.modules.users.models import User


def params_to_json(p: rules.PlanParams) -> dict[str, Any]:
    return {"primary": p.primary, "secondary": p.secondary, "ceiling": p.ceiling.value, "base": dict(p.base)}


def params_from_json(d: dict[str, Any]) -> rules.PlanParams:
    return rules.PlanParams(d["primary"], d["secondary"], IntensityCeiling(d["ceiling"]), d["base"])


def plans(db: Session, user: User) -> list[ImprovementPlan]:
    return list(
        db.scalars(
            select(ImprovementPlan)
            .where(ImprovementPlan.user_id == user.id)
            .order_by(ImprovementPlan.started_on)
        ).all()
    )


def spans(rows: list[ImprovementPlan]) -> list[rules.PlanSpan]:
    return [rules.PlanSpan(params_from_json(r.params), r.started_on, r.ended_on) for r in rows]


def completions(db: Session, user: User) -> set[tuple[date, str]]:
    return {
        (d, c)
        for d, c in db.execute(
            select(PlanTaskCompletion.day, PlanTaskCompletion.task_code).where(
                PlanTaskCompletion.user_id == user.id
            )
        ).all()
    }


def target_reached(db: Session, user: User, rows: list[ImprovementPlan]) -> bool:
    """Any plan's target met by a completed result recorded on or after the plan's start."""
    for r in rows:
        t = r.target
        if not t:
            continue
        results = db.scalars(
            select(TestResult).where(
                TestResult.user_id == user.id,
                TestResult.test_code == t["test_code"],
                TestResult.status == "completed",
            )
        ).all()
        for res in results:
            if res.performed_at.date() < r.started_on:
                continue
            value = next((i["value"] for i in res.indicators if i["code"] == t["indicator"]), None)
            if value is None:
                continue
            if (t["direction"] == "up" and value >= t["target"]) or (
                t["direction"] == "down" and value <= t["target"]
            ):
                return True
    return False


def plan_stats(db: Session, user: User, today: date) -> tuple[rules.PlanStats, bool]:
    rows = plans(db, user)
    return rules.stats(spans(rows), completions(db, user), today), target_reached(db, user, rows)

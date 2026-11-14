"""Improvement plans: the Plan page's data, starting a plan, and ticking tasks (D42)."""

from dataclasses import asdict
from datetime import UTC, date, datetime, timedelta

from fastapi import status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.modules.assessments import service as assessments_service
from app.modules.assessments.models import Measurement
from app.modules.assessments.schemas import Overview
from app.modules.insights import service as insights_service
from app.modules.onboarding import service as onboarding_service
from app.modules.plans import queries, rules, targets
from app.modules.plans.models import ImprovementPlan, PlanTaskCompletion
from app.modules.plans.schemas import (
    DayOut,
    FocusOut,
    PlanOut,
    PlanViewOut,
    StartIn,
    TargetOut,
    TaskIn,
    TaskOut,
    TaskResultOut,
    ZoneOut,
)
from app.modules.progression import service as progression_service
from app.modules.users.models import User
from app.shared.age import age_on

# The client's local date may differ from the server's UTC date by up to a day either way.
MAX_CLOCK_SKEW = timedelta(days=1)


def _check_today(today: date) -> None:
    if abs(today - datetime.now(UTC).date()) > MAX_CLOCK_SKEW:
        raise AppError(
            "validation_error",
            "The device date is too far from the current date.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "today", "type": "out_of_range"}],
        )


def _age(user: User, on: date) -> int | None:
    dob = user.profile.date_of_birth if user.profile else None
    return age_on(dob, on) if dob else None


def _levels(db: Session, user: User, ov: Overview) -> dict[str, float | None]:
    return {d: (s.level if s else None) for d, s in insights_service.standings(db, user, ov).items()}


def _latest_values(ov: Overview) -> dict[tuple[str, str], tuple[float, dict[str, object]]]:
    """(test, indicator) -> (value, the result's inputs), from the latest completed result of each test."""
    out: dict[tuple[str, str], tuple[float, dict[str, object]]] = {}
    for d in ov.dimensions:
        for r in d.latest:
            if r.status != "completed":
                continue
            for i in r.indicators:
                if i.value is not None:
                    out[(r.test_code, i.code)] = (i.value, r.inputs)
    return out


def _target_for(db: Session, user: User, dimension: str, ov: Overview, today: date) -> targets.Target | None:
    v = _latest_values(ov)
    age = _age(user, today)
    p = user.profile
    sex = p.sex_for_norms.value if p else "not_specified"
    height = float(p.height_cm) if p and p.height_cm is not None else None
    weight = db.scalar(
        select(Measurement.value)
        .where(Measurement.user_id == user.id, Measurement.kind == "weight_kg")
        .order_by(Measurement.measured_at.desc())
        .limit(1)
    )

    def get(test: str, ind: str) -> float | None:
        return v[(test, ind)][0] if (test, ind) in v else None

    candidates: list[targets.Target | None] = []
    if dimension == "cardio":
        if (d := get("cooper_12min", "distance_12min")) is not None:
            candidates.append(targets.cardio_from_cooper(d, age, sex))
        if (hr := get("resting_hr", "resting_hr")) is not None:
            candidates.append(targets.resting_hr(hr, age, sex))
    elif dimension == "recovery" and (b := get("hrr_step", "recovery_beats_1min")) is not None:
        candidates.append(targets.recovery(b, age, sex))
    elif dimension == "strength":
        if (c := get("chair_stand_30s", "chair_stand_reps")) is not None:
            candidates.append(targets.chair_stand(c, age, sex, float(weight) if weight is not None else None))
        if (pl := get("plank", "plank_seconds")) is not None:
            candidates.append(targets.plank(pl, age, sex))
    elif dimension == "muscularEndurance" and ("pushups", "pushup_reps") in v:
        reps, inputs = v[("pushups", "pushup_reps")]
        candidates.append(targets.pushups(reps, str(inputs.get("variant")), age, sex))
    elif dimension == "mobility" and (s := get("sit_reach", "sit_reach_cm")) is not None:
        candidates.append(targets.sit_reach(s, age, sex))
    elif dimension == "balance":
        best = get("single_leg_stance", "stance_best_s")
        if best is None and (left := get("single_leg_stance", "stance_left_s")) is not None:
            best = max(left, get("single_leg_stance", "stance_right_s") or 0)
        if best is not None:
            candidates.append(targets.stance(best, age))
    elif dimension == "body" and (w := get("body_measurements", "whtr")) is not None:
        waist = get("body_measurements", "waist")
        if waist is not None:
            candidates.append(targets.waist(w, height, waist))
    return next((t for t in candidates if t is not None), None)


def _active(db: Session, user: User, today: date) -> ImprovementPlan | None:
    row = db.scalar(
        select(ImprovementPlan).where(ImprovementPlan.user_id == user.id, ImprovementPlan.status == "active")
    )
    if row is not None:
        last = row.started_on + timedelta(days=rules.PLAN_WEEKS * 7 - 1)
        if today > last:  # the plan ran its course
            row.status = "completed"
            row.ended_on = last
            db.flush()
            return None
    return row


def _target_out(db: Session, user: User, row: ImprovementPlan, ov: Overview) -> TargetOut | None:
    t = row.target
    if not t:
        return None
    latest = _latest_values(ov).get((t["test_code"], t["indicator"]))
    value = latest[0] if latest else None
    reached = queries.target_reached(db, user, [row])
    return TargetOut(
        dimension=t["dimension"],
        test_code=t["test_code"],
        indicator=t["indicator"],
        baseline=t["current"],
        target=t["target"],
        unit=t["unit"],
        direction=t["direction"],
        reference_id=t["reference_id"],
        latest=value,
        reached=reached,
    )


def view(db: Session, user: User, today: date) -> PlanViewOut:
    _check_today(today)
    ov = assessments_service.overview(db, user)
    levels = _levels(db, user, ov)
    primary, secondary = rules.choose_focus(levels)
    row = _active(db, user, today)
    rows = queries.plans(db, user)
    spans = queries.spans(rows)
    done = queries.completions(db, user)
    st = rules.stats(spans, done, today)

    plan: PlanOut | None = None
    if row is not None:
        p = queries.params_from_json(row.params)
        index = (today - row.started_on).days
        monday = today - timedelta(days=today.weekday())
        week: list[DayOut] = []
        for i in range(7):
            d = monday + timedelta(days=i)
            tasks = rules.day_tasks(p, row.started_on, d)
            n = sum(1 for t in tasks if (d, t.code) in done)
            if not tasks:
                s = "outside"
            elif tasks and n == len(tasks):
                s = "done"
            elif d == today:
                s = "today"
            elif d > today:
                s = "upcoming"
            else:
                s = "partial" if n else "missed"
            week.append(DayOut(day=d, total=len(tasks), done=n, status=s))
        plan = PlanOut(
            id=str(row.id),
            version=row.version,
            primary=p.primary,
            secondary=p.secondary,
            started_on=row.started_on,
            ends_on=row.started_on + timedelta(days=rules.PLAN_WEEKS * 7 - 1),
            day_index=index,
            week_index=index // 7,
            weeks=rules.PLAN_WEEKS,
            today=[
                TaskOut(
                    code=t.code,
                    dimension=t.dimension,
                    dose=t.dose,
                    unit=t.unit,
                    sets=t.sets,
                    points=t.points,
                    done=(today, t.code) in done,
                )
                for t in rules.day_tasks(p, row.started_on, today)
            ],
            week=week,
            target=_target_out(db, user, row, ov),
        )
    return PlanViewOut(
        today=today,
        zones=[ZoneOut(dimension=d, zone=rules.zone(lv), level=lv) for d, lv in levels.items()],
        suggestion=FocusOut(primary=primary, secondary=secondary),
        plan=plan,
        streak=rules.streak(spans, done, today),
        best_streak=st.longest_streak,
        tasks_done=st.tasks_done,
        perfect_days=st.perfect_days,
    )


def start(db: Session, user: User, body: StartIn) -> PlanViewOut:
    _check_today(body.today)
    if _active(db, user, body.today) is not None:
        raise AppError("plan_active", "A plan is already running.", status.HTTP_409_CONFLICT)
    ov = assessments_service.overview(db, user)
    levels = _levels(db, user, ov)
    primary, secondary = rules.choose_focus(levels)
    if body.primary and body.primary != primary:
        primary, secondary = body.primary, rules.secondary_for(body.primary, levels)
    ceiling = onboarding_service.latest_intensity_ceiling(db, user)
    age = _age(user, body.today)
    params = rules.make_params(primary, secondary, levels, ceiling, adult=age is not None and age >= 18)
    target = _target_for(db, user, primary, ov, body.today) or _target_for(
        db, user, secondary, ov, body.today
    )
    db.add(
        ImprovementPlan(
            user_id=user.id,
            version=rules.PLAN_VERSION,
            status="active",
            started_on=body.today,
            params=queries.params_to_json(params),
            target=asdict(target) if target else None,
        )
    )
    db.flush()
    return view(db, user, body.today)


def abandon(db: Session, user: User, today: date) -> PlanViewOut:
    _check_today(today)
    row = _active(db, user, today)
    if row is None:
        raise AppError("no_plan", "No plan is running.", status.HTTP_404_NOT_FOUND)
    row.status = "abandoned"
    row.ended_on = today
    db.flush()
    return view(db, user, today)


def set_task(db: Session, user: User, body: TaskIn) -> TaskResultOut:
    _check_today(body.today)
    if not timedelta(0) <= body.today - body.day <= timedelta(days=1):
        raise AppError(
            "validation_error",
            "Only today's and yesterday's tasks can be ticked.",
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            [{"field": "day", "type": "out_of_range"}],
        )
    row = _active(db, user, body.today)
    if row is None:
        raise AppError("no_plan", "No plan is running.", status.HTTP_404_NOT_FOUND)
    p = queries.params_from_json(row.params)
    planned = {t.code for t in rules.day_tasks(p, row.started_on, body.day)}
    if body.task_code not in planned:
        raise AppError("not_found", "That task is not planned for that day.", status.HTTP_404_NOT_FOUND)
    existing = db.scalar(
        select(PlanTaskCompletion).where(
            PlanTaskCompletion.plan_id == row.id,
            PlanTaskCompletion.day == body.day,
            PlanTaskCompletion.task_code == body.task_code,
        )
    )
    if body.done and existing is None:
        db.add(PlanTaskCompletion(user_id=user.id, plan_id=row.id, day=body.day, task_code=body.task_code))
    elif not body.done and existing is not None:
        db.execute(delete(PlanTaskCompletion).where(PlanTaskCompletion.id == existing.id))
    db.flush()
    prog = progression_service.progression(db, user)
    done = queries.completions(db, user)
    return TaskResultOut(
        view=view(db, user, body.today),
        newly_earned=prog.newly_earned,
        points=prog.points,
        level=prog.level,
        day_complete=all((body.day, c) in done for c in planned),
    )

"""Differential replay: the same requests against two API implementations, full responses compared.

    cd backend
    .venv\\Scripts\\python ..\\tools\\differential\\api_diff.py http://127.0.0.1:8020 http://127.0.0.1:8030

Both servers run with KINETRA_ENVIRONMENT=test and KINETRA_CLIENT_IP_HEADER=X-Test-Client-IP. Each
scenario registers its own accounts (unique emails per run), so both can share a database. Values
that legitimately differ (ids, tokens, timestamps, emails of this run) are replaced by stable
placeholders in order of first appearance; everything else, status codes and headers that matter
included, must be identical.
"""

import json
import re
import sys
import uuid
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))
from tests.http_client import HttpClient, HttpResponse  # noqa: E402

V = "/api/v1"
PASSWORD = "blue tram over the river"  # noqa: S105 (throwaway test accounts)
UUID_RE = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
TS_RE = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?")
HEADERS = ("content-type", "cache-control", "x-content-type-options", "content-security-policy", "allow")


class Recorder:
    def __init__(self, base: str, tag: str) -> None:
        self.http = HttpClient(base)
        self.tag = tag
        self.log: list[dict[str, Any]] = []

    def email(self, name: str) -> str:
        return f"{name}-{self.tag}@example.com"

    def call(self, method: str, path: str, **kw: Any) -> HttpResponse:
        resp = self.http.request(method, V + path, **kw)
        try:
            body: Any = resp.json() if resp.content else None
        except ValueError:
            body = resp.text
        self.log.append(
            {
                "req": f"{method} {path}",
                "status": resp.status_code,
                "headers": {h: resp.headers.get(h) for h in HEADERS if resp.headers.get(h) is not None},
                "body": body,
            }
        )
        return resp


def numbers_by_value(x: Any) -> Any:
    """JSON numbers compare by value: Python writes 175.0 where JavaScript writes 175."""
    if isinstance(x, float) and x.is_integer():
        return int(x)
    if isinstance(x, list):
        return [numbers_by_value(v) for v in x]
    if isinstance(x, dict):
        return {k: numbers_by_value(v) for k, v in x.items()}
    return x


def normalise(entries: list[dict[str, Any]], tag: str) -> str:
    entries = numbers_by_value(entries)
    text = json.dumps(entries, ensure_ascii=False, sort_keys=True, indent=1).replace(tag, "<run>")
    seen: dict[str, str] = {}

    def stable(prefix: str) -> Callable[[re.Match[str]], str]:
        def sub(m: re.Match[str]) -> str:
            return seen.setdefault(m.group(0), f"<{prefix}{len(seen)}>")

        return sub

    text = UUID_RE.sub(stable("id"), text)
    text = TS_RE.sub("<ts>", text)
    text = re.sub(r"parental/[\w-]{20,}", "parental/<token>", text)
    # JWTs and refresh tokens
    text = re.sub(r"eyJ[\w-]+\.[\w-]+\.[\w-]+", "<jwt>", text)
    text = re.sub(r'"refresh_token": "[\w-]{40,}"', '"refresh_token": "<refresh>"', text)
    return text


def adult(years: int = 30) -> str:
    return date(date.today().year - years, 1, 15).isoformat()


# ---------------------------------------------------------------- scenarios


def scenario_auth(r: Recorder) -> None:
    ana = r.email("ana")
    r.call(
        "POST",
        "/auth/register",
        json={"email": ana, "password": "short", "date_of_birth": adult(), "privacy_consent": True},
    )
    r.call(
        "POST",
        "/auth/register",
        json={
            "email": "not-an-email",
            "password": PASSWORD,
            "date_of_birth": "2026-13-01",
            "privacy_consent": False,
            "preferred_locale": "fr",
        },
    )
    r.call("POST", "/auth/register", json=["not", "an", "object"])
    r.call("POST", "/auth/register", content="{not json", headers={"Content-Type": "application/json"})
    r.call(
        "POST",
        "/auth/register",
        json={"email": ana, "password": PASSWORD, "date_of_birth": "2099-01-01", "privacy_consent": True},
    )
    r.call(
        "POST",
        "/auth/register",
        json={"email": ana, "password": PASSWORD, "date_of_birth": adult(10), "privacy_consent": True},
    )
    r.call(
        "POST",
        "/auth/register",
        json={"email": ana, "password": PASSWORD, "date_of_birth": adult(15), "privacy_consent": True},
    )
    r.call(
        "POST",
        "/auth/register",
        json={
            "email": ana,
            "password": ana.split("@")[0] + "-2026",
            "date_of_birth": adult(),
            "privacy_consent": True,
        },
    )
    reg = r.call(
        "POST",
        "/auth/register",
        json={
            "email": ana.upper(),
            "password": PASSWORD,
            "date_of_birth": adult(),
            "privacy_consent": True,
            "preferred_locale": "ro",
        },
    ).json()
    r.call(
        "POST",
        "/auth/register",
        json={"email": ana, "password": PASSWORD, "date_of_birth": adult(), "privacy_consent": True},
    )
    h = {"Authorization": f"Bearer {reg['access_token']}"}
    r.call("GET", "/me", headers=h)
    r.call("GET", "/me")
    r.call("GET", "/me", headers={"Authorization": "Bearer nope"})
    r.call("GET", "/me", headers={"Authorization": "Basic abc"})
    r.call("PATCH", "/me", headers=h, json={"preferred_locale": "ru"})
    r.call("PATCH", "/me", headers=h, json={"preferred_locale": "xx"})
    r.call(
        "PATCH",
        "/me/profile",
        headers=h,
        json={"display_name": "  Ana  ", "height_cm": 176.5, "sex_for_norms": "female"},
    )
    r.call(
        "PATCH",
        "/me/profile",
        headers=h,
        json={"height_cm": 300, "sex_for_norms": "other", "display_name": "x" * 81},
    )
    r.call("PATCH", "/me/profile", headers=h, json={"height_cm": 170.25})
    r.call("PATCH", "/me/profile", headers=h, json={"display_name": "   ", "height_cm": None, "unknown": 1})
    r.call("POST", "/auth/login", json={"email": ana, "password": "wrong password!"})
    login = r.call("POST", "/auth/login", json={"email": f"  {ana.upper()} ", "password": PASSWORD}).json()
    r.call("POST", "/auth/login", json={"email": r.email("nobody"), "password": PASSWORD})
    r.call("POST", "/auth/refresh", json={"refresh_token": "short"})
    new = r.call("POST", "/auth/refresh", json={"refresh_token": login["refresh_token"]}).json()
    r.call("POST", "/auth/refresh", json={"refresh_token": login["refresh_token"]})
    r.call("POST", "/auth/refresh", json={"refresh_token": new["refresh_token"]})
    r.call("POST", "/auth/logout", json={"refresh_token": reg["refresh_token"]})
    r.call("POST", "/auth/logout", json={"refresh_token": "x" * 43})
    r.call("POST", "/auth/email/verify/confirm", headers=h, json={"code": "12345"})
    r.call("POST", "/auth/email/verify/confirm", headers=h, json={"code": "000000"})
    r.call("POST", "/auth/email/verify/request", headers=h)
    r.call("POST", "/auth/password/forgot", json={"email": r.email("nobody")})
    r.call("POST", "/auth/password/forgot", json={"email": ana})
    r.call("POST", "/auth/password/reset", json={"email": ana, "code": "000000", "new_password": "x"})
    r.call(
        "POST",
        "/auth/password/reset",
        json={"email": ana, "code": "000000", "new_password": "a brand new phrase"},
    )
    r.call("POST", "/me/delete", headers=h, json={"password": "wrong"})
    r.call("GET", "/nope")
    r.call("DELETE", "/me", headers=h)
    r.call("POST", "/me/delete", headers=h, json={"password": PASSWORD})
    r.call("GET", "/me", headers=h)


def scenario_minor(r: Recorder) -> None:
    kid = r.email("kid")
    r.call(
        "POST",
        "/auth/register",
        json={
            "email": kid,
            "password": PASSWORD,
            "date_of_birth": adult(15),
            "privacy_consent": True,
            "parent_email": kid,
        },
    )
    reg = r.call(
        "POST",
        "/auth/register",
        json={
            "email": kid,
            "password": PASSWORD,
            "date_of_birth": adult(15),
            "privacy_consent": True,
            "parent_email": r.email("parent"),
            "preferred_locale": "ro",
        },
    ).json()
    h = {"Authorization": f"Bearer {reg['access_token']}"}
    r.call("GET", "/me", headers=h)
    r.call("PATCH", "/me/profile", headers=h, json={"display_name": "Kid"})
    r.call("POST", "/auth/email/verify/request", headers=h)


def signed_up(r: Recorder, name: str, years: int = 30, sex: str | None = None) -> dict[str, str]:
    reg = r.call(
        "POST",
        "/auth/register",
        json={
            "email": r.email(name),
            "password": PASSWORD,
            "date_of_birth": adult(years),
            "privacy_consent": True,
        },
    ).json()
    h = {"Authorization": f"Bearer {reg['access_token']}"}
    if sex:
        r.call("PATCH", "/me/profile", headers=h, json={"sex_for_norms": sex, "height_cm": 175})
    return h


NO = {
    "heart_condition": False,
    "chest_pain": False,
    "dizziness_or_fainting": False,
    "chronic_condition": False,
    "musculoskeletal": False,
    "supervised_only": False,
}


def answers(**over: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "goals": ["improve_endurance", "get_stronger"],
        "activity": {
            "activity_level": "active",
            "exercise_sessions_per_week": 4,
            "typical_session_minutes": 60,
            "training_experience": "one_to_three_years",
            "sports": [{"code": "cycling", "sessions_per_week": 3, "level": "intermediate"}],
        },
        "follow_ups": {
            "strength_sessions_per_week": 0,
            "mobility_practice": "occasional",
            "sleep_hours": 7.5,
        },
        "readiness": {**NO, "pregnancy": False},
    }
    base.update(over)
    return base


def scenario_onboarding(r: Recorder) -> None:
    r.call("GET", "/catalog/sports")
    h = signed_up(r, "onb")
    r.call("GET", "/onboarding", headers=h)
    r.call("GET", "/onboarding/summary", headers=h)
    r.call(
        "PUT",
        "/onboarding/draft",
        headers=h,
        json={"step": 2, "answers": {"goals": ["get_stronger"], "zzz": 1}},
    )
    r.call("PUT", "/onboarding/draft", headers=h, json={"step": 99, "answers": []})
    r.call("PUT", "/onboarding/draft", headers=h, json={"step": 2, "answers": {"goals": ["x" * 25000]}})
    r.call(
        "PUT",
        "/onboarding/draft",
        headers=h,
        json={"step": 3, "answers": {"goals": ["get_stronger"], "activity": {"a": [1, 2.5, None, True]}}},
    )
    r.call("GET", "/onboarding", headers=h)
    r.call("POST", "/onboarding/follow-up-questions", headers=h, json={"activity": answers()["activity"]})
    sed = {"activity_level": "sedentary", "exercise_sessions_per_week": 0, "training_experience": "none"}
    r.call("POST", "/onboarding/follow-up-questions", headers=h, json={"activity": sed})
    r.call(
        "POST",
        "/onboarding/follow-up-questions",
        headers=h,
        json={"activity": {**sed, "sports": [{"code": "nope", "sessions_per_week": 1}]}},
    )
    bad = answers(goals=["get_stronger", "get_stronger", "x"], readiness={"bad": True, "chest_pain": "maybe"})
    bad["activity"]["sports"] = [
        {"code": "cycling", "sessions_per_week": 1},
        {"code": "cycling", "sessions_per_week": 30},
    ]
    bad["follow_ups"] = {"sleep_hours": 7.55, "mobility_practice": "daily", "extra": 1}
    r.call("POST", "/onboarding/complete", headers=h, json=bad)
    r.call("POST", "/onboarding/complete", headers=h, json=answers(goals=[], readiness={"chest_pain": False}))
    r.call("POST", "/onboarding/complete", headers=h, json=answers(readiness=dict(NO)))
    r.call("POST", "/onboarding/complete", headers=h, json=answers())
    r.call("GET", "/onboarding/summary", headers=h)
    r.call("GET", "/onboarding", headers=h)
    r.call(
        "POST",
        "/onboarding/complete",
        headers=h,
        json=answers(
            goals=["sport_performance", "know_baseline"],
            readiness={**NO, "pregnancy": False, "musculoskeletal": True},
        ),
    )
    r.call("GET", "/onboarding/summary", headers=h)
    m = signed_up(r, "male", sex="male")
    r.call("POST", "/onboarding/complete", headers=m, json=answers(readiness={**NO, "chest_pain": True}))
    r.call("GET", "/onboarding/summary", headers=m)
    teen = signed_up(r, "teen", years=17)
    r.call("POST", "/onboarding/complete", headers=teen, json=answers())
    old = signed_up(r, "old", years=70)
    r.call("POST", "/onboarding/follow-up-questions", headers=old, json={"activity": answers()["activity"]})


RESULTS = [
    ("resting_hr", {"bpm": 62, "method": "manual_pulse"}),
    (
        "hrr_step",
        {
            "recovery_mode": "passive_seated",
            "hr_end": 150,
            "hr_60": 120,
            "hr_120": 100,
            "beats_first_minute": 98,
        },
    ),
    ("hrr_step", {"recovery_mode": "passive_seated", "hr_end": 100, "hr_60": 120}),
    ("cooper_12min", {"distance_m": 2650, "mode": "run"}),
    ("pushups", {"variant": "toes", "reps": 28}),
    ("pulls", {"variant": "pullup", "reps": 7}),
    ("chair_stand_30s", {"reps": 17}),
    ("plank", {"seconds": 95}),
    ("sit_reach", {"reach_cm": 4.5}),
    ("single_leg_stance", {"left_s": 38, "right_s": 60}),
    ("body_measurements", {"weight_kg": 72.4, "waist_cm": 84.5}),
    ("broad_jump", {"attempt_1_cm": 210, "attempt_2_cm": 221}),
    ("vertical_jump", {"standing_reach_cm": 230, "jump_reach_cm": 281}),
    ("agility_505", {"left_s": 2.41, "right_s": 2.58, "start": "standing", "timing": "stopwatch"}),
    ("sprint_20m", {"time_s": 3.21, "timing": "video_app"}),
    ("ruler_drop", {"drops_cm": [12.5, 18, 61, 20.5, 15]}),
    ("back_scratch", {"right_over_cm": 3.5, "left_over_cm": -2}),
    ("anterior_reach", {"left_cm": 70.5, "right_cm": 65, "leg_length_cm": 92}),
    ("single_leg_hop", {"left_cm": 150, "right_cm": 128}),
    ("circumferences", {"arm_left_cm": 32.1, "arm_right_cm": 33, "chest_cm": 101.5}),
    ("swim_12min", {"distance_m": 520, "stroke": "freestyle"}),
    ("plank", {"seconds": -1, "extra": 1}),
    ("ruler_drop", {"drops_cm": [1, 2, 3]}),
    ("nope", {"x": 1}),
]


def scenario_assessments(r: Recorder) -> None:
    h = signed_up(r, "assess", sex="male")
    r.call("GET", "/assessments/tests", headers=h)
    r.call(
        "POST",
        "/assessments/results",
        headers=h,
        json={"test_code": "cooper_12min", "inputs": {"distance_m": 2400, "mode": "run"}},
    )
    r.call("POST", "/assessments/results", headers=h, json={"test_code": "plank", "inputs": {"seconds": 60}})
    r.call("POST", "/onboarding/complete", headers=h, json=answers(readiness=dict(NO)))
    r.call("GET", "/assessments/tests", headers=h)
    r.call("GET", "/assessments/overview", headers=h)
    ids = []
    for code, inputs in RESULTS:
        resp = r.call("POST", "/assessments/results", headers=h, json={"test_code": code, "inputs": inputs})
        if resp.status_code == 201:
            ids.append(resp.json()["id"])
    r.call(
        "POST",
        "/assessments/results",
        headers=h,
        json={
            "test_code": "plank",
            "inputs": {"seconds": 70},
            "stopped_early": True,
            "performed_at": "2026-01-02T10:00:00+02:00",
        },
    )
    r.call(
        "POST",
        "/assessments/results",
        headers=h,
        json={"test_code": "plank", "inputs": {"seconds": 70}, "performed_at": "2026-01-02T10:00:00"},
    )
    r.call(
        "POST",
        "/assessments/results",
        headers=h,
        json={"test_code": "plank", "inputs": {"seconds": 70}, "performed_at": "2099-01-02T10:00:00Z"},
    )
    r.call(
        "POST",
        "/assessments/results",
        headers=h,
        json={"test_code": "plank", "inputs": {"seconds": 70}, "performed_at": "2001-01-02T10:00:00Z"},
    )
    r.call("POST", "/assessments/results", headers=h, json={"test_code": "", "inputs": [], "other": 1})
    r.call("GET", "/assessments/results", headers=h)
    r.call("GET", "/assessments/results", headers=h, params={"test_code": "plank", "limit": 2})
    r.call("GET", "/assessments/results", headers=h, params={"limit": 0})
    r.call(
        "GET",
        "/assessments/activity",
        headers=h,
        params={"since": "2025-12-01T00:00:00Z", "until": "2027-01-01T00:00:00+02:00"},
    )
    r.call(
        "GET",
        "/assessments/activity",
        headers=h,
        params={"since": "2020-01-01T00:00:00Z", "until": "2027-01-01T00:00:00Z"},
    )
    r.call("GET", "/assessments/activity", headers=h, params={"since": "2026-01-01T00:00:00"})
    r.call("GET", "/assessments/overview", headers=h)
    r.call("GET", f"/assessments/results/{ids[0]}", headers=h)
    r.call("GET", "/assessments/results/not-a-uuid", headers=h)
    other = signed_up(r, "other")
    r.call("GET", f"/assessments/results/{ids[0]}", headers=other)
    r.call("DELETE", f"/assessments/results/{ids[0]}", headers=other)
    r.call("DELETE", f"/assessments/results/{ids[0]}", headers=h)
    r.call("GET", f"/assessments/results/{ids[0]}", headers=h)
    teen = signed_up(r, "teen17", years=17)
    r.call("POST", "/onboarding/complete", headers=teen, json=answers())
    r.call(
        "POST",
        "/assessments/results",
        headers=teen,
        json={"test_code": "cooper_12min", "inputs": {"distance_m": 2400, "mode": "run"}},
    )
    r.call("GET", "/assessments/tests", headers=teen)


def scenario_personalization(r: Recorder) -> None:
    h = signed_up(r, "pers", sex="female")
    r.call("GET", "/personalization/profile", headers=h)
    r.call("GET", "/personalization/battery", headers=h)
    r.call("PUT", "/personalization/profile", headers=h, json={"goals": ["get_stronger"]})
    r.call("POST", "/onboarding/complete", headers=h, json=answers())
    r.call("GET", "/personalization/profile", headers=h)
    r.call("GET", "/personalization/battery", headers=h)
    r.call(
        "PUT",
        "/personalization/profile",
        headers=h,
        json={
            "sports": [
                {"code": "tennis", "sessions_per_week": 3, "level": "advanced"},
                {"code": "running", "sessions_per_week": 5},
            ],
            "goals": ["sport_performance", "power_speed", "build_muscle"],
            "priorities": [{"capacity": "agility", "weight": 3}, {"capacity": "mobility", "weight": 1}],
        },
    )
    r.call("GET", "/personalization/battery", headers=h)
    r.call(
        "PUT",
        "/personalization/profile",
        headers=h,
        json={"sports": [{"code": "nope", "sessions_per_week": 1}], "goals": ["get_stronger"]},
    )
    r.call(
        "PUT",
        "/personalization/profile",
        headers=h,
        json={
            "sports": [
                {"code": "tennis", "sessions_per_week": 1},
                {"code": "tennis", "sessions_per_week": 2},
            ],
            "goals": [],
            "priorities": [{"capacity": "agility", "weight": 5}, {"capacity": "x", "weight": 1}],
            "extra": True,
        },
    )
    r.call("POST", "/assessments/results", headers=h, json={"test_code": "plank", "inputs": {"seconds": 80}})
    r.call(
        "PUT",
        "/personalization/profile",
        headers=h,
        json={"sports": [{"code": "swimming", "sessions_per_week": 4}], "goals": ["improve_endurance"]},
    )
    r.call("GET", "/personalization/battery", headers=h)
    r.call("GET", "/onboarding/summary", headers=h)


def scenario_insights(r: Recorder) -> None:
    h = signed_up(r, "ins", sex="male")
    r.call("GET", "/dashboard", headers=h)
    r.call(
        "POST",
        "/onboarding/complete",
        headers=h,
        json=answers(follow_ups={"strength_sessions_per_week": 1, "sleep_hours": 6}),
    )
    r.call(
        "PUT",
        "/personalization/profile",
        headers=h,
        json={
            "sports": [{"code": "cycling", "sessions_per_week": 4}],
            "goals": ["improve_endurance", "get_stronger"],
        },
    )
    r.call("GET", "/dashboard", headers=h)
    for _d, (when, dist) in enumerate(
        (("2026-06-01T08:00:00Z", 2900), ("2026-08-01T08:00:00Z", 2700), ("2026-10-01T08:00:00+03:00", 2300))
    ):
        r.call(
            "POST",
            "/assessments/results",
            headers=h,
            json={
                "test_code": "cooper_12min",
                "inputs": {"distance_m": dist, "mode": "run"},
                "performed_at": when,
            },
        )
    r.call(
        "POST",
        "/assessments/results",
        headers=h,
        json={"test_code": "cooper_12min", "inputs": {"distance_m": 2500, "mode": "walk_run"}},
    )
    r.call(
        "POST",
        "/assessments/results",
        headers=h,
        json={"test_code": "pushups", "inputs": {"variant": "toes", "reps": 9}},
    )
    r.call(
        "POST",
        "/assessments/results",
        headers=h,
        json={"test_code": "body_measurements", "inputs": {"weight_kg": 91, "waist_cm": 104}},
    )
    r.call(
        "POST",
        "/assessments/results",
        headers=h,
        json={"test_code": "anterior_reach", "inputs": {"left_cm": 70, "right_cm": 60}},
    )
    r.call(
        "POST",
        "/assessments/results",
        headers=h,
        json={"test_code": "plank", "inputs": {"seconds": 40}, "performed_at": "2026-05-01T10:00:00Z"},
    )
    r.call("GET", "/dashboard", headers=h)
    r.call("GET", "/progress", headers=h, params={"test_code": "cooper_12min"})
    r.call("GET", "/progress", headers=h, params={"test_code": "plank"})
    r.call("GET", "/progress", headers=h, params={"test_code": "nope"})
    r.call("GET", "/progress", headers=h)
    items = [
        {"kind": "weight_kg", "value": 90.5, "measured_at": "2026-11-10T07:00:00Z", "external_id": "w1"},
        {
            "kind": "steps_daily",
            "value": 8000,
            "measured_at": "2026-11-10T23:00:00+02:00",
            "external_id": "steps:2026-11-10",
        },
        {
            "kind": "steps_daily",
            "value": 9000,
            "measured_at": "2026-11-10T23:00:00+02:00",
            "external_id": "steps:2026-11-10",
        },
        {
            "kind": "resting_hr_bpm",
            "value": 58,
            "measured_at": "2099-01-01T00:00:00Z",
            "external_id": "hr-future",
        },
    ]
    r.call("POST", "/measurements/import", headers=h, json={"source": "health_connect", "items": items})
    r.call("POST", "/measurements/import", headers=h, json={"source": "health_connect", "items": items[:1]})
    bad = [
        {"kind": "weight_kg", "value": 500.25, "measured_at": "2026-11-10T07:00:00", "external_id": ""},
        {"kind": "x", "value": "1.234", "measured_at": "2026-11-10T07:00:00"},
    ]
    r.call("POST", "/measurements/import", headers=h, json={"source": "fitbit", "items": bad})
    r.call("GET", "/measurements", headers=h, params={"days": 3650})
    r.call("GET", "/measurements", headers=h, params={"kind": "weight_kg", "days": 0})
    r.call("GET", "/measurements/sources/health_connect", headers=h)
    r.call("GET", "/measurements/sources/fitbit", headers=h)
    r.call("GET", "/dashboard", headers=h)
    r.call("DELETE", "/measurements/sources/health_connect", headers=h)
    r.call("GET", "/measurements/sources/health_connect", headers=h)
    old = signed_up(r, "older", years=70)
    r.call("POST", "/onboarding/complete", headers=old, json=answers(readiness={**NO, "chest_pain": True}))
    r.call("GET", "/dashboard", headers=old)


def scenario_plans(r: Recorder) -> None:
    today = datetime.now(UTC).date()
    t, y = today.isoformat(), (today - timedelta(days=1)).isoformat()
    h = signed_up(r, "plan", sex="female")
    r.call("GET", "/plan", headers=h, params={"today": t})
    r.call("GET", "/progression", headers=h)
    r.call("GET", "/plan", headers=h)
    r.call("GET", "/plan", headers=h, params={"today": "2020-01-01"})
    r.call("GET", "/plan", headers=h, params={"today": "nope"})
    r.call("POST", "/onboarding/complete", headers=h, json=answers())
    tests = [
        ("cooper_12min", {"distance_m": 2100, "mode": "run"}),
        ("resting_hr", {"bpm": 72, "method": "manual_pulse"}),
        ("chair_stand_30s", {"reps": 18}),
        ("plank", {"seconds": 50}),
        ("pushups", {"variant": "knees", "reps": 11}),
        ("sit_reach", {"reach_cm": -4.5}),
        ("single_leg_stance", {"left_s": 21, "right_s": 30}),
        ("hrr_step", {"recovery_mode": "passive_seated", "hr_end": 150, "hr_60": 120}),
        ("body_measurements", {"weight_kg": 80, "waist_cm": 95}),
    ]
    for code, inputs in tests:
        r.call("POST", "/assessments/results", headers=h, json={"test_code": code, "inputs": inputs})
    r.call("GET", "/plan", headers=h, params={"today": t})
    for primary in (
        "cardio",
        "recovery",
        "strength",
        "muscularEndurance",
        "mobility",
        "balance",
        "body",
        "lifestyle",
    ):
        r.call("POST", "/plan", headers=h, json={"today": t, "primary": primary})
        r.call("POST", "/plan", headers=h, json={"today": t})
        r.call("POST", "/plan/abandon", headers=h, json={"today": t})
    r.call("POST", "/plan/abandon", headers=h, json={"today": t})
    r.call("POST", "/plan", headers=h, json={"today": y, "primary": "nope", "extra": 1})
    r.call("POST", "/plan", headers=h, json={"today": "2001-01-01"})
    plan = r.call("POST", "/plan", headers=h, json={"today": y}).json()
    tasks = plan["plan"]["today"] if plan.get("plan") else []
    for task in tasks:
        r.call(
            "PUT",
            "/plan/tasks",
            headers=h,
            json={"today": t, "day": y, "task_code": task["code"], "done": True},
        )
    view = r.call("GET", "/plan", headers=h, params={"today": t}).json()
    for task in (view.get("plan") or {}).get("today", []):
        r.call(
            "PUT",
            "/plan/tasks",
            headers=h,
            json={"today": t, "day": t, "task_code": task["code"], "done": True},
        )
    if tasks:
        code = tasks[0]["code"]
        r.call("PUT", "/plan/tasks", headers=h, json={"today": t, "day": y, "task_code": code, "done": False})
        r.call("PUT", "/plan/tasks", headers=h, json={"today": t, "day": y, "task_code": code, "done": False})
        r.call("PUT", "/plan/tasks", headers=h, json={"today": t, "day": y, "task_code": code, "done": True})
    r.call(
        "PUT", "/plan/tasks", headers=h, json={"today": t, "day": t, "task_code": "intervals_x", "done": True}
    )
    r.call(
        "PUT",
        "/plan/tasks",
        headers=h,
        json={"today": t, "day": "2020-01-01", "task_code": "x", "done": True},
    )
    r.call(
        "PUT", "/plan/tasks", headers=h, json={"today": t, "day": t, "task_code": "x" * 41, "done": "maybe"}
    )
    r.call("PUT", "/plan/tasks", headers=h, json=[])
    r.call("GET", "/plan", headers=h, params={"today": t})
    r.call("GET", "/progression", headers=h)
    r.call("PUT", "/progression/checkin", headers=h, json={"sessions": 3, "strength_sessions": 1})
    r.call(
        "PUT",
        "/progression/checkin",
        headers=h,
        json={"week": "previous", "sessions": 5, "active_minutes": 200},
    )
    r.call("PUT", "/progression/checkin", headers=h, json={"sessions": 3, "strength_sessions": 1})
    r.call(
        "PUT",
        "/progression/checkin",
        headers=h,
        json={"week": "older", "sessions": 22, "active_minutes": -1, "x": 1},
    )
    r.call("PUT", "/progression/checkin", headers=h, json={})
    r.call("POST", "/assessments/results", headers=h, json={"test_code": "plank", "inputs": {"seconds": 70}})
    r.call("POST", "/assessments/results", headers=h, json={"test_code": "plank", "inputs": {"seconds": 95}})
    r.call("GET", "/progression", headers=h)
    r.call("DELETE", "/plan", headers=h)
    r.call("GET", "/plan", headers={"Authorization": "Bearer nope"}, params={"today": t})
    reg = r.call(
        "POST",
        "/auth/register",
        json={
            "email": r.email("planminor"),
            "password": PASSWORD,
            "date_of_birth": adult(17),
            "privacy_consent": True,
            "parent_email": r.email("planparent"),
        },
    ).json()
    minor = {"Authorization": f"Bearer {reg['access_token']}"}
    r.call("POST", "/plan", headers=minor, json={"today": t})
    r.call("GET", "/progression", headers=minor)
    old = signed_up(r, "planold", years=72, sex="male")
    r.call("POST", "/onboarding/complete", headers=old, json=answers(readiness={**NO, "chest_pain": True}))
    r.call(
        "POST",
        "/assessments/results",
        headers=old,
        json={"test_code": "chair_stand_30s", "inputs": {"reps": 9}},
    )
    r.call("POST", "/plan", headers=old, json={"today": t, "primary": "strength"})
    r.call("GET", "/progression", headers=old)


def consent_token(r: Recorder, parent: str) -> str:
    mails = r.http.request("GET", V + "/__test__/outbox").json()
    body = [m["body"] for m in mails if m["to"] == parent][-1]
    return re.search(r"/consent/parental/([\w-]+)", body).group(1)  # type: ignore[union-attr]


def scenario_consent_export(r: Recorder) -> None:
    def minor(name: str, locale: str) -> tuple[dict[str, str], str]:
        parent = r.email(f"{name}-parent")
        reg = r.call(
            "POST",
            "/auth/register",
            json={
                "email": r.email(name),
                "password": PASSWORD,
                "date_of_birth": adult(15),
                "privacy_consent": True,
                "parent_email": parent,
                "preferred_locale": locale,
            },
        ).json()
        return {"Authorization": f"Bearer {reg['access_token']}"}, parent

    h, parent = minor("teen", "ro")
    r.call("GET", "/me/parental-consent", headers=h)
    r.call("POST", "/me/parental-consent/resend", headers=h)
    r.call("GET", "/me/export", headers=h)
    token = consent_token(r, parent)
    r.call("GET", f"/consent/parental/{token}")
    r.call("GET", "/consent/parental/not-a-real-token")
    r.call("POST", f"/consent/parental/{token}", data={"decision": "maybe"})
    r.call("POST", f"/consent/parental/{token}", content="decision=&decision=grant&x=%ZZ")
    r.call(
        "POST",
        f"/consent/parental/{token}",
        content="%64ecision=grant",
        headers={"Content-Type": "text/plain"},
    )
    r.call("GET", f"/consent/parental/{token}")
    r.call("POST", f"/consent/parental/{token}", data={"decision": "grant"})
    r.call("GET", "/me/parental-consent", headers=h)
    r.call("POST", "/me/parental-consent/resend", headers=h)
    r.call("PUT", "/progression/checkin", headers=h, json={"sessions": 2, "active_minutes": 45})
    r.call("POST", "/assessments/results", headers=h, json={"test_code": "plank", "inputs": {"seconds": 30}})
    r.call("GET", "/progression", headers=h)
    r.call("GET", "/me/export", headers=h)

    h2, parent2 = minor("teen2", "ru")
    token2 = consent_token(r, parent2)
    r.call("GET", f"/consent/parental/{token2}")
    r.call("POST", f"/consent/parental/{token2}", data={"decision": "refuse"})
    r.call("GET", "/me", headers=h2)
    r.call("POST", f"/consent/parental/{token2}", data={"decision": "grant"})

    a = signed_up(r, "exp", sex="male")
    r.call("POST", "/onboarding/complete", headers=a, json=answers())
    r.call(
        "PUT",
        "/personalization/profile",
        headers=a,
        json={
            "sports": [{"code": "cycling", "sessions_per_week": 4}],
            "goals": ["improve_endurance"],
            "priorities": [{"capacity": "max_strength", "weight": 2}],
        },
    )
    r.call(
        "POST",
        "/assessments/results",
        headers=a,
        json={"test_code": "pushups", "inputs": {"variant": "toes", "reps": 9}},
    )
    items = [
        {"kind": "weight_kg", "value": 80.25, "measured_at": "2026-11-10T07:00:00Z", "external_id": "w1"}
    ]
    r.call("POST", "/measurements/import", headers=a, json={"source": "health_connect", "items": items})
    r.call("PUT", "/progression/checkin", headers=a, json={"week": "previous", "sessions": 3})
    r.call("GET", "/progression", headers=a)
    r.call("GET", "/me/parental-consent", headers=a)
    r.call("POST", "/me/parental-consent/resend", headers=a)
    r.call("GET", "/me/export", headers=a)
    r.call("GET", "/me/export")


SCENARIOS = {
    "consent_export": scenario_consent_export,
    "plans": scenario_plans,
    "insights": scenario_insights,
    "personalization": scenario_personalization,
    "auth": scenario_auth,
    "minor": scenario_minor,
    "onboarding": scenario_onboarding,
    "assessments": scenario_assessments,
}


def main() -> int:
    if len(sys.argv) < 3:
        sys.exit("usage: api_diff.py <reference base URL> <candidate base URL> [scenario ...]")
    ref_url, cand_url = sys.argv[1], sys.argv[2]
    names = sys.argv[3:] or list(SCENARIOS)
    failed = 0
    for name in names:
        outs = []
        for base in (ref_url, cand_url):
            tag = uuid.uuid4().hex[:10]
            rec = Recorder(base, tag)
            SCENARIOS[name](rec)
            outs.append(normalise(rec.log, tag).splitlines())
        if outs[0] == outs[1]:
            print(f"{name}: identical ({len(outs[0])} lines)")
            continue
        failed += 1
        import difflib

        print(f"{name}: DIFFERENT")
        for line in list(difflib.unified_diff(outs[0], outs[1], "python", "typescript", lineterm="", n=2))[
            :120
        ]:
            print("  " + line)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

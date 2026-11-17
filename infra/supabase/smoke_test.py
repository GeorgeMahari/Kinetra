"""End-to-end check of a running Kinetra API and the database behind it.

    cd backend
    .venv\\Scripts\\python ..\\infra\\supabase\\smoke_test.py http://127.0.0.1:8000

What it does, with two throwaway accounts (smoke-<random>@example.com):
register, login, token refresh, profile update, onboarding (several related tables), create /
read / list / delete test results, per-user isolation (the second account cannot see, list or delete
the first one's data), data still there after a new sign-in, and a direct database check that the
rows exist with the right owner. At the end both accounts are deleted through the API (the
account-deletion endpoint), and the script checks that none of their rows are left.

The database check uses the same KINETRA_DB_* settings as the API (app.core.config). Nothing else
in the database is read or changed. Exit code 0 only when every step passed.
"""

import json
import secrets
import sys
import urllib.error
import urllib.request
import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import create_engine, text

sys.path.insert(0, ".")
from app.core.config import get_settings  # noqa: E402

PASSWORD = "smoke " + secrets.token_urlsafe(12)
STEPS: list[tuple[str, bool]] = []


def call(base: str, method: str, path: str, token: str | None = None, body: Any = None) -> tuple[int, Any]:
    data = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request(base + "/api/v1" + path, data=data, method=method)  # noqa: S310 (scheme checked in main)
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:  # noqa: S310 (scheme checked in main)
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as err:
        raw = err.read()
        return err.code, (json.loads(raw) if raw else None)


def check(name: str, ok: bool) -> bool:
    STEPS.append((name, ok))
    print(f"{'PASS' if ok else 'FAIL'}  {name}")
    return ok


def register(base: str) -> tuple[str, dict[str, Any]]:
    email = f"smoke-{uuid.uuid4().hex[:10]}@example.com"
    dob = date(datetime.now(UTC).year - 30, 1, 15).isoformat()
    status, body = call(
        base,
        "POST",
        "/auth/register",
        body={
            "email": email,
            "password": PASSWORD,
            "date_of_birth": dob,
            "preferred_locale": "ro",
            "privacy_consent": True,
        },
    )
    check(f"register {email}", status == 201)
    return email, body


def main(base: str) -> int:
    base = base.rstrip("/")
    if not base.startswith(("http://", "https://")):
        sys.exit("The API base URL must start with http:// or https://")
    status, body = call(base, "GET", "/health/ready")
    if not check("API ready and database reachable", status == 200 and body["database"] == "ok"):
        return 1

    email_a, tokens_a = register(base)
    email_b, tokens_b = register(base)
    created = [(email_a, tokens_a), (email_b, tokens_b)]
    try:
        status, login = call(base, "POST", "/auth/login", body={"email": email_a, "password": PASSWORD})
        check("login", status == 200 and "access_token" in login)
        a = login["access_token"]
        status, refreshed = call(
            base, "POST", "/auth/refresh", body={"refresh_token": login["refresh_token"]}
        )
        check(
            "refresh token rotation", status == 200 and refreshed["refresh_token"] != login["refresh_token"]
        )
        a = refreshed["access_token"]
        b = tokens_b["access_token"]

        status, me = call(base, "GET", "/me", a)
        check("read own account", status == 200 and me["email"] == email_a)
        user_a = me["id"]
        status, me = call(base, "PATCH", "/me/profile", a, {"sex_for_norms": "male", "height_cm": 176})
        check("update profile", status == 200 and me["profile"]["height_cm"] == 176)

        onboarding = {
            "goals": ["improve_endurance", "get_stronger"],
            "activity": {
                "activity_level": "active",
                "exercise_sessions_per_week": 4,
                "typical_session_minutes": 60,
                "training_experience": "one_to_three_years",
                "sports": [{"code": "cycling", "sessions_per_week": 3}],
            },
            "follow_ups": {
                "strength_sessions_per_week": 0,
                "mobility_practice": "occasional",
                "sleep_hours": 7.5,
            },
            "readiness": {
                k: False
                for k in (
                    "heart_condition",
                    "chest_pain",
                    "dizziness_or_fainting",
                    "chronic_condition",
                    "musculoskeletal",
                    "supervised_only",
                    "pregnancy",
                )
            },
        }
        status, _ = call(base, "POST", "/onboarding/complete", a, onboarding)
        check("complete onboarding (goals, activity, sports, screening)", status == 200)

        status, r1 = call(
            base, "POST", "/assessments/results", a, {"test_code": "plank", "inputs": {"seconds": 60}}
        )
        check("create test result", status == 201)
        status, r2 = call(
            base,
            "POST",
            "/assessments/results",
            a,
            {"test_code": "body_measurements", "inputs": {"weight_kg": 71}},
        )
        check("create a second result", status == 201)
        status, got = call(base, "GET", f"/assessments/results/{r1['id']}", a)
        check("read result by id", status == 200 and got["id"] == r1["id"])
        status, listed = call(base, "GET", "/assessments/results", a)
        check("list own results", status == 200 and {r["id"] for r in listed} == {r1["id"], r2["id"]})
        status, _ = call(base, "DELETE", f"/assessments/results/{r2['id']}", a)
        check("delete a result", status == 204)

        check(
            "other account: result by id is 404",
            call(base, "GET", f"/assessments/results/{r1['id']}", b)[0] == 404,
        )
        check("other account: list is empty", call(base, "GET", "/assessments/results", b)[1] == [])
        check(
            "other account: cannot delete it",
            call(base, "DELETE", f"/assessments/results/{r1['id']}", b)[0] == 404,
        )
        check("no token: 401", call(base, "GET", "/assessments/results")[0] == 401)

        status, login2 = call(base, "POST", "/auth/login", body={"email": email_a, "password": PASSWORD})
        status, listed = call(base, "GET", "/assessments/results", login2["access_token"])
        check("data still there after a new sign-in", [r["id"] for r in listed] == [r1["id"]])

        engine = create_engine(get_settings().database_url(), connect_args={"connect_timeout": 15})
        with engine.connect() as conn:
            rows = conn.execute(
                text("SELECT id::text, test_code FROM test_results WHERE user_id = :u"), {"u": user_a}
            ).all()
            check("database: exactly the kept result, owned by the account", rows == [(r1["id"], "plank")])
            prof = conn.execute(
                text("SELECT height_cm FROM user_profiles WHERE user_id = :u"), {"u": user_a}
            ).scalar_one()
            check("database: profile update saved", float(prof) == 176)
            goals = conn.execute(
                text("SELECT count(*) FROM user_goals WHERE user_id = :u"), {"u": user_a}
            ).scalar_one()
            check("database: related onboarding rows saved", goals == 2)
    finally:
        ids = []
        for email, _ in created:
            status, login = call(base, "POST", "/auth/login", body={"email": email, "password": PASSWORD})
            if status != 200:
                check(f"cleanup: sign in {email}", False)
                continue
            token = login["access_token"]
            ids.append(call(base, "GET", "/me", token)[1]["id"])
            status, _ = call(base, "POST", "/me/delete", token, {"password": PASSWORD})
            check(f"cleanup: delete {email}", status == 204)
        engine = create_engine(get_settings().database_url(), connect_args={"connect_timeout": 15})
        with engine.connect() as conn:
            left = conn.execute(
                text(
                    "SELECT (SELECT count(*) FROM users WHERE id = ANY(CAST(:ids AS uuid[])))"
                    " + (SELECT count(*) FROM test_results WHERE user_id = ANY(CAST(:ids AS uuid[])))"
                ),
                {"ids": ids},
            ).scalar_one()
            check("cleanup: no rows left for the test accounts", left == 0)

    failed = [n for n, ok in STEPS if not ok]
    print(f"\n{len(STEPS) - len(failed)}/{len(STEPS)} checks passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000"))

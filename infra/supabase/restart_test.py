"""Data saved through the public API is still there after the API restarts.

    cd backend
    .venv\\Scripts\\python ..\\infra\\supabase\\restart_test.py save   <api-base-url> <state-file>
    (restart the API)
    .venv\\Scripts\\python ..\\infra\\supabase\\restart_test.py verify <api-base-url> <state-file>

`save` registers a throwaway account (smoke-<random>@example.com), completes onboarding and saves a
test result, then writes the account's email, its random password and the result id to the state
file (a temporary file the caller deletes). `verify` signs in again, checks that the result reads
back identically, deletes the account through the API and removes the state file. Run by
infra/supabase/cloud-only-test.ps1, which restarts the API between the two steps.
"""

import json
import os
import secrets
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import smoke_test  # noqa: E402  (same folder: call, check, register, STEPS)

READINESS = (
    "heart_condition",
    "chest_pain",
    "dizziness_or_fainting",
    "chronic_condition",
    "musculoskeletal",
    "supervised_only",
    "pregnancy",
)


def save(base: str, state: Path) -> None:
    smoke_test.PASSWORD = "restart " + secrets.token_urlsafe(12)
    email, tokens = smoke_test.register(base)
    token = tokens["access_token"]
    onboarding: dict[str, Any] = {
        "goals": ["improve_endurance"],
        "activity": {
            "activity_level": "active",
            "exercise_sessions_per_week": 3,
            "typical_session_minutes": 45,
            "training_experience": "one_to_three_years",
            "sports": [{"code": "running", "sessions_per_week": 2}],
        },
        "follow_ups": {"strength_sessions_per_week": 1, "mobility_practice": "occasional", "sleep_hours": 7},
        "readiness": {k: False for k in READINESS},
    }
    status, _ = smoke_test.call(base, "POST", "/onboarding/complete", token, onboarding)
    smoke_test.check("complete onboarding", status == 200)
    status, result = smoke_test.call(
        base, "POST", "/assessments/results", token, {"test_code": "plank", "inputs": {"seconds": 75}}
    )
    smoke_test.check("save a test result", status == 201)
    state.write_text(
        json.dumps({"email": email, "password": smoke_test.PASSWORD, "result": result}), encoding="utf-8"
    )


def verify(base: str, state: Path) -> None:
    saved = json.loads(state.read_text(encoding="utf-8"))
    try:
        creds = {"email": saved["email"], "password": saved["password"]}
        status, login = smoke_test.call(base, "POST", "/auth/login", body=creds)
        if not smoke_test.check("after restart: sign in with the same account", status == 200):
            return
        token = login["access_token"]
        result = saved["result"]
        status, got = smoke_test.call(base, "GET", f"/assessments/results/{result['id']}", token)
        smoke_test.check("after restart: the result reads back identically", status == 200 and got == result)
        status, listed = smoke_test.call(base, "GET", "/assessments/results", token)
        smoke_test.check(
            "after restart: listed once", status == 200 and [r["id"] for r in listed] == [result["id"]]
        )
        status, summary = smoke_test.call(base, "GET", "/onboarding/summary", token)
        smoke_test.check(
            "after restart: onboarding still saved",
            status == 200 and summary["goals"] == ["improve_endurance"],
        )
        status, _ = smoke_test.call(base, "POST", "/me/delete", token, {"password": saved["password"]})
        smoke_test.check("cleanup: delete the account", status == 204)
    finally:
        os.remove(state)


def main() -> int:
    if len(sys.argv) != 4 or sys.argv[1] not in ("save", "verify"):
        sys.exit("usage: restart_test.py save|verify <api-base-url> <state-file>")
    step, base, state = sys.argv[1], sys.argv[2].rstrip("/"), Path(sys.argv[3])
    if not base.startswith(("http://", "https://")):
        sys.exit("The API base URL must start with http:// or https://")
    (save if step == "save" else verify)(base, state)
    failed = [n for n, ok in smoke_test.STEPS if not ok]
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())

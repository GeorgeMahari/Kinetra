"""The request's database session must commit before the response is sent.

With FastAPI's default dependency scope the code after `yield` (the commit) runs after the response
has gone out, so a client that sends its next request at once (sign up, then load the profile) can
read the database before the commit and get a wrong answer. Measured over HTTP: 13 of 30 profile
loads right after sign-up returned 401. scope="function" commits first. TestClient cannot show the
race, so this test guards the source instead.
"""

import re
from pathlib import Path

APP = Path(__file__).resolve().parent.parent / "app"


def test_every_database_dependency_commits_before_the_response() -> None:
    unscoped = []
    for path in APP.rglob("*.py"):
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for call in re.findall(r"Depends\(get_db[^)]*\)", line):
                if 'scope="function"' not in call:
                    unscoped.append(f"{path.relative_to(APP)}:{n}: {call}")
    assert unscoped == [], "use app.core.db.DB instead of Depends(get_db)"


def test_the_shared_dependency_uses_the_function_scope() -> None:
    from app.core.db import DB, get_db

    assert DB.dependency is get_db
    assert DB.scope == "function"

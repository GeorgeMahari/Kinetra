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
from datetime import date
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


def normalise(entries: list[dict[str, Any]], tag: str) -> str:
    text = json.dumps(entries, ensure_ascii=False, sort_keys=True, indent=1).replace(tag, "<run>")
    seen: dict[str, str] = {}

    def stable(prefix: str) -> Callable[[re.Match[str]], str]:
        def sub(m: re.Match[str]) -> str:
            return seen.setdefault(m.group(0), f"<{prefix}{len(seen)}>")

        return sub

    text = UUID_RE.sub(stable("id"), text)
    text = TS_RE.sub("<ts>", text)
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


SCENARIOS = {"auth": scenario_auth, "minor": scenario_minor}


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

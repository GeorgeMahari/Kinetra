"""Simultaneous rate-limited requests (sign-in, sign-up, password reset) all get an answer.

Regression: the Edge Function reserved one pooled connection per request (max 3) and the rate
limiter asked the pool for a second one. Three sign-ins at the same moment held all three
connections and each waited for a fourth: the function stopped answering.
"""

from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

import pytest
from fastapi.testclient import TestClient

from tests.test_auth_api import PASSWORD, register_ok

pytestmark = pytest.mark.db

# Comfortably more than the Edge Function's pool (3 connections).
CONCURRENT = 8


def run_at_once(fn: Callable[[str], int], args: list[str]) -> list[int]:
    """Runs fn on every argument at the same time. A deadlock fails the test after 60 s instead of
    hanging the run (the pool is not joined, so stuck threads are left behind)."""
    pool = ThreadPoolExecutor(max_workers=len(args))
    try:
        futures = [pool.submit(fn, a) for a in args]
        return [f.result(timeout=60) for f in futures]
    finally:
        pool.shutdown(wait=False, cancel_futures=True)


def test_simultaneous_sign_ins_all_answer(api: TestClient) -> None:
    emails = [f"concurrent{i}@example.com" for i in range(CONCURRENT)]
    for email in emails:
        register_ok(api, email)

    def sign_in(email: str) -> int:
        return api.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD}).status_code

    assert run_at_once(sign_in, emails) == [200] * CONCURRENT


def test_simultaneous_password_resets_all_answer(api: TestClient) -> None:
    emails = [f"reset{i}@example.com" for i in range(CONCURRENT)]

    def forgot(email: str) -> int:
        return api.post("/api/v1/auth/password/forgot", json={"email": email}).status_code

    codes = run_at_once(forgot, emails)
    assert len(set(codes)) == 1
    assert codes[0] in (200, 202, 204)

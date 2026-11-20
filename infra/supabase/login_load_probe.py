"""After a deploy: do sign-ins stay within the Edge Function's CPU (2 s) and memory (256 MB) limits?

    cd backend
    .venv\\Scripts\\python ..\\infra\\supabase\\login_load_probe.py https://<ref>.supabase.co/functions/v1/api

Each sign-in verifies an Argon2id hash (64 MiB, t=3, p=4) in WebAssembly: about 0.3 s of CPU and
64 MiB of memory on a desktop. Six throwaway accounts (smoke-<random>@example.com): the first signs
in 8 times in a row, then the other five sign in at the same moment, 3 rounds. The login rate limit
(10 attempts per email and address in 5 minutes) is respected. Every response must be 200; a 546
means the platform stopped the worker (WORKER_RESOURCE_LIMIT). The accounts are deleted at the end.
Exit code 0 only when every sign-in succeeded.
"""

import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import smoke_test


def main(base: str) -> int:
    base = base.rstrip("/")
    if not base.startswith(("http://", "https://")):
        sys.exit("The API base URL must start with http:// or https://")
    emails = [smoke_test.register(base)[0] for _ in range(6)]

    def login(email: str) -> tuple[int, float]:
        t = time.perf_counter()
        status, _ = smoke_test.call(
            base,
            "POST",
            "/auth/login",
            body={"email": email, "password": smoke_test.PASSWORD},
        )
        return status, time.perf_counter() - t

    results: list[tuple[int, float]] = []
    try:
        results += [login(emails[0]) for _ in range(8)]
        with ThreadPoolExecutor(max_workers=5) as pool:
            for _ in range(3):
                results += list(pool.map(login, emails[1:]))
    finally:
        for email in emails:
            creds = {"email": email, "password": smoke_test.PASSWORD}
            status, body = smoke_test.call(base, "POST", "/auth/login", body=creds)
            if status == 200:
                token = body["access_token"]
                smoke_test.call(
                    base, "POST", "/me/delete", token, {"password": smoke_test.PASSWORD}
                )
            else:
                print(
                    f"cleanup: could not sign in {email} (HTTP {status}); delete it later"
                )
    codes = [s for s, _ in results]
    times = sorted(d for _, d in results)
    print(f"sign-ins: {len(results)}, status codes: {sorted(set(codes))}")
    p95 = times[int(len(times) * 0.95) - 1]
    print(
        f"latency s: median {statistics.median(times):.2f}, p95 {p95:.2f}, max {times[-1]:.2f}"
    )
    failed = [c for c in codes if c != 200]
    print(
        "PASS"
        if not failed
        else f"FAIL: {len(failed)} sign-ins failed ({sorted(set(failed))})"
    )
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))

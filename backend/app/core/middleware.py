"""Security middleware (pure ASGI, so it also covers streamed/chunked bodies).

- Body size limit: requests larger than MAX_BODY_BYTES get 413 before any JSON parsing, so a
  multi-megabyte body can't be used to burn CPU/memory. The largest legitimate body (an
  onboarding draft) is capped at ~20 KB by validation; 64 KB leaves ample headroom.
- Security headers on every response. API responses carry personal data, so they're never
  cached (Cache-Control: no-store). The interactive docs (/docs, /redoc) need their own CDN
  scripts, so the strict CSP applies to everything else.
"""

import json
from collections.abc import Awaitable, Callable, MutableMapping
from typing import Any

Scope = MutableMapping[str, Any]
Message = MutableMapping[str, Any]
Receive = Callable[[], Awaitable[Message]]
Send = Callable[[Message], Awaitable[None]]
ASGIApp = Callable[[Scope, Receive, Send], Awaitable[None]]

MAX_BODY_BYTES = 64 * 1024

_DOCS_PREFIXES = ("/docs", "/redoc", "/openapi.json")


def _envelope_413() -> bytes:
    return json.dumps(
        {"error": {"code": "payload_too_large", "message": "Request body is too large.", "details": []}}
    ).encode()


class SecurityMiddleware:
    def __init__(self, app: ASGIApp, *, max_body_bytes: int = MAX_BODY_BYTES, hsts: bool = False) -> None:
        self.app = app
        self.max_body_bytes = max_body_bytes
        self.hsts = hsts

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path: str = scope.get("path", "")
        headers = {k.decode().lower(): v.decode() for k, v in scope.get("headers", [])}
        declared = headers.get("content-length")
        if declared is not None and declared.isdigit() and int(declared) > self.max_body_bytes:
            await self._reject(send, path)
            return

        received = 0
        rejected = False
        response_started = False

        async def limited_receive() -> Message:
            nonlocal received, rejected
            if rejected:
                return {"type": "http.disconnect"}
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > self.max_body_bytes:
                    # Answer 413 ourselves (the framework would turn an exception raised here into
                    # its own 400) and make the app see a disconnected client from now on.
                    rejected = True
                    if not response_started:
                        await self._reject(send, path)
                    return {"type": "http.disconnect"}
            return message

        async def send_with_headers(message: Message) -> None:
            nonlocal response_started
            if rejected:
                return  # the 413 has already been sent
            if message["type"] == "http.response.start":
                response_started = True
                message["headers"] = self._with_security_headers(list(message.get("headers", [])), path)
            await send(message)

        try:
            await self.app(scope, limited_receive, send_with_headers)
        except Exception:
            if not rejected:
                raise
            # The app reacting to the simulated disconnect after a 413 is expected; nothing to report.

    def _with_security_headers(self, raw: list[tuple[bytes, bytes]], path: str) -> list[tuple[bytes, bytes]]:
        drop = {b"server"}
        out = [(k, v) for k, v in raw if k.lower() not in drop]
        extra: list[tuple[bytes, bytes]] = [
            (b"x-content-type-options", b"nosniff"),
            (b"x-frame-options", b"DENY"),
            (b"referrer-policy", b"no-referrer"),
            (b"cross-origin-resource-policy", b"same-site"),
            (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
            (b"cache-control", b"no-store"),
        ]
        if not path.startswith(_DOCS_PREFIXES):
            extra.append((b"content-security-policy", b"default-src 'none'; frame-ancestors 'none'"))
        if self.hsts:
            extra.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
        present = {k.lower() for k, _ in out}
        return out + [(k, v) for k, v in extra if k not in present]

    async def _reject(self, send: Send, path: str) -> None:
        body = _envelope_413()
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": self._with_security_headers(
                    [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
                    path,
                ),
            }
        )
        await send({"type": "http.response.body", "body": body})

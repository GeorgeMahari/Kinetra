"""A TestClient-compatible client for a running API (used when KINETRA_TEST_API_URL is set).

The same API tests can then run against the FastAPI app in-process (the reference) and against
any other implementation of the API over HTTP, such as the Supabase Edge Function.
"""

import http.client
import json as jsonlib
import secrets
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping
from http.client import HTTPResponse
from typing import Any


class Headers:
    def __init__(self, items: list[tuple[str, str]]) -> None:
        self._items = items

    def get(self, key: str, default: str | None = None) -> str | None:
        for k, v in self._items:
            if k.lower() == key.lower():
                return v
        return default

    def __getitem__(self, key: str) -> str:
        value = self.get(key)
        if value is None:
            raise KeyError(key)
        return value

    def __contains__(self, key: object) -> bool:
        return isinstance(key, str) and self.get(key) is not None


class RequestInfo:
    def __init__(self, method: str, url: str) -> None:
        self.method, self.url = method, url


class HttpResponse:
    def __init__(
        self, status: int, headers: list[tuple[str, str]], body: bytes, request: RequestInfo
    ) -> None:
        self.request = request
        self.status_code = status
        self.headers = Headers(headers)
        self.content = body

    @property
    def text(self) -> str:
        return self.content.decode("utf-8", errors="replace")

    def json(self) -> Any:
        return jsonlib.loads(self.content)


class HttpClient:
    def __init__(self, base_url: str) -> None:
        if not base_url.startswith(("http://", "https://")):
            raise ValueError("KINETRA_TEST_API_URL must be an http(s) URL")
        self.base_url = base_url.rstrip("/")
        # Each test gets its own client address, so per-IP rate limits never leak between tests.
        # The server under test trusts this header from loopback only (KINETRA_CLIENT_IP_HEADER).
        self.client_ip = f"10.{secrets.randbelow(256)}.{secrets.randbelow(256)}.{1 + secrets.randbelow(254)}"

    def request(
        self,
        method: str,
        path: str,
        *,
        json: Any = None,
        data: Mapping[str, str] | None = None,
        content: bytes | str | Iterable[bytes] | None = None,
        headers: Mapping[str, str] | None = None,
        params: Mapping[str, Any] | None = None,
    ) -> HttpResponse:
        url = self.base_url + path
        if params:
            url += ("&" if "?" in url else "?") + urllib.parse.urlencode(params, doseq=True)
        hdrs = {"X-Test-Client-IP": self.client_ip, **dict(headers or {})}
        payload: Any = None
        if json is not None:
            payload = jsonlib.dumps(json).encode()
            hdrs.setdefault("Content-Type", "application/json")
        elif data is not None:
            body = urllib.parse.urlencode(data).encode()
            hdrs.setdefault("Content-Type", "application/x-www-form-urlencoded")
            return self._send(method, url, body, hdrs)
        elif content is not None:
            payload = content.encode() if isinstance(content, str) else content
        return self._send(method, url, payload, hdrs)

    def _send(self, method: str, url: str, data: Any, hdrs: dict[str, str]) -> HttpResponse:
        req = urllib.request.Request(url, data=data, method=method, headers=hdrs)  # noqa: S310 (http(s) only)
        chunked = data is not None and not isinstance(data, bytes)
        if chunked:
            req.add_header("Transfer-Encoding", "chunked")
        info = RequestInfo(method, url)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 (test base URL)
                return self._wrap(resp, info)
        except urllib.error.HTTPError as err:
            return HttpResponse(err.code, list(err.headers.items()), err.read(), info)
        except (ConnectionResetError, urllib.error.URLError) as err:
            # A server may answer 413 from the declared Content-Length and close the connection
            # while a large body is still being sent (Windows then resets the socket). Ask again with
            # the same headers and no body, so the response the server chose can be read.
            if (
                not isinstance(data, bytes)
                or isinstance(err, urllib.error.URLError)
                and not isinstance(err.reason, ConnectionResetError)
            ):
                raise
            return self._headers_only(method, url, {**hdrs, "Content-Length": str(len(data))}, info)

    @staticmethod
    def _headers_only(method: str, url: str, hdrs: dict[str, str], info: RequestInfo) -> HttpResponse:
        parts = urllib.parse.urlsplit(url)
        conn_cls = http.client.HTTPSConnection if parts.scheme == "https" else http.client.HTTPConnection
        conn = conn_cls(parts.netloc, timeout=60)
        try:
            conn.putrequest(method, parts.path + (f"?{parts.query}" if parts.query else ""))
            for k, v in hdrs.items():
                conn.putheader(k, v)
            conn.endheaders()
            resp = conn.getresponse()
            return HttpResponse(resp.status, list(resp.getheaders()), resp.read(), info)
        finally:
            conn.close()

    @staticmethod
    def _wrap(resp: HTTPResponse, info: RequestInfo) -> HttpResponse:
        return HttpResponse(resp.status, list(resp.headers.items()), resp.read(), info)

    def get(self, path: str, **kw: Any) -> HttpResponse:
        return self.request("GET", path, **kw)

    def post(self, path: str, **kw: Any) -> HttpResponse:
        return self.request("POST", path, **kw)

    def put(self, path: str, **kw: Any) -> HttpResponse:
        return self.request("PUT", path, **kw)

    def patch(self, path: str, **kw: Any) -> HttpResponse:
        return self.request("PATCH", path, **kw)

    def delete(self, path: str, **kw: Any) -> HttpResponse:
        return self.request("DELETE", path, **kw)

    def options(self, path: str, **kw: Any) -> HttpResponse:
        return self.request("OPTIONS", path, **kw)


class SentEmail:
    def __init__(self, to: str, subject: str, body: str) -> None:
        self.to, self.subject, self.body = to, subject, body


class HttpOutbox:
    """Stands in for ConsoleEmailSender: `.outbox` reads what the server under test sent."""

    def __init__(self, base_url: str) -> None:
        self._client = HttpClient(base_url)
        # Each test starts with an empty outbox, as the in-process fixture does.
        assert self._client.delete("/api/v1/__test__/outbox").status_code == 204

    @property
    def outbox(self) -> list[SentEmail]:
        resp = self._client.get("/api/v1/__test__/outbox")
        assert resp.status_code == 200, "the server under test must run with KINETRA_ENVIRONMENT=test"
        return [SentEmail(m["to"], m["subject"], m["body"]) for m in resp.json()]

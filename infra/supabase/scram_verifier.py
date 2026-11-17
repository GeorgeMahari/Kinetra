"""Prints the PostgreSQL SCRAM-SHA-256 verifier for the password in an environment variable.

    python scram_verifier.py KINETRA_APP_DB_PASSWORD

`CREATE ROLE ... PASSWORD '<verifier>'` stores it as is, so the plain password never reaches the
server, its logs or the statement text. Format (RFC 5803, as PostgreSQL stores it):
SCRAM-SHA-256$<iterations>:<salt>$<StoredKey>:<ServerKey>
"""

import base64
import hashlib
import hmac
import os
import secrets
import sys

ITERATIONS = 4096


def verifier(password: str) -> str:
    salt = secrets.token_bytes(16)
    salted = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    client_key = hmac.new(salted, b"Client Key", hashlib.sha256).digest()
    stored_key = hashlib.sha256(client_key).digest()
    server_key = hmac.new(salted, b"Server Key", hashlib.sha256).digest()
    return f"SCRAM-SHA-256${ITERATIONS}:{_b64(salt)}${_b64(stored_key)}:{_b64(server_key)}"


def _b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


if __name__ == "__main__":
    value = os.environ.get(sys.argv[1], "")
    if not value or not value.isascii():
        sys.exit(f"{sys.argv[1]} must be set to an ASCII password")
    print(verifier(value))

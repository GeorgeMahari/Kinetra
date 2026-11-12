"""Password policy, following NIST SP 800-63B: length over composition rules,
and rejection of common or context-derived passwords."""

MIN_LENGTH = 10
MAX_LENGTH = 128

# Short blocklist of the most common passwords that satisfy the length rule.
# A production deployment should check a large breached-password corpus instead.
_COMMON = {
    "1234567890",
    "12345678910",
    "0123456789",
    "qwertyuiop",
    "password12",
    "password123",
    "password1234",
    "1q2w3e4r5t",
    "qwerty1234",
    "qwerty12345",
    "iloveyou12",
    "abcdefghij",
    "letmein123",
    "welcome123",
    "admin12345",
    "football12",
    "1111111111",
    "0000000000",
    "aaaaaaaaaa",
    "parola1234",
    "parola12345",
}


def password_problems(password: str, email: str | None = None) -> list[str]:
    """Returns stable problem codes; an empty list means the password is acceptable."""
    problems: list[str] = []
    if len(password) < MIN_LENGTH:
        problems.append("too_short")
    if len(password) > MAX_LENGTH:
        problems.append("too_long")
    lowered = password.lower()
    if lowered in _COMMON:
        problems.append("too_common")
    if len(set(password)) < 4:
        problems.append("too_repetitive")
    if email:
        local = email.split("@", 1)[0].lower()
        if len(local) >= 4 and local in lowered:
            problems.append("contains_email")
    return problems

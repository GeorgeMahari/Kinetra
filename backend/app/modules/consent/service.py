"""Parental consent for users aged 14-15 (DECISIONS D39).

Flow: registration creates a *pending* account and emails the parent a single link. The link opens a
page served by this API, outside the child's app, where the parent reads what Kinetra collects and
agrees or refuses.
- Agreeing unlocks the account.
- Refusing, or no answer within `parental_consent_days`, deletes the account and everything linked
  to it.

The link token has 256 bits of entropy and is stored only as a SHA-256 hash, like refresh tokens.
"""

import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.email import OutgoingEmail, get_email_sender, require_email
from app.core.errors import AppError
from app.modules.consent.models import ParentalConsent
from app.modules.users.models import User

logger = logging.getLogger(__name__)

POLICY_VERSION = "parental-1"
RESEND_AFTER = timedelta(minutes=10)

PENDING = "pending"
GRANTED = "granted"
NOT_REQUIRED = "not_required"


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def link_for(token: str) -> str:
    s = get_settings()
    return f"{s.public_base_url.rstrip('/')}{s.api_prefix}/consent/parental/{token}"


_EMAIL = {
    "en": (
        "Your child asked to use Kinetra",
        "Someone aged 14 or 15 created a Kinetra account with the email {child} and gave your address "
        "as a parent's.\n\nKinetra is a wellness app: it helps people understand their physical "
        "condition through simple tests. It gives no medical diagnoses, and it never offers "
        "maximal-effort tests or comparisons with other people to anyone under 18.\n\n"
        "Read what the app collects, then agree or refuse here:\n{link}\n\n"
        "Until you answer, the account is locked and no other data is collected. If you refuse, or "
        "don't answer within {days} days, the account is deleted. If you don't know this account, "
        "you can ignore this email.",
    ),
    "ro": (
        "Copilul tău a cerut să folosească Kinetra",
        "Cineva în vârstă de 14 sau 15 ani și-a creat un cont Kinetra cu emailul {child} și a dat "
        "adresa ta ca adresă de părinte.\n\nKinetra este o aplicație de wellness: îi ajută pe oameni "
        "să-și înțeleagă condiția fizică prin teste simple. Nu pune diagnostice medicale și nu oferă "
        "nimănui sub 18 ani teste de efort maxim sau comparații cu alți oameni.\n\n"
        "Citește ce date colectează aplicația, apoi acceptă sau refuză aici:\n{link}\n\n"
        "Până răspunzi, contul este blocat și nu se colectează alte date. Dacă refuzi sau nu răspunzi "
        "în {days} zile, contul este șters. Dacă nu cunoști acest cont, poți ignora acest email.",
    ),
    "ru": (
        "Ваш ребёнок хочет пользоваться Kinetra",
        "Пользователь в возрасте 14 или 15 лет создал аккаунт Kinetra с адресом {child} и указал ваш "
        "адрес как адрес родителя.\n\nKinetra — приложение для оценки физического состояния с помощью "
        "простых тестов. Оно не ставит медицинских диагнозов и никогда не предлагает лицам младше 18 "
        "лет тесты с максимальной нагрузкой или сравнение с другими людьми.\n\n"
        "Прочитайте, какие данные собирает приложение, и согласитесь или откажите здесь:\n{link}\n\n"
        "Пока вы не ответите, аккаунт заблокирован и другие данные не собираются. Если вы откажете "
        "или не ответите в течение {days} дней, аккаунт будет удалён. Если вы не знаете этот аккаунт, "
        "просто проигнорируйте письмо.",
    ),
}


def _send(user: User, consent: ParentalConsent, token: str) -> None:
    subject, body = _EMAIL.get(user.preferred_locale, _EMAIL["en"])
    text = body.format(child=user.email, link=link_for(token), days=get_settings().parental_consent_days)
    try:
        get_email_sender().send(OutgoingEmail(consent.parent_email, subject, text))
    except Exception:
        # Delivery problems are logged; the child can resend from the app.
        logger.exception("Parental consent email failed user=%s", user.id)


def needs_parental_consent(age: int) -> bool:
    s = get_settings()
    return s.min_age_with_parental_consent <= age < s.min_registration_age


def start(db: Session, user: User, parent_email: str, now: datetime | None = None) -> None:
    """Called inside registration: locks the account and emails the parent."""
    now = now or datetime.now(UTC)
    token = secrets.token_urlsafe(32)
    consent = ParentalConsent(
        user_id=user.id,
        parent_email=parent_email,
        token_hash=_hash(token),
        policy_version=POLICY_VERSION,
        requested_at=now,
        last_sent_at=now,
        expires_at=now + timedelta(days=get_settings().parental_consent_days),
    )
    user.parental_consent_status = PENDING
    db.add(consent)
    db.flush()
    _send(user, consent, token)


def _pending(db: Session, user: User) -> ParentalConsent | None:
    return db.scalar(
        select(ParentalConsent).where(
            ParentalConsent.user_id == user.id, ParentalConsent.granted_at.is_(None)
        )
    )


def mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}"


@dataclass(frozen=True)
class ConsentStatus:
    status: str
    parent_email_masked: str | None
    expires_at: datetime | None
    can_resend_at: datetime | None


def get_status(db: Session, user: User) -> ConsentStatus:
    if user.parental_consent_status != PENDING:
        return ConsentStatus(user.parental_consent_status, None, None, None)
    c = _pending(db, user)
    if c is None:  # inconsistent state; treat as pending without a request (resend creates none)
        return ConsentStatus(PENDING, None, None, None)
    return ConsentStatus(PENDING, mask_email(c.parent_email), c.expires_at, c.last_sent_at + RESEND_AFTER)


def resend(db: Session, user: User, now: datetime | None = None) -> ConsentStatus:
    """A new link replaces the old one. The deadline doesn't move: it counts from registration."""
    require_email()
    now = now or datetime.now(UTC)
    c = _pending(db, user) if user.parental_consent_status == PENDING else None
    if c is None:
        raise AppError("consent_not_pending", "No parental consent is pending.", status.HTTP_409_CONFLICT)
    if now < c.last_sent_at + RESEND_AFTER:
        raise AppError(
            "rate_limited", "Please wait before sending another email.", status.HTTP_429_TOO_MANY_REQUESTS
        )
    token = secrets.token_urlsafe(32)
    c.token_hash = _hash(token)
    c.last_sent_at = now
    db.flush()
    _send(user, c, token)
    return get_status(db, user)


@dataclass(frozen=True)
class LinkTarget:
    consent: ParentalConsent
    user: User


def find(db: Session, token: str, now: datetime | None = None) -> LinkTarget | None:
    """The pending, unexpired request behind a link, or None (unknown, replaced, used or expired)."""
    now = now or datetime.now(UTC)
    c = db.scalar(select(ParentalConsent).where(ParentalConsent.token_hash == _hash(token)))
    if c is None or c.granted_at is not None or c.expires_at <= now:
        return None
    user = db.get(User, c.user_id)
    return LinkTarget(c, user) if user is not None else None


def grant(db: Session, target: LinkTarget, now: datetime | None = None) -> None:
    target.consent.granted_at = now or datetime.now(UTC)
    target.user.parental_consent_status = GRANTED
    db.flush()
    logger.info("Parental consent granted user=%s policy=%s", target.user.id, target.consent.policy_version)


def refuse(db: Session, target: LinkTarget) -> None:
    """Deletes the child's account; every related row goes with it (ON DELETE CASCADE)."""
    user_id = target.user.id
    db.delete(target.user)
    db.flush()
    logger.info("Parental consent refused; account deleted user=%s", user_id)


def delete_if_expired(db: Session, user: User, now: datetime | None = None) -> bool:
    """At sign-in: an account whose request expired unanswered is deleted on the spot, so it never
    depends on the hourly purge having run."""
    if user.parental_consent_status != PENDING:
        return False
    c = _pending(db, user)
    if c is None or c.expires_at > (now or datetime.now(UTC)):
        return False
    user_id = user.id
    db.delete(user)
    # Committed here: the caller then rejects the sign-in, and the request's rollback-on-error
    # must not bring the account back.
    db.commit()
    logger.info("Expired parental consent; account deleted at sign-in user=%s", user_id)
    return True


def purge_expired(db: Session, now: datetime | None = None) -> int:
    """Deletes accounts whose consent request expired unanswered. Returns how many."""
    now = now or datetime.now(UTC)
    expired = select(ParentalConsent.user_id).where(
        ParentalConsent.granted_at.is_(None), ParentalConsent.expires_at <= now
    )
    result = db.execute(
        delete(User)
        .where(User.id.in_(expired), User.parental_consent_status == PENDING)
        .execution_options(synchronize_session=False)
    )
    count = int(getattr(result, "rowcount", 0) or 0)
    if count:
        logger.info("Purged %d account(s) with expired parental consent", count)
    return count

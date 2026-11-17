"""Parental consent routes.

- Public (`/consent/parental/{token}`): the parent's link. GET only shows the page, because email
  scanners and previewers fetch links. Only the POST from the page's form records a decision.
- Authenticated (`/me/parental-consent`): the child's app reads the status and can resend the email.
  These work while the account is locked.
"""

from datetime import datetime
from typing import Literal
from urllib.parse import parse_qs

from fastapi import APIRouter, Depends, Request
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import DB
from app.modules.auth.deps import get_user_allow_pending
from app.modules.consent import pages, service
from app.modules.users.models import User

public_router = APIRouter(prefix="/consent", tags=["consent"])
me_router = APIRouter(prefix="/me/parental-consent", tags=["consent"])


class ConsentStatusOut(BaseModel):
    status: Literal["not_required", "pending", "granted"]
    parent_email_masked: str | None
    expires_at: datetime | None
    can_resend_at: datetime | None


def _out(s: service.ConsentStatus) -> ConsentStatusOut:
    return ConsentStatusOut(
        status=s.status,
        parent_email_masked=s.parent_email_masked,
        expires_at=s.expires_at,
        can_resend_at=s.can_resend_at,
    )


@me_router.get("", response_model=ConsentStatusOut)
def consent_status(
    user: User = Depends(get_user_allow_pending), db: Session = DB
) -> ConsentStatusOut:
    return _out(service.get_status(db, user))


@me_router.post("/resend", response_model=ConsentStatusOut)
def resend(user: User = Depends(get_user_allow_pending), db: Session = DB) -> ConsentStatusOut:
    return _out(service.resend(db, user))


def _html(content: str, status_code: int = 200) -> HTMLResponse:
    return HTMLResponse(content, status_code, headers={"Content-Security-Policy": pages.CSP})


@public_router.get("/parental/{token}", response_class=HTMLResponse, include_in_schema=False)
def consent_page(token: str, db: Session = DB) -> HTMLResponse:
    target = service.find(db, token)
    if target is None:
        return _html(pages.message("en", "invalid"), 404)
    action = f"{get_settings().api_prefix}/consent/parental/{token}"
    return _html(pages.consent_form(target.user.preferred_locale, target.user.email, action))


@public_router.post("/parental/{token}", response_class=HTMLResponse, include_in_schema=False)
async def consent_decision(token: str, request: Request, db: Session = DB) -> HTMLResponse:
    # A plain HTML form post; parsed here to avoid a multipart dependency for one field.
    form = parse_qs((await request.body()).decode("utf-8", "replace"))
    decision = (form.get("decision") or [""])[0]
    target = service.find(db, token)
    if target is None or decision not in ("grant", "refuse"):
        return _html(pages.message("en", "invalid"), 404 if target is None else 400)
    lang = target.user.preferred_locale
    if decision == "grant":
        service.grant(db, target)
        return _html(pages.message(lang, "granted"))
    service.refuse(db, target)
    return _html(pages.message(lang, "refused"))

import logging
import smtplib
from email.message import EmailMessage
from functools import lru_cache
from pathlib import Path
from typing import Any, Protocol

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from app.core.config import Settings, get_settings

logger = logging.getLogger("app.email")

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates" / "email"

_env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html"]),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)


class EmailSender(Protocol):
    def send(self, to: str, subject: str, html: str, text: str) -> None: ...


class SmtpEmailSender:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def send(self, to: str, subject: str, html: str, text: str) -> None:
        s = self._settings
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = s.smtp_from
        message["To"] = to
        message.set_content(text)
        message.add_alternative(html, subtype="html")
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as smtp:
            if s.smtp_starttls:
                smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(message)


@lru_cache
def get_email_sender() -> EmailSender:
    return SmtpEmailSender(get_settings())


def render(template: str, **context: Any) -> tuple[str, str]:
    """Render `<template>.html` and `<template>.txt`; returns (html, text)."""
    html = _env.get_template(f"{template}.html").render(**context)
    text = _env.get_template(f"{template}.txt").render(**context)
    return html, text


def send_email(to: str, subject: str, template: str, **context: Any) -> None:
    """Render and send an email; failures are logged and never propagated."""
    try:
        html, text = render(template, subject=subject, **context)
        get_email_sender().send(to, subject, html, text)
    except Exception:
        logger.exception("Failed to send %r email to %s", template, to)

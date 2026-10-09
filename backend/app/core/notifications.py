"""Notification stubs: they only log until phase 04 implements real emails."""

import logging

from app.core.config import get_settings
from app.models import User

logger = logging.getLogger("app.notifications")


def notify_verify_email(user: User, token: str) -> None:
    link = f"{get_settings().frontend_url}/verify-email?token={token}"
    logger.info("Verify email for %s: %s", user.email, link)


def notify_password_reset(user: User, token: str) -> None:
    link = f"{get_settings().frontend_url}/reset-password?token={token}"
    logger.info("Password reset for %s: %s", user.email, link)

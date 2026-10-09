"""Send 24-hour reminders for confirmed bookings.

Run with: python -m app.jobs.send_reminders
"""

import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core import notifications
from app.db.session import SessionLocal
from app.models import Booking, BookingStatus
from app.services.bookings import booking_email_data

logger = logging.getLogger("app.jobs.send_reminders")

REMINDER_WINDOW = timedelta(hours=24)


def send_reminders(db: Session, now: datetime | None = None) -> int:
    """Claim due bookings, commit, then send. Returns how many reminders were sent.

    Bookings are marked before sending (at-most-once): running the job twice,
    or concurrently, never duplicates an email.
    """
    now = now or datetime.now(UTC)
    due = db.scalars(
        select(Booking)
        .where(
            Booking.status == BookingStatus.confirmed,
            Booking.reminder_sent_at.is_(None),
            Booking.starts_at > now,
            Booking.starts_at <= now + REMINDER_WINDOW,
        )
        .order_by(Booking.starts_at)
        .with_for_update(skip_locked=True)
    ).all()
    emails = []
    for booking in due:
        booking.reminder_sent_at = now
        emails.append(booking_email_data(db, booking))
    db.commit()

    for data in emails:
        notifications.notify_booking_reminder(data)
    return len(emails)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    with SessionLocal() as db:
        sent = send_reminders(db)
    logger.info("Sent %d reminder(s)", sent)


if __name__ == "__main__":
    main()

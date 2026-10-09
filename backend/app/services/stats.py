from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import Booking, BookingStatus, Service, User, UserRole
from app.schemas.booking import DailyCountOut, StatsOut, TopServiceOut
from app.services.permissions import ensure_roles

STATS_DAYS = 30
TOP_SERVICES = 5


def get_stats(db: Session, actor: User, today: date | None = None) -> StatsOut:
    ensure_roles(actor, UserRole.admin)
    tz_name = get_settings().app_timezone
    tz = ZoneInfo(tz_name)
    today = today or datetime.now(tz).date()
    first_day = today - timedelta(days=STATS_DAYS - 1)

    by_status = {s: 0 for s in BookingStatus}
    for booking_status, count in db.execute(
        select(Booking.status, func.count()).group_by(Booking.status)
    ):
        by_status[booking_status] = count

    local_day = cast(func.timezone(tz_name, Booking.starts_at), Date)
    window_start = datetime.combine(first_day, time.min, tzinfo=tz).astimezone(UTC)
    window_end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=tz).astimezone(UTC)
    daily: dict[date, int] = {
        day: count
        for day, count in db.execute(
            select(local_day, func.count())
            .where(Booking.starts_at >= window_start, Booking.starts_at < window_end)
            .group_by(local_day)
        )
    }
    bookings_per_day = [
        DailyCountOut(date=day, count=daily.get(day, 0))
        for day in (first_day + timedelta(days=i) for i in range(STATS_DAYS))
    ]

    booking_count = func.count(Booking.id).label("count")
    top_services = [
        TopServiceOut(service_id=service_id, name=name, count=count)
        for service_id, name, count in db.execute(
            select(Service.id, Service.name, booking_count)
            .join(Booking, Booking.service_id == Service.id)
            .group_by(Service.id, Service.name)
            .order_by(booking_count.desc(), Service.name)
            .limit(TOP_SERVICES)
        )
    ]

    revenue = db.scalar(
        select(func.coalesce(func.sum(Service.price_cents), 0))
        .select_from(Booking)
        .join(Service, Service.id == Booking.service_id)
        .where(Booking.status == BookingStatus.completed)
    )

    return StatsOut(
        by_status=by_status,
        bookings_per_day=bookings_per_day,
        top_services=top_services,
        estimated_revenue_cents=int(revenue or 0),
    )

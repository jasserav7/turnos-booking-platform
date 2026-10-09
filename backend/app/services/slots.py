"""Pure slot generation: no database or web framework access."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

MAX_RANGE_DAYS = 31

Interval = tuple[datetime, datetime]


@dataclass(frozen=True)
class WeeklyRule:
    weekday: int  # 0 = Monday
    start_time: time
    end_time: time


@dataclass(frozen=True)
class SlotConfig:
    min_notice_minutes: int
    booking_horizon_days: int


def _overlaps(start: datetime, end: datetime, intervals: Sequence[Interval]) -> bool:
    return any(start < busy_end and busy_start < end for busy_start, busy_end in intervals)


def generate_slots(
    *,
    rules: Sequence[WeeklyRule],
    time_off: Sequence[Interval],
    bookings: Sequence[Interval],
    duration_minutes: int,
    date_from: date,
    date_to: date,
    now: datetime,
    tz: ZoneInfo,
    config: SlotConfig,
) -> list[datetime]:
    """Return the UTC start of every free slot between two local dates (inclusive)."""
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    if duration_minutes <= 0:
        raise ValueError("duration_minutes must be positive")
    if date_to < date_from:
        raise ValueError("date_to must not be before date_from")
    if (date_to - date_from).days + 1 > MAX_RANGE_DAYS:
        raise ValueError(f"range must not exceed {MAX_RANGE_DAYS} days")

    duration = timedelta(minutes=duration_minutes)
    earliest = now + timedelta(minutes=config.min_notice_minutes)
    latest = now + timedelta(days=config.booking_horizon_days)
    busy = [*time_off, *bookings]

    slots: set[datetime] = set()
    day = date_from
    while day <= date_to:
        for rule in rules:
            if rule.weekday != day.weekday():
                continue
            cursor = datetime.combine(day, rule.start_time, tzinfo=tz).astimezone(UTC)
            rule_end = datetime.combine(day, rule.end_time, tzinfo=tz).astimezone(UTC)
            while cursor + duration <= rule_end:
                slot_end = cursor + duration
                if earliest <= cursor <= latest and not _overlaps(cursor, slot_end, busy):
                    slots.add(cursor)
                cursor = slot_end
        day += timedelta(days=1)
    return sorted(slots)

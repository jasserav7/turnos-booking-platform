from collections.abc import Sequence
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.services.slots import Interval, SlotConfig, WeeklyRule, generate_slots

BOGOTA = ZoneInfo("America/Bogota")
MONDAY = date(2030, 1, 7)
NOW = datetime(2030, 1, 6, 12, 0, tzinfo=UTC)
CONFIG = SlotConfig(min_notice_minutes=60, booking_horizon_days=60)


def _utc(day: date, hour: int, minute: int = 0) -> datetime:
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=UTC)


def _local(day: date, hour: int, minute: int = 0, tz: ZoneInfo = BOGOTA) -> datetime:
    return datetime.combine(day, time(hour, minute), tzinfo=tz)


def _slots(
    rules: Sequence[WeeklyRule],
    *,
    time_off: Sequence[Interval] = (),
    bookings: Sequence[Interval] = (),
    duration: int = 60,
    date_from: date = MONDAY,
    date_to: date = MONDAY,
    now: datetime = NOW,
    tz: ZoneInfo = BOGOTA,
    config: SlotConfig = CONFIG,
) -> list[datetime]:
    return generate_slots(
        rules=rules,
        time_off=time_off,
        bookings=bookings,
        duration_minutes=duration,
        date_from=date_from,
        date_to=date_to,
        now=now,
        tz=tz,
        config=config,
    )


MORNING = WeeklyRule(0, time(9), time(12))


def test_slots_follow_weekly_rule() -> None:
    assert _slots([MORNING]) == [_utc(MONDAY, 14), _utc(MONDAY, 15), _utc(MONDAY, 16)]


def test_no_slots_on_days_without_rules() -> None:
    assert _slots([WeeklyRule(1, time(9), time(12))]) == []


def test_slots_advance_by_service_duration() -> None:
    rule = WeeklyRule(0, time(9), time(11))
    assert _slots([rule], duration=45) == [_utc(MONDAY, 14), _utc(MONDAY, 14, 45)]


def test_time_off_blocks_slots() -> None:
    time_off = [(_local(MONDAY, 10), _local(MONDAY, 11))]
    assert _slots([MORNING], time_off=time_off) == [_utc(MONDAY, 14), _utc(MONDAY, 16)]


def test_active_bookings_block_overlapping_slots() -> None:
    bookings = [
        (_local(MONDAY, 9, 30), _local(MONDAY, 10)),
        (_local(MONDAY, 11), _local(MONDAY, 12)),
    ]
    assert _slots([MORNING], bookings=bookings) == [_utc(MONDAY, 15)]


def test_adjacent_booking_does_not_block() -> None:
    bookings = [(_local(MONDAY, 8), _local(MONDAY, 9))]
    assert _slots([MORNING], bookings=bookings) == [
        _utc(MONDAY, 14),
        _utc(MONDAY, 15),
        _utc(MONDAY, 16),
    ]


def test_min_notice_is_respected() -> None:
    assert _slots([MORNING], now=_utc(MONDAY, 13, 30)) == [_utc(MONDAY, 15), _utc(MONDAY, 16)]
    assert _slots([MORNING], now=_utc(MONDAY, 13))[0] == _utc(MONDAY, 14)


def test_booking_horizon_is_respected() -> None:
    every_day = [WeeklyRule(d, time(9), time(10)) for d in range(7)]
    config = SlotConfig(min_notice_minutes=60, booking_horizon_days=2)
    slots = _slots(every_day, date_to=MONDAY + timedelta(days=6), now=NOW, config=config)
    assert slots == [_utc(MONDAY, 14)]
    assert all(slot <= NOW + timedelta(days=2) for slot in slots)


def test_timezone_changes_utc_output() -> None:
    madrid = ZoneInfo("Europe/Madrid")
    assert _slots([MORNING], tz=madrid) == [_utc(MONDAY, 8), _utc(MONDAY, 9), _utc(MONDAY, 10)]


def test_daylight_saving_transition() -> None:
    madrid = ZoneInfo("Europe/Madrid")
    saturday, sunday = date(2030, 3, 30), date(2030, 3, 31)
    rules = [WeeklyRule(5, time(9), time(10)), WeeklyRule(6, time(9), time(10))]
    now = datetime(2030, 3, 1, tzinfo=UTC)
    slots = _slots(rules, date_from=saturday, date_to=sunday, now=now, tz=madrid)
    assert slots == [_utc(saturday, 8), _utc(sunday, 7)]


def test_range_limit_and_order_validation() -> None:
    with pytest.raises(ValueError):
        _slots([MORNING], date_to=MONDAY + timedelta(days=31))
    with pytest.raises(ValueError):
        _slots([MORNING], date_to=MONDAY - timedelta(days=1))
    assert _slots([MORNING], date_to=MONDAY + timedelta(days=30))

"""Is a day a workday in China (PRD v3 §4.3, 账单日历).

"The last workday of the month" is when much of China gets paid, and a
forecaster that means to know which day that is needs two things the plain
weekend rule cannot know: the statutory holidays (国务院办公厅 announces the
arrangement year by year) and the 调休 — the Saturdays and Sundays ordered
back to work so the holidays can bridge.

WHAT IS IN THE TABLE, AND ITS EDGES. `_HOLIDAYS` is the days off and
`_MAKEUP_WORKDAYS` the weekends ordered back to work. The 2025 rows are as
announced. The 2026 rows are the best knowledge available when this was
written and are marked ESTIMATED — verify them against the 国务院办公厅
announcement before trusting a date that carries money. The table's reach is
published (`coverage()`): a day past it falls back to the plain weekday rule
and the app SAYS SO, because a payday guessed wrong is worse than one
declared unknown.

Tests pin the RULE against their own tables (see
`tests/test_the_forecast_sees_whats_coming.py`), not against these rows:
this file is data, and data is checked by reading it, not by asserting it
agrees with itself."""

from __future__ import annotations

import datetime

# Statutory days off, year by year.
_HOLIDAYS: dict[int, set[datetime.date]] = {
    # 2025, as announced (国办发明电〔2024〕8号 and the year's follow-ups).
    2025: {
        datetime.date(2025, 1, 1),  # 元旦
        # 春节 1/28 (除夕) — 2/4 (初七)
        *[datetime.date(2025, 1, d) for d in range(28, 32)],
        *[datetime.date(2025, 2, d) for d in range(1, 5)],
        # 清明 4/4 — 4/6
        datetime.date(2025, 4, 4),
        datetime.date(2025, 4, 5),
        datetime.date(2025, 4, 6),
        # 劳动节 5/1 — 5/5
        *[datetime.date(2025, 5, d) for d in range(1, 6)],
        # 端午 5/31 — 6/2
        datetime.date(2025, 5, 31),
        datetime.date(2025, 6, 1),
        datetime.date(2025, 6, 2),
        # 国庆 + 中秋 10/1 — 10/8
        *[datetime.date(2025, 10, d) for d in range(1, 9)],
    },
    # 2026 — ESTIMATED from the lunar calendar and the usual pattern. The
    # arrangement is announced late in the year before; replace these rows
    # with the announcement's and the rules below keep working unchanged.
    2026: {
        datetime.date(2026, 1, 1),
        datetime.date(2026, 1, 2),
        # 除夕 2/16 (正月初一 is 2/17): the usual week-plus bridge
        *[datetime.date(2026, 2, d) for d in range(15, 23)],
        # 清明 4/4 — 4/6
        datetime.date(2026, 4, 4),
        datetime.date(2026, 4, 5),
        datetime.date(2026, 4, 6),
        # 劳动节 5/1 — 5/5
        *[datetime.date(2026, 5, d) for d in range(1, 6)],
        # 端午 6/19 — 6/21
        datetime.date(2026, 6, 19),
        datetime.date(2026, 6, 20),
        datetime.date(2026, 6, 21),
        # 中秋 9/25 — 9/27
        datetime.date(2026, 9, 25),
        datetime.date(2026, 9, 26),
        datetime.date(2026, 9, 27),
        # 国庆 10/1 — 10/8
        *[datetime.date(2026, 10, d) for d in range(1, 9)],
    },
}

# Which years' rows are estimates rather than announcements. Said in
# `coverage()` and printed by the app beside any date they decide.
_ESTIMATED_YEARS = {2026}

# The weekends ordered BACK to work (调休), year by year.
_MAKEUP_WORKDAYS: dict[int, set[datetime.date]] = {
    2025: {
        datetime.date(2025, 1, 26),  # Sunday, for 春节
        datetime.date(2025, 2, 8),  # Saturday, for 春节
        datetime.date(2025, 4, 27),  # Sunday, for 劳动节
        datetime.date(2025, 9, 28),  # Sunday, for 国庆
        datetime.date(2025, 10, 11),  # Saturday, for 国庆
    },
    # ESTIMATED, as the holidays above.
    2026: {
        datetime.date(2026, 2, 14),  # Saturday, for 春节
        datetime.date(2026, 2, 28),  # Saturday, for 春节
        datetime.date(2026, 5, 9),  # Saturday, for 劳动节
        datetime.date(2026, 10, 10),  # Saturday, for 国庆
    },
}


def coverage() -> dict:
    """What the table knows, so the app can say it out loud.

    A day outside it is decided by the weekday rule alone: weekends are off,
    and there is no knowledge of holidays. Never silent — see the forecast's
    `calendar_covers`."""
    years = sorted(_HOLIDAYS)
    return {
        "from": f"{years[0]}-01-01",
        "to": f"{years[-1]}-12-31",
        "estimated_years": sorted(_ESTIMATED_YEARS),
    }


def is_workday(day: datetime.date) -> bool:
    """Is `day` a day people go to work in China.

    A weekend ordered back to work counts as one even though it is a
    weekend; a holiday counts as not even when it falls on a weekday."""
    if day in _MAKEUP_WORKDAYS.get(day.year, ()):
        return True
    if day in _HOLIDAYS.get(day.year, ()):
        return False
    return day.weekday() < 5


def last_workday(year: int, month: int) -> datetime.date:
    """The last day of a month people go to work — the day much of China is
    paid. Walks back from the month's end until a workday answers."""
    if month == 12:
        day = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
    else:
        day = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)
    while not is_workday(day):
        day -= datetime.timedelta(days=1)
    return day

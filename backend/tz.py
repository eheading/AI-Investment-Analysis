"""Timezone utilities — all display timestamps use UTC+8 (HKT)."""

from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Optional

HKT = timezone(timedelta(hours=8))


def now_hkt() -> datetime:
    """Return current time in UTC+8 (HKT), timezone-aware."""
    return datetime.now(HKT)


def format_hkt(dt: Optional[datetime]) -> Optional[str]:
    """Format a datetime as an ISO string in UTC+8.

    Naive datetimes (from SQLite ``func.now()``) are assumed to be UTC.
    """
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(HKT).isoformat()

"""Pre-market data collector for US market open predictions.

Fetches US index futures, sector ETF pre-market prices, VIX, Treasury yields,
and overnight global market data to build a comprehensive pre-market picture.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import yfinance as yf
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import PriceSnapshot, NewsArticle

logger = logging.getLogger(__name__)

# US Index Futures
US_FUTURES = [
    ("ES=F", "S&P 500 Futures"),
    ("NQ=F", "NASDAQ 100 Futures"),
    ("YM=F", "Dow Jones Futures"),
    ("RTY=F", "Russell 2000 Futures"),
]

# SPDR Sector ETFs
SECTOR_ETFS = [
    ("XLK", "Technology"),
    ("XLF", "Financials"),
    ("XLE", "Energy"),
    ("XLV", "Healthcare"),
    ("XLY", "Consumer Discretionary"),
    ("XLP", "Consumer Staples"),
    ("XLI", "Industrials"),
    ("XLB", "Materials"),
    ("XLRE", "Real Estate"),
    ("XLU", "Utilities"),
    ("XLC", "Communication Services"),
]

# Volatility & Rates
VOLATILITY_RATES = [
    ("^VIX", "VIX"),
    ("^TNX", "10Y Treasury Yield"),
    ("^TYX", "30Y Treasury Yield"),
    ("^FVX", "5Y Treasury Yield"),
]


def _fetch_ticker_data(symbol: str) -> dict | None:
    """Fetch current/pre-market data for a single ticker via fast_info."""
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = info.get("lastPrice") or info.get("last_price")
        prev = info.get("previousClose") or info.get("previous_close")
        if price is None:
            return None
        change_pct = ((price - prev) / prev * 100) if prev else None
        return {
            "symbol": symbol,
            "price": float(price),
            "prev_close": float(prev) if prev else None,
            "change_pct": round(change_pct, 2) if change_pct is not None else None,
        }
    except Exception:
        logger.debug("Could not fetch pre-market data for %s", symbol)
        return None


def _fetch_all_premarket() -> dict:
    """Fetch all pre-market data using threaded yfinance calls."""
    all_items = (
        [("futures", s, n) for s, n in US_FUTURES]
        + [("sector_etfs", s, n) for s, n in SECTOR_ETFS]
        + [("volatility_rates", s, n) for s, n in VOLATILITY_RATES]
    )

    results: dict[str, list] = {"futures": [], "sector_etfs": [], "volatility_rates": []}

    def _fetch(item):
        category, symbol, name = item
        data = _fetch_ticker_data(symbol)
        if data:
            data["name"] = name
            return category, data
        return category, None

    with ThreadPoolExecutor(max_workers=10) as pool:
        for category, data in pool.map(_fetch, all_items):
            if data is not None:
                results[category].append(data)

    logger.info(
        "Pre-market fetch: %d futures, %d sector ETFs, %d vol/rates",
        len(results["futures"]),
        len(results["sector_etfs"]),
        len(results["volatility_rates"]),
    )
    return results


async def collect_premarket_data(db_session: AsyncSession) -> dict:
    """Collect all pre-market data including overnight global markets and recent news.

    Returns a dict with keys: futures, sector_etfs, volatility_rates,
    global_markets, recent_news, collected_at.
    """
    import asyncio

    loop = asyncio.get_event_loop()
    premarket = await loop.run_in_executor(None, _fetch_all_premarket)

    # Overnight global markets from existing price snapshots
    global_markets = await _get_overnight_global(db_session)
    premarket["global_markets"] = global_markets

    # Recent news (last 12 hours)
    recent_news = await _get_recent_news(db_session)
    premarket["recent_news"] = recent_news

    premarket["collected_at"] = datetime.utcnow().isoformat()
    return premarket


async def _get_overnight_global(db_session: AsyncSession) -> list[dict]:
    """Get latest prices for non-US indices, commodities, crypto, currencies."""
    subquery = (
        select(
            PriceSnapshot.symbol,
            func.max(PriceSnapshot.id).label("max_id"),
        )
        .where(PriceSnapshot.region != "US")
        .group_by(PriceSnapshot.symbol)
        .subquery()
    )
    result = await db_session.execute(
        select(PriceSnapshot).join(subquery, PriceSnapshot.id == subquery.c.max_id)
    )
    snapshots = result.scalars().all()
    return [
        {
            "symbol": s.symbol,
            "name": s.name,
            "price": s.price,
            "change_pct": s.change_pct,
            "category": s.category,
            "region": s.region,
        }
        for s in snapshots
    ]


async def _get_recent_news(db_session: AsyncSession, hours: int = 12) -> list[dict]:
    """Get news articles from the last N hours."""
    cutoff = datetime.utcnow() - timedelta(hours=hours)
    result = await db_session.execute(
        select(NewsArticle)
        .where(NewsArticle.published_at >= cutoff)
        .order_by(NewsArticle.published_at.desc())
        .limit(30)
    )
    articles = result.scalars().all()
    return [
        {
            "title": a.title,
            "summary": a.summary[:200] if a.summary else None,
            "source": a.source,
            "published_at": a.published_at.isoformat() if a.published_at else None,
        }
        for a in articles
    ]


def format_premarket_for_prompt(data: dict) -> tuple[str, str]:
    """Format pre-market data into market_data and news_data strings for AI prompt."""
    lines = ["=== US Pre-Market Data ===\n"]

    # Futures
    if data.get("futures"):
        lines.append("-- US Index Futures --")
        for f in data["futures"]:
            direction = "▲" if (f.get("change_pct") or 0) >= 0 else "▼"
            lines.append(
                f"  {f['name']} ({f['symbol']}): {f['price']:,.2f} "
                f"({direction} {abs(f.get('change_pct') or 0):.2f}%)"
            )
        lines.append("")

    # Sector ETFs
    if data.get("sector_etfs"):
        lines.append("-- Sector ETF Pre-Market Moves --")
        sorted_etfs = sorted(data["sector_etfs"], key=lambda x: x.get("change_pct") or 0, reverse=True)
        for e in sorted_etfs:
            direction = "▲" if (e.get("change_pct") or 0) >= 0 else "▼"
            lines.append(
                f"  {e['name']} ({e['symbol']}): {e['price']:,.2f} "
                f"({direction} {abs(e.get('change_pct') or 0):.2f}%)"
            )
        lines.append("")

    # VIX & Yields
    if data.get("volatility_rates"):
        lines.append("-- Volatility & Treasury Yields --")
        for v in data["volatility_rates"]:
            direction = "▲" if (v.get("change_pct") or 0) >= 0 else "▼"
            lines.append(
                f"  {v['name']} ({v['symbol']}): {v['price']:,.2f} "
                f"({direction} {abs(v.get('change_pct') or 0):.2f}%)"
            )
        lines.append("")

    # Global overnight
    if data.get("global_markets"):
        lines.append("-- Overnight Global Markets --")
        grouped: dict[str, list] = {}
        for g in data["global_markets"]:
            key = f"{g['category']} ({g['region']})"
            grouped.setdefault(key, []).append(g)
        for cat, items in sorted(grouped.items()):
            lines.append(f"  [{cat.upper()}]")
            for g in items:
                direction = "▲" if (g.get("change_pct") or 0) >= 0 else "▼"
                lines.append(
                    f"    {g['name']} ({g['symbol']}): {g['price']:,.4f} "
                    f"({direction} {abs(g.get('change_pct') or 0):.2f}%)"
                )
        lines.append("")

    market_data = "\n".join(lines)

    # News
    news_lines = []
    if data.get("recent_news"):
        news_lines.append("=== Overnight / Pre-Market News (last 12h) ===\n")
        for i, n in enumerate(data["recent_news"], 1):
            source_tag = f"[{n['source']}]" if n.get("source") else ""
            news_lines.append(f"{i}. {source_tag} {n['title']}")
            if n.get("summary"):
                news_lines.append(f"   {n['summary']}")
            news_lines.append("")

    news_data = "\n".join(news_lines)
    return market_data, news_data

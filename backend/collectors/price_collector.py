"""Collect price data for global market instruments using yfinance."""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime

import yfinance as yf
from database import PriceSnapshot

logger = logging.getLogger(__name__)

SYMBOLS = {
    "index": {
        "US": [
            ("^GSPC", "S&P 500"), ("^DJI", "Dow Jones"), ("^IXIC", "NASDAQ"), ("^RUT", "Russell 2000")
        ],
        "EU": [
            ("^FTSE", "FTSE 100"), ("^GDAXI", "DAX"), ("^FCHI", "CAC 40"), ("^STOXX50E", "Euro Stoxx 50")
        ],
        "ASIA": [
            ("^N225", "Nikkei 225"), ("^HSI", "Hang Seng"), ("000001.SS", "Shanghai Composite"),
            ("^KS11", "KOSPI"), ("^BSESN", "BSE Sensex"), ("^AXJO", "ASX 200")
        ],
    },
    "commodity": {
        "GLOBAL": [
            ("GC=F", "Gold"), ("SI=F", "Silver"), ("CL=F", "Crude Oil WTI"),
            ("BZ=F", "Brent Crude"), ("NG=F", "Natural Gas"), ("HG=F", "Copper")
        ]
    },
    "crypto": {
        "GLOBAL": [("BTC-USD", "Bitcoin"), ("ETH-USD", "Ethereum")]
    },
    "currency": {
        "GLOBAL": [
            ("DX-Y.NYB", "US Dollar Index"), ("EURUSD=X", "EUR/USD"),
            ("GBPUSD=X", "GBP/USD"), ("JPY=X", "USD/JPY"), ("CNY=X", "USD/CNY")
        ]
    }
}


def _build_symbol_map() -> dict:
    """Build a flat lookup: symbol -> (name, category, region)."""
    smap = {}
    for category, regions in SYMBOLS.items():
        for region, tickers in regions.items():
            for symbol, name in tickers:
                smap[symbol] = (name, category, region)
    return smap


def _fetch_batch_prices() -> list[dict]:
    """Fetch all prices using intraday data for real-time accuracy.

    Uses ``period="1d", interval="1m"`` to get the latest 1-minute candle,
    which reflects the most recent traded price during market hours.
    Falls back to ``period="5d"`` daily data for symbols where intraday fails.
    Uses ``previousClose`` from ``fast_info`` for accurate daily change calculation.
    """
    symbol_map = _build_symbol_map()
    all_symbols = list(symbol_map.keys())
    now = datetime.utcnow()

    results = []

    # Try intraday 1-minute data first for real-time prices
    try:
        data = yf.download(all_symbols, period="1d", interval="1m", progress=False, threads=True)
    except Exception:
        logger.warning("Intraday yf.download failed, falling back to daily data")
        data = None

    # Fallback to daily data if intraday returned nothing
    if data is None or data.empty:
        try:
            data = yf.download(all_symbols, period="5d", progress=False, threads=True)
        except Exception:
            logger.exception("yf.download batch call failed")
            return results

    if data.empty:
        logger.warning("yf.download returned empty DataFrame")
        return results

    # Fetch previousClose for each symbol via fast_info (threaded)
    prev_close_map = _fetch_previous_closes(all_symbols)

    multi_ticker = len(all_symbols) > 1

    for symbol in all_symbols:
        try:
            name, category, region = symbol_map[symbol]

            # yfinance 1.2+ returns MultiIndex columns: (Price, Ticker)
            if multi_ticker:
                if ('Close', symbol) not in data.columns:
                    logger.warning("No data returned for %s (%s)", symbol, name)
                    continue
                close_series = data[('Close', symbol)].dropna()
                vol_series = data[('Volume', symbol)].dropna() if ('Volume', symbol) in data.columns else None
            else:
                close_series = data['Close'].dropna()
                vol_series = data['Volume'].dropna() if 'Volume' in data.columns else None

            if close_series.empty:
                logger.warning("No valid close price for %s (%s)", symbol, name)
                continue

            close = float(close_series.iloc[-1])

            # Use previousClose from fast_info (most accurate), fall back to iloc[-2]
            prev = prev_close_map.get(symbol)
            if prev is None and len(close_series) >= 2:
                prev = float(close_series.iloc[-2])
            change_pct = ((close - prev) / prev * 100) if prev else None

            volume = None
            if vol_series is not None and not vol_series.empty:
                v = vol_series.iloc[-1]
                if v == v:  # not NaN
                    volume = int(v)

            results.append({
                "symbol": symbol,
                "name": name,
                "price": close,
                "change_pct": change_pct,
                "volume": volume,
                "market_cap": None,
                "category": category,
                "region": region,
                "fetched_at": now,
            })
            logger.info("Collected %s (%s): %.4f", symbol, name, close)

        except Exception:
            logger.exception("Failed to process data for %s", symbol)

    return results


def _fetch_previous_closes(symbols: list[str]) -> dict[str, float]:
    """Fetch previousClose for each symbol using fast_info, threaded for speed."""
    from concurrent.futures import ThreadPoolExecutor

    def _get_prev(symbol: str):
        try:
            info = yf.Ticker(symbol).fast_info
            prev = info.get("previousClose") or info.get("previous_close")
            if prev and prev == prev:  # not NaN
                return symbol, float(prev)
        except Exception:
            logger.debug("Could not get previousClose for %s", symbol)
        return symbol, None

    result = {}
    with ThreadPoolExecutor(max_workers=10) as pool:
        for symbol, prev in pool.map(_get_prev, symbols):
            if prev is not None:
                result[symbol] = prev

    logger.info("Fetched previousClose for %d/%d symbols", len(result), len(symbols))
    return result


async def collect_prices(async_session) -> list[PriceSnapshot]:
    """Collect current prices for all configured symbols.

    Uses yf.download() batch API in a thread executor.
    Stores results via the provided async session.
    """
    loop = asyncio.get_event_loop()
    raw = await loop.run_in_executor(None, _fetch_batch_prices)

    snapshots = []
    for item in raw:
        snapshot = PriceSnapshot(**item)
        async_session.add(snapshot)
        snapshots.append(snapshot)

    if snapshots:
        await async_session.commit()
        logger.info("Inserted %d price snapshots", len(snapshots))

    return snapshots


async def get_latest_prices(async_session) -> list[PriceSnapshot]:
    """Return the most recent snapshot for each unique symbol."""
    from sqlalchemy import select, func
    subquery = (
        select(
            PriceSnapshot.symbol,
            func.max(PriceSnapshot.id).label("max_id"),
        )
        .group_by(PriceSnapshot.symbol)
        .subquery()
    )
    result = await async_session.execute(
        select(PriceSnapshot).join(subquery, PriceSnapshot.id == subquery.c.max_id)
    )
    return result.scalars().all()


async def fetch_live_prices() -> list[dict]:
    """Fetch live prices directly from yfinance without DB storage.

    Returns dicts matching the PriceSnapshot schema for frontend consumption.
    """
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_batch_prices)

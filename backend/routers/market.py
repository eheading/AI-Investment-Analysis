from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import get_db, PriceSnapshot
from collectors.price_collector import collect_prices, get_latest_prices

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/prices")
async def get_prices(session: AsyncSession = Depends(get_db)):
    """Get latest prices for all tracked symbols (most recent per symbol)."""
    prices = await get_latest_prices(session)
    return [
        {
            "id": p.id, "symbol": p.symbol, "name": p.name, "price": p.price,
            "change_pct": p.change_pct, "volume": p.volume, "market_cap": p.market_cap,
            "category": p.category, "region": p.region, "fetched_at": str(p.fetched_at),
        }
        for p in prices
    ]


@router.get("/prices/{symbol}")
async def get_price_history(symbol: str, limit: int = 100, session: AsyncSession = Depends(get_db)):
    """Get price history for a specific symbol."""
    result = await session.execute(
        select(PriceSnapshot)
        .where(PriceSnapshot.symbol == symbol)
        .order_by(PriceSnapshot.fetched_at.desc())
        .limit(limit)
    )
    prices = result.scalars().all()
    return [
        {
            "id": p.id, "symbol": p.symbol, "name": p.name, "price": p.price,
            "change_pct": p.change_pct, "fetched_at": str(p.fetched_at),
        }
        for p in prices
    ]


@router.post("/refresh")
async def refresh_prices(session: AsyncSession = Depends(get_db)):
    """Manually trigger price collection."""
    snapshots = await collect_prices(session)
    return {"count": len(snapshots), "message": f"Collected {len(snapshots)} price snapshots"}


@router.get("/ohlc/{symbol}")
async def get_ohlc(
    symbol: str,
    period: str = Query("6mo", regex="^(1mo|3mo|6mo|1y|2y|5y|max)$"),
):
    """Get OHLC data for a symbol using yfinance. Runs in thread executor."""
    import asyncio
    import yfinance as yf

    def _fetch():
        df = yf.download(symbol, period=period)
        if df.empty:
            return []
        # yfinance 1.2.0 returns MultiIndex columns (Price, Ticker)
        cols = df.columns
        if isinstance(cols, __import__('pandas').MultiIndex):
            df.columns = [c[0] for c in cols]
        rows = []
        for idx, row in df.iterrows():
            rows.append({
                "time": idx.strftime("%Y-%m-%d"),
                "open": round(float(row["Open"]), 4),
                "high": round(float(row["High"]), 4),
                "low": round(float(row["Low"]), 4),
                "close": round(float(row["Close"]), 4),
                "volume": int(row["Volume"]) if row["Volume"] == row["Volume"] else 0,
            })
        return rows

    loop = asyncio.get_event_loop()
    data = await loop.run_in_executor(None, _fetch)
    return data

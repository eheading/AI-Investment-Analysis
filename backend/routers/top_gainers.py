"""Top gainers scraper and AI analysis router."""

import logging
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from ai.openrouter import OpenRouterClient
from config import get_settings
from database import get_db, Setting
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/top-gainers", tags=["top-gainers"])

URLS = {
    "US": "https://finance.yahoo.com/markets/stocks/gainers/",
    "HK": "https://hk.finance.yahoo.com/markets/stocks/gainers/",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
}


def _parse_table(html: str) -> list[dict]:
    """Parse Yahoo Finance gainers table HTML into list of dicts.

    Yahoo Finance table columns (as of 2026):
    Symbol | Name | (icon) | Price | Change | Change% | Volume | Avg Vol | Market Cap | ...
    The price cell often merges price+change+pct into one text blob.
    """
    soup = BeautifulSoup(html, "lxml")
    table = soup.select_one("table")
    if not table:
        return []

    # Detect column layout from headers
    headers = [th.get_text(strip=True).lower() for th in table.select("thead th")]
    col_map = {}
    for i, h in enumerate(headers):
        if h == "symbol":
            col_map["symbol"] = i
        elif h == "name":
            col_map["name"] = i
        elif h == "price":
            col_map["price"] = i
        elif h == "change":
            col_map["change"] = i
        elif h in ("change %", "change%"):
            col_map["change_pct"] = i
        elif h == "volume":
            col_map["volume"] = i
        elif h == "market cap":
            col_map["market_cap"] = i

    # Fallback to legacy positions if headers are missing
    sym_i = col_map.get("symbol", 0)
    name_i = col_map.get("name", 1)
    price_i = col_map.get("price", 3)
    change_i = col_map.get("change", 4)
    pct_i = col_map.get("change_pct", 5)
    vol_i = col_map.get("volume", 6)
    cap_i = col_map.get("market_cap", 8)

    min_cells = max(sym_i, name_i, price_i, change_i, pct_i, vol_i) + 1

    rows = table.select("tbody tr")
    results = []
    for row in rows:
        cells = row.select("td")
        if len(cells) < min_cells:
            continue

        symbol = cells[sym_i].get_text(strip=True)
        name = cells[name_i].get_text(strip=True)
        change_text = cells[change_i].get_text(strip=True)
        change_pct_text = cells[pct_i].get_text(strip=True)
        volume = cells[vol_i].get_text(strip=True)
        market_cap = cells[cap_i].get_text(strip=True) if len(cells) > cap_i else ""

        # Price cell often contains price+change+pct merged together.
        # Extract the leading numeric price from the blob.
        price_text = cells[price_i].get_text(strip=True)
        price = _extract_price(price_text, change_text)

        results.append({
            "symbol": symbol,
            "name": name,
            "price": price,
            "change": change_text,
            "change_pct": change_pct_text,
            "volume": volume,
            "market_cap": market_cap,
        })

    return results


import re

_PRICE_RE = re.compile(r"^[\d,]+\.?\d*")


def _extract_price(price_text: str, change_text: str) -> str:
    """Extract the clean price from a potentially merged price+change string."""
    if not price_text:
        return ""
    # If the change value is embedded, strip it
    if change_text and change_text in price_text:
        price_text = price_text.split(change_text)[0]
    # Strip any trailing +/- that precedes the change portion
    price_text = price_text.rstrip("+-")
    # Final regex extraction of leading number
    m = _PRICE_RE.match(price_text)
    return m.group(0) if m else price_text


async def _scrape_active(market: str) -> list[dict]:
    """Scrape top gainers for the given market."""
    url = URLS.get(market.upper())
    if not url:
        raise HTTPException(status_code=400, detail=f"Unknown market: {market}. Use US or HK.")

    async with httpx.AsyncClient(headers=HEADERS, timeout=20.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return _parse_table(resp.text)


@router.get("/{market}")
async def get_active_stocks(market: str):
    """Scrape and return top gaining stocks for a market (US or HK)."""
    try:
        stocks = await _scrape_active(market)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch data: {exc}")
    return JSONResponse(
        content={"market": market.upper(), "stocks": stocks},
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )


class AnalyzeRequest(BaseModel):
    market: str
    symbols: Optional[list[str]] = None


@router.post("/analyze")
async def analyze_active_stocks(req: AnalyzeRequest, session: AsyncSession = Depends(get_db)):
    """Scrape top gainers and run AI analysis on them."""
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env file.",
        )

    try:
        stocks = await _scrape_active(req.market)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch data: {exc}")

    if not stocks:
        raise HTTPException(status_code=404, detail="No top gainers data found.")

    # Filter by symbols if specified
    if req.symbols:
        symbol_set = {s.upper() for s in req.symbols}
        stocks = [s for s in stocks if s["symbol"].upper() in symbol_set]
        if not stocks:
            raise HTTPException(status_code=404, detail="None of the specified symbols found.")

    # Build prompt
    stock_lines = "\n".join(
        f"- {s['symbol']} ({s['name']}): Price={s['price']}, Change={s['change']} ({s['change_pct']}), "
        f"Volume={s['volume']}, MarketCap={s['market_cap']}"
        for s in stocks
    )

    prompt = f"""Analyze the following gainers stocks from the {req.market.upper()} market.

{stock_lines}

For each stock, provide:
1. **Price Change Reasonableness** — Is the price change reasonable or unusual?
2. **Likely Reasons** — What are the most probable reasons behind the price movement?
3. **Related News** — Any recent news, earnings, or events that could explain the movement.
4. **Short-term Outlook** — Your assessment of the stock's short-term direction with a confidence level (Low/Medium/High).

End with a brief overall market sentiment summary for these top gainers.
Format your response in clear markdown with headers for each stock."""

    # Determine model
    model_row = await session.execute(
        select(Setting).where(Setting.key == "openrouter_model")
    )
    row = model_row.scalars().first()
    model = row.value if row and row.value else None

    client = OpenRouterClient()
    try:
        analysis = await client.chat_completion(
            messages=[
                {"role": "system", "content": "You are a senior financial analyst. Provide concise, data-driven analysis."},
                {"role": "user", "content": prompt},
            ],
            model=model,
            temperature=0.4,
            max_tokens=40000,
        )
    except Exception as exc:
        await client.close()
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {exc}")
    finally:
        await client.close()

    return {
        "market": req.market.upper(),
        "stocks": stocks,
        "analysis": analysis,
        "model_used": model or client._default_model,
    }


class MoneyFlowRequest(BaseModel):
    market: str


@router.post("/money-flow")
async def analyze_money_flow(req: MoneyFlowRequest, session: AsyncSession = Depends(get_db)):
    """Analyse sector money flow from gainers stocks."""
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env file.",
        )

    try:
        stocks = await _scrape_active(req.market)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch data: {exc}")

    if not stocks:
        raise HTTPException(status_code=404, detail="No top gainers data found.")

    stock_lines = "\n".join(
        f"- {s['symbol']} ({s['name']}): Change={s['change']} ({s['change_pct']}), "
        f"Volume={s['volume']}, MarketCap={s['market_cap']}"
        for s in stocks
    )

    prompt = f"""You are a senior financial analyst specialising in money flow and sector rotation analysis.

Below are the gainers stocks from the {req.market.upper()} market today:

{stock_lines}

Based on these top gainers, perform the following analysis:

## 1. Sector Classification
Classify each stock into its industry sector (e.g., Technology, Healthcare, Energy, Finance, Consumer Discretionary, Industrials, etc.).

## 2. Money Flow Analysis
Analyse the overall money flow pattern:
- Which sectors are seeing **net inflows** (money flowing IN) — based on positive price changes and high volume?
- Which sectors are seeing **net outflows** (money flowing OUT) — based on negative price changes and high volume?

## 3. Favoured Sectors (Money Flowing In)
For each favoured sector:
- Explain WHY money is flowing into this sector (macro trends, news catalysts, earnings).
- Suggest **3-5 additional stock symbols** in that sector that investors should watch or consider buying. Include a one-line reason for each suggestion.

## 4. Avoided Sectors (Money Flowing Out)
For each avoided sector:
- Explain WHY money is flowing out (headwinds, negative catalysts, sector rotation).
- Suggest **3-5 stock symbols** in that sector that are most at risk or could be short candidates. Include a one-line reason for each.

## 5. Overall Money Flow Summary
Provide a brief overall conclusion on where smart money is rotating to and from, and any actionable insights.

Format your response in clear markdown. Use tables where helpful."""

    model_row = await session.execute(
        select(Setting).where(Setting.key == "openrouter_model")
    )
    row = model_row.scalars().first()
    model = row.value if row and row.value else None

    client = OpenRouterClient()
    try:
        analysis = await client.chat_completion(
            messages=[
                {"role": "system", "content": "You are a senior financial analyst specialising in institutional money flow and sector rotation. Provide data-driven, actionable analysis with specific stock symbols."},
                {"role": "user", "content": prompt},
            ],
            model=model,
            temperature=0.4,
            max_tokens=40000,
        )
    except Exception as exc:
        await client.close()
        raise HTTPException(status_code=502, detail=f"AI money flow analysis failed: {exc}")
    finally:
        await client.close()

    return {
        "market": req.market.upper(),
        "analysis": analysis,
        "model_used": model or client._default_model,
    }

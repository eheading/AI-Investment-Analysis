"""Active stocks scraper and AI analysis router."""

import logging
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ai.openrouter import OpenRouterClient
from config import get_settings
from database import get_db, Setting
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/active-stocks", tags=["active-stocks"])

URLS = {
    "US": "https://finance.yahoo.com/markets/stocks/most-active/",
    "HK": "https://hk.finance.yahoo.com/markets/stocks/most-active/",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}


def _parse_table(html: str) -> list[dict]:
    """Parse Yahoo Finance most-active table HTML into list of dicts."""
    soup = BeautifulSoup(html, "lxml")
    table = soup.select_one("table")
    if not table:
        return []

    rows = table.select("tbody tr")
    results = []
    for row in rows:
        cells = row.select("td")
        if len(cells) < 7:
            continue

        symbol = cells[0].get_text(strip=True)
        name = cells[1].get_text(strip=True)
        price_text = cells[2].get_text(strip=True)
        change_text = cells[3].get_text(strip=True)
        change_pct_text = cells[4].get_text(strip=True)
        volume = cells[5].get_text(strip=True)
        market_cap = cells[6].get_text(strip=True)

        # Clean price: handle zero-change stocks where change value may appear in price_text
        price = price_text
        if change_text and change_text != "0.00" and change_text in price_text:
            price = price_text.replace(change_text, "", 1).strip()
        elif "+" in price_text:
            price = price_text.split("+")[0].strip()
        elif price_text.count("-") > 1:
            # Negative change embedded: split on last minus
            idx = price_text.rfind("-")
            price = price_text[:idx].strip()

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


async def _scrape_active(market: str) -> list[dict]:
    """Scrape active stocks for the given market."""
    url = URLS.get(market.upper())
    if not url:
        raise HTTPException(status_code=400, detail=f"Unknown market: {market}. Use US or HK.")

    async with httpx.AsyncClient(headers=HEADERS, timeout=20.0, follow_redirects=True) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return _parse_table(resp.text)


@router.get("/{market}")
async def get_active_stocks(market: str):
    """Scrape and return most active stocks for a market (US or HK)."""
    try:
        stocks = await _scrape_active(market)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Failed to fetch data: {exc}")
    return {"market": market.upper(), "stocks": stocks}


class AnalyzeRequest(BaseModel):
    market: str
    symbols: Optional[list[str]] = None


@router.post("/analyze")
async def analyze_active_stocks(req: AnalyzeRequest, session: AsyncSession = Depends(get_db)):
    """Scrape active stocks and run AI analysis on them."""
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
        raise HTTPException(status_code=404, detail="No active stocks data found.")

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

    prompt = f"""Analyze the following most-active stocks from the {req.market.upper()} market.

{stock_lines}

For each stock, provide:
1. **Price Change Reasonableness** — Is the price change reasonable or unusual?
2. **Likely Reasons** — What are the most probable reasons behind the price movement?
3. **Related News** — Any recent news, earnings, or events that could explain the movement.
4. **Short-term Outlook** — Your assessment of the stock's short-term direction with a confidence level (Low/Medium/High).

End with a brief overall market sentiment summary for these active stocks.
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
            max_tokens=4000,
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
    """Analyse sector money flow from most-active stocks."""
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
        raise HTTPException(status_code=404, detail="No active stocks data found.")

    stock_lines = "\n".join(
        f"- {s['symbol']} ({s['name']}): Change={s['change']} ({s['change_pct']}), "
        f"Volume={s['volume']}, MarketCap={s['market_cap']}"
        for s in stocks
    )

    prompt = f"""You are a senior financial analyst specialising in money flow and sector rotation analysis.

Below are the most-active stocks from the {req.market.upper()} market today:

{stock_lines}

Based on these active stocks, perform the following analysis:

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
            max_tokens=4000,
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

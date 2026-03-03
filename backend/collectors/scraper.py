"""
Web scraper for market review content from financial websites.
Falls back to yfinance-based market overview when scraping fails.
"""

import logging
from datetime import datetime

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
import yfinance as yf

from database import NewsArticle

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
}

REVIEW_SOURCES = [
    {
        "name": "Investing.com Market Overview",
        "url": "https://www.investing.com/news/stock-market-news",
        "selector": "article.js-article-item",
        "title_selector": "a.title",
        "summary_selector": "p",
    },
]

TIMEOUT = 15.0


async def scrape_market_reviews(db_session) -> int:
    """Scrape market review articles and store new ones in the database.

    Returns the count of newly inserted articles.
    """
    new_count = 0

    async with httpx.AsyncClient(headers=HEADERS, timeout=TIMEOUT, follow_redirects=True) as client:
        for source in REVIEW_SOURCES:
            try:
                new_count += await _scrape_source(client, source, db_session)
            except httpx.TimeoutException:
                logger.warning("Timeout fetching %s", source["url"])
            except httpx.HTTPStatusError as exc:
                logger.warning("HTTP %s from %s", exc.response.status_code, source["url"])
            except Exception:
                logger.exception("Failed to scrape %s", source["name"])

    logger.info("Scraping complete – %d new articles stored", new_count)
    return new_count


async def _scrape_source(client: httpx.AsyncClient, source: dict, db_session) -> int:
    """Scrape a single source and persist new articles. Returns count of new articles."""
    resp = await client.get(source["url"])
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "lxml")
    articles = soup.select(source["selector"])

    if not articles:
        logger.warning("No articles matched selector '%s' on %s – site layout may have changed",
                        source["selector"], source["url"])
        return 0

    new_count = 0
    for article_el in articles:
        try:
            title_el = article_el.select_one(source["title_selector"])
            if not title_el:
                continue

            title = title_el.get_text(strip=True)
            href = title_el.get("href", "")
            if not href:
                continue

            # Resolve relative URLs
            if href.startswith("/"):
                href = f"https://www.investing.com{href}"

            summary_el = article_el.select_one(source["summary_selector"])
            summary = summary_el.get_text(strip=True) if summary_el else None

            # Skip duplicates
            exists = await db_session.execute(
                select(NewsArticle.id).where(NewsArticle.url == href)
            )
            if exists.scalar_one_or_none() is not None:
                continue

            db_session.add(NewsArticle(
                title=title,
                summary=summary,
                url=href,
                source=source["name"],
                published_at=None,
            ))
            new_count += 1

        except Exception:
            logger.exception("Error parsing article element in %s", source["name"])

    if new_count:
        await db_session.commit()

    logger.info("Source '%s': %d new articles", source["name"], new_count)
    return new_count


def get_market_overview_text() -> str:
    """Generate a plain-text market overview via yfinance as a scraping fallback.

    Returns a formatted string summarising current market conditions including
    major indices and top movers (biggest gains and losses).
    """
    try:
        lines: list[str] = [f"=== Market Overview ({datetime.now():%Y-%m-%d %H:%M UTC}) ===\n"]

        # --- Major indices ---
        indices = {
            "^GSPC": "S&P 500",
            "^DJI": "Dow Jones",
            "^IXIC": "NASDAQ",
            "^RUT": "Russell 2000",
        }
        lines.append("-- Major Indices --")
        for symbol, name in indices.items():
            try:
                ticker = yf.Ticker(symbol)
                info = ticker.fast_info
                price = info.get("lastPrice") or info.get("last_price", 0)
                prev = info.get("previousClose") or info.get("previous_close", 0)
                change_pct = ((price - prev) / prev * 100) if prev else 0
                direction = "▲" if change_pct >= 0 else "▼"
                lines.append(f"  {name}: {price:,.2f} ({direction} {abs(change_pct):.2f}%)")
            except Exception:
                logger.debug("Could not fetch index %s", symbol)

        # --- Top movers from S&P 500 tickers sample ---
        sample_symbols = [
            "AAPL", "MSFT", "AMZN", "GOOGL", "META",
            "TSLA", "NVDA", "JPM", "V", "UNH",
            "JNJ", "WMT", "PG", "XOM", "BAC",
        ]

        movers: list[tuple[str, float]] = []
        for sym in sample_symbols:
            try:
                t = yf.Ticker(sym)
                info = t.fast_info
                price = info.get("lastPrice") or info.get("last_price", 0)
                prev = info.get("previousClose") or info.get("previous_close", 0)
                if prev:
                    movers.append((sym, (price - prev) / prev * 100))
            except Exception:
                logger.debug("Could not fetch %s", sym)

        movers.sort(key=lambda x: x[1], reverse=True)

        if movers:
            lines.append("\n-- Top Gainers --")
            for sym, chg in movers[:5]:
                lines.append(f"  {sym}: ▲ {chg:.2f}%")

            lines.append("\n-- Top Losers --")
            for sym, chg in movers[-5:]:
                direction = "▲" if chg >= 0 else "▼"
                lines.append(f"  {sym}: {direction} {abs(chg):.2f}%")

        overview = "\n".join(lines)
        logger.info("Generated yfinance market overview (%d chars)", len(overview))
        return overview

    except Exception:
        logger.exception("Failed to generate market overview via yfinance")
        return "Market overview temporarily unavailable."

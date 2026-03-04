"""RSS feed collector for financial news aggregation."""

import logging
from datetime import datetime, timezone
from typing import Optional

import feedparser
import httpx
from bs4 import BeautifulSoup
from dateutil import parser as dateutil_parser
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import NewsArticle

logger = logging.getLogger(__name__)

RSS_FEEDS = [
    # --- US Major ---
    {"name": "Reuters Business", "url": "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best"},
    {"name": "CNBC Top News", "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114"},
    {"name": "CNBC World", "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100727362"},
    {"name": "CNBC Earnings", "url": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135"},
    {"name": "Yahoo Finance", "url": "https://finance.yahoo.com/news/rssindex"},
    {"name": "MarketWatch Top Stories", "url": "https://feeds.marketwatch.com/marketwatch/topstories/"},
    {"name": "MarketWatch Markets", "url": "https://feeds.marketwatch.com/marketwatch/marketpulse/"},
    {"name": "MarketWatch Stocks", "url": "https://feeds.marketwatch.com/marketwatch/StockstoWatch/"},
    {"name": "Investing.com News", "url": "https://www.investing.com/rss/news.rss"},
    {"name": "Investing.com Commodities", "url": "https://www.investing.com/rss/news_14.rss"},
    {"name": "Investing.com Forex", "url": "https://www.investing.com/rss/news_1.rss"},
    {"name": "Investing.com Crypto", "url": "https://www.investing.com/rss/news_301.rss"},
    {"name": "Financial Times", "url": "https://www.ft.com/rss/home"},
    {"name": "Bloomberg Markets", "url": "https://feeds.bloomberg.com/markets/news.rss"},
    {"name": "Barrons", "url": "https://www.barrons.com/feed"},
    {"name": "Seeking Alpha Market News", "url": "https://seekingalpha.com/market_currents.xml"},
    {"name": "Seeking Alpha Top Ideas", "url": "https://seekingalpha.com/tag/top-ideas.xml"},
    # --- Google News Finance ---
    {"name": "Google Finance News", "url": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en"},
    {"name": "Google News Business", "url": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en&gl=GB&ceid=GB:en"},
    # --- Europe ---
    {"name": "ECB Press", "url": "https://www.ecb.europa.eu/rss/press.html"},
    {"name": "BBC Business", "url": "https://feeds.bbci.co.uk/news/business/rss.xml"},
    {"name": "Guardian Business", "url": "https://www.theguardian.com/uk/business/rss"},
    # --- Asia ---
    {"name": "Nikkei Asia", "url": "https://asia.nikkei.com/rss/feed/nar"},
    {"name": "SCMP Business", "url": "https://www.scmp.com/rss/91/feed"},
    {"name": "CNA Business", "url": "https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511"},
    {"name": "ET Markets", "url": "https://economictimes.indiatimes.com/markets/rssfeeds/1977021501.cms"},
    # --- Commodities & Crypto ---
    {"name": "CoinDesk", "url": "https://www.coindesk.com/arc/outboundfeeds/rss/"},
    {"name": "CoinTelegraph", "url": "https://cointelegraph.com/rss"},
    {"name": "Oil Price", "url": "https://oilprice.com/rss/main"},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; AIInvestBot/1.0; +https://github.com/ai-investment)",
    "Accept": "application/rss+xml, application/xml, text/xml, */*",
}

FETCH_TIMEOUT = 15.0


def _clean_html(raw: Optional[str]) -> Optional[str]:
    """Strip HTML tags from a string, returning plain text."""
    if not raw:
        return None
    return BeautifulSoup(raw, "lxml").get_text(separator=" ", strip=True)


def _parse_date(entry: dict) -> Optional[datetime]:
    """Extract and parse published date from a feed entry."""
    for field in ("published", "updated", "created"):
        raw = entry.get(field)
        if raw:
            try:
                dt = dateutil_parser.parse(raw)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except (ValueError, OverflowError):
                continue

    # feedparser may provide a parsed time tuple
    for field in ("published_parsed", "updated_parsed", "created_parsed"):
        tp = entry.get(field)
        if tp:
            try:
                return datetime(*tp[:6], tzinfo=timezone.utc)
            except (TypeError, ValueError):
                continue

    return None


async def collect_news(db_session: AsyncSession) -> int:
    """Fetch all RSS feeds and upsert new articles into the database.

    Returns the count of newly inserted articles.
    """
    new_count = 0

    async with httpx.AsyncClient(headers=HEADERS, timeout=FETCH_TIMEOUT, follow_redirects=True) as client:
        for feed_info in RSS_FEEDS:
            name = feed_info["name"]
            url = feed_info["url"]
            try:
                resp = await client.get(url)
                resp.raise_for_status()
                content = resp.text
            except httpx.HTTPError as exc:
                logger.warning("Failed to fetch %s: %s", name, exc)
                continue
            except Exception as exc:
                logger.warning("Unexpected error fetching %s: %s", name, exc)
                continue

            try:
                parsed = feedparser.parse(content)
            except Exception as exc:
                logger.warning("Failed to parse feed %s: %s", name, exc)
                continue

            for entry in parsed.entries:
                link = entry.get("link")
                if not link:
                    continue

                # Check if URL already exists
                exists = await db_session.execute(
                    select(NewsArticle.id).where(NewsArticle.url == link)
                )
                if exists.scalar() is not None:
                    continue

                title = entry.get("title", "").strip()
                if not title:
                    continue

                summary_raw = entry.get("summary") or entry.get("description") or ""
                summary = _clean_html(summary_raw)
                published_at = _parse_date(entry)

                article = NewsArticle(
                    title=title[:500],
                    summary=summary,
                    url=link[:1000],
                    source=name,
                    published_at=published_at,
                )
                db_session.add(article)
                new_count += 1

            logger.info("Processed feed %s", name)

    await db_session.commit()
    logger.info("RSS collection complete – %d new articles inserted", new_count)
    return new_count


async def get_latest_news(db_session: AsyncSession, limit: int = 50) -> list[NewsArticle]:
    """Return the most recent news articles ordered by published date."""
    result = await db_session.execute(
        select(NewsArticle)
        .order_by(NewsArticle.published_at.desc().nullslast())
        .limit(limit)
    )
    return list(result.scalars().all())

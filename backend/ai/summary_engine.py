"""Summary generation engine – orchestrates data collection, AI analysis, and storage."""

import asyncio
import json
import logging
import re
from datetime import datetime

from config import get_settings
from database import async_session, AISummary, PriceSnapshot, NewsArticle
from collectors.price_collector import collect_prices
from collectors.rss_collector import collect_news, get_latest_news
from collectors.scraper import get_market_overview_text
from ai.openrouter import OpenRouterClient

logger = logging.getLogger(__name__)


async def generate_summary(model: str = None) -> dict:
    """Orchestrate the full pipeline: collect → format → AI → parse → store."""
    logger.info("Starting summary generation pipeline")

    settings = get_settings()
    model = model or settings.openrouter_model
    loop = asyncio.get_event_loop()

    # Step 1: Collect prices (async session)
    logger.info("Step 1: Collecting prices")
    prices = []
    try:
        async with async_session() as session:
            prices = await collect_prices(session)
        logger.info("Collected %d price snapshots", len(prices))
    except Exception:
        logger.exception("Price collection failed")

    # Step 2: Collect news (async session)
    logger.info("Step 2: Collecting news")
    articles = []
    try:
        async with async_session() as session:
            new_count = await collect_news(session)
            logger.info("Collected %d new articles", new_count)
            articles = await get_latest_news(session)
    except Exception:
        logger.exception("News collection failed")

    # Step 3: Get market overview text (sync – run in executor)
    logger.info("Step 3: Getting market overview")
    try:
        overview = await loop.run_in_executor(None, get_market_overview_text)
    except Exception:
        logger.exception("Market overview generation failed")
        overview = ""

    # Step 4: Format data for the AI prompt
    logger.info("Step 4: Formatting data for AI")
    market_data = _format_market_data(prices)
    news_data = _format_news_data(articles, overview)

    if not market_data and not news_data:
        logger.warning("No data collected – skipping AI analysis")
        return {"error": "No market data or news available for analysis"}

    # Step 5: Call AI
    logger.info("Step 5: Calling AI model '%s'", model)
    client = OpenRouterClient()
    try:
        ai_response = await client.analyze_market(market_data, news_data, model=model)
        logger.info("AI response received (%d chars)", len(ai_response))
    except Exception:
        logger.exception("AI analysis failed")
        return {"error": "AI analysis failed"}
    finally:
        await client.close()

    # Step 6: Parse recommendations
    logger.info("Step 6: Parsing recommendations")
    recommendations = _parse_recommendations(ai_response)
    logger.info("Parsed %d recommendations", len(recommendations))

    # Step 7: Store in database
    logger.info("Step 7: Storing summary")
    summary_id = None
    created_at = datetime.utcnow()
    # Note: created_at here is only a fallback; the DB-generated value
    # (via func.now()) is used after commit+refresh. format_hkt() in the
    # router handles UTC→HKT conversion for API responses.
    try:
        async with async_session() as session:
            summary_obj = AISummary(
                model_used=model,
                market_summary=ai_response,
                recommendations=json.dumps(recommendations),
                news_digest=news_data[:5000],
            )
            session.add(summary_obj)
            await session.commit()
            await session.refresh(summary_obj)
            summary_id = summary_obj.id
            created_at = summary_obj.created_at
        logger.info("Summary stored with id=%d", summary_id)
    except Exception:
        logger.exception("Failed to store summary")

    # Step 8: Return result
    result = {
        "id": summary_id,
        "model_used": model,
        "market_summary": ai_response,
        "recommendations": recommendations,
        "news_digest": news_data[:5000],
        "created_at": created_at.isoformat() if created_at else None,
        "stats": {
            "prices_collected": len(prices),
            "articles_available": len(articles),
        },
    }
    logger.info("Summary generation complete")
    return result


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _format_market_data(prices: list) -> str:
    """Format PriceSnapshot objects into structured text grouped by category."""
    if not prices:
        return ""

    grouped: dict[str, list] = {}
    for p in prices:
        key = f"{p.category} ({p.region})"
        grouped.setdefault(key, []).append(p)

    lines = ["=== Current Market Prices ===\n"]
    for category, snapshots in sorted(grouped.items()):
        lines.append(f"-- {category.upper()} --")
        for s in snapshots:
            change_str = ""
            if s.change_pct is not None:
                direction = "▲" if s.change_pct >= 0 else "▼"
                change_str = f" ({direction} {abs(s.change_pct):.2f}%)"
            vol_str = f"  Vol: {s.volume:,}" if s.volume else ""
            lines.append(f"  {s.name} ({s.symbol}): {s.price:,.4f}{change_str}{vol_str}")
        lines.append("")

    return "\n".join(lines)


def _format_news_data(articles: list, overview: str) -> str:
    """Format news articles and market overview into text for the AI prompt."""
    lines = []

    if overview:
        lines.append(overview)
        lines.append("")

    if articles:
        lines.append("=== Recent Financial News ===\n")
        for i, article in enumerate(articles[:30], 1):
            source_tag = f"[{article.source}]" if article.source else ""
            date_tag = ""
            if article.published_at:
                date_tag = f" ({article.published_at:%Y-%m-%d %H:%M})"
            lines.append(f"{i}. {source_tag} {article.title}{date_tag}")
            if article.summary:
                lines.append(f"   {article.summary[:200]}")
            lines.append("")

    return "\n".join(lines)


def _parse_recommendations(ai_text: str) -> list[dict]:
    """Parse AI response to extract structured recommendations.

    Looks for lines matching the ``SYMBOL | ACTION | Reasoning | Confidence``
    format requested in the prompt template.
    """
    if not ai_text:
        return []

    pattern = re.compile(
        r"([A-Z0-9^=.\-]{1,20})\s*\|\s*(BUY|SELL|HOLD)\s*\|\s*(.+?)\s*\|\s*(\d{1,2})",
        re.IGNORECASE,
    )

    recommendations = []
    for match in pattern.finditer(ai_text):
        try:
            confidence = max(1, min(10, int(match.group(4))))
        except ValueError:
            confidence = 5

        recommendations.append({
            "symbol": match.group(1).strip(),
            "action": match.group(2).strip().upper(),
            "reasoning": match.group(3).strip(),
            "confidence": confidence,
        })

    return recommendations

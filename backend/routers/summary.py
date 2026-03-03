import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import get_db, AISummary, PriceSnapshot, NewsArticle, Setting
from ai.openrouter import OpenRouterClient

router = APIRouter(prefix="/summaries", tags=["summaries"])


def _serialize_summary(s: AISummary) -> dict:
    """Convert an AISummary row to a JSON-safe dict, parsing recommendations."""
    recommendations = None
    if s.recommendations:
        try:
            recommendations = json.loads(s.recommendations)
        except (json.JSONDecodeError, TypeError):
            recommendations = s.recommendations
    return {
        "id": s.id,
        "model_used": s.model_used,
        "market_summary": s.market_summary,
        "recommendations": recommendations,
        "news_digest": s.news_digest,
        "created_at": str(s.created_at),
    }


@router.get("")
async def list_summaries(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    session: AsyncSession = Depends(get_db),
):
    """Return paginated list of AI summaries."""
    offset = (page - 1) * limit

    result = await session.execute(
        select(AISummary).order_by(AISummary.created_at.desc()).offset(offset).limit(limit)
    )
    summaries = result.scalars().all()

    total = (await session.execute(select(func.count(AISummary.id)))).scalar() or 0

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "summaries": [_serialize_summary(s) for s in summaries],
    }


@router.get("/latest")
async def get_latest_summary(session: AsyncSession = Depends(get_db)):
    """Return the most recent AI summary."""
    result = await session.execute(
        select(AISummary).order_by(AISummary.created_at.desc()).limit(1)
    )
    summary = result.scalars().first()
    if not summary:
        return {"detail": "No summaries available yet"}
    return _serialize_summary(summary)


@router.post("/generate")
async def generate_summary(session: AsyncSession = Depends(get_db)):
    """Trigger manual summary generation using the configured AI model."""
    # Gather latest market data
    price_sub = (
        select(
            PriceSnapshot.symbol,
            func.max(PriceSnapshot.id).label("max_id"),
        )
        .group_by(PriceSnapshot.symbol)
        .subquery()
    )
    price_result = await session.execute(
        select(PriceSnapshot).join(price_sub, PriceSnapshot.id == price_sub.c.max_id)
    )
    prices = price_result.scalars().all()

    market_data = "\n".join(
        f"{p.symbol} ({p.name}): ${p.price:.2f} | Change: {p.change_pct or 'N/A'}% | "
        f"Category: {p.category} | Region: {p.region}"
        for p in prices
    ) or "No market data available."

    # Gather recent news
    news_result = await session.execute(
        select(NewsArticle).order_by(NewsArticle.published_at.desc().nullslast()).limit(30)
    )
    articles = news_result.scalars().all()

    news_data = "\n".join(
        f"- [{a.source}] {a.title}" + (f": {a.summary[:200]}" if a.summary else "")
        for a in articles
    ) or "No recent news available."

    # Determine model
    model_setting = await session.execute(
        select(Setting).where(Setting.key == "openrouter_model")
    )
    row = model_setting.scalars().first()
    model = row.value if row and row.value else None

    # Call AI
    client = OpenRouterClient()
    try:
        analysis = await client.analyze_market(market_data, news_data, model=model)
    finally:
        await client.close()

    # Persist summary
    ai_summary = AISummary(
        model_used=model or client._default_model,
        market_summary=analysis,
        recommendations=None,
        news_digest=None,
    )
    session.add(ai_summary)
    await session.commit()
    await session.refresh(ai_summary)

    return _serialize_summary(ai_summary)

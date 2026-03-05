import json
import re

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import get_db, AISummary, PriceSnapshot, NewsArticle, Setting
from ai.openrouter import OpenRouterClient
from tz import format_hkt

router = APIRouter(prefix="/summaries", tags=["summaries"])


def _parse_recommendations(text: str) -> list:
    """Parse SYMBOL | ACTION | Reasoning | Confidence lines into structured list."""
    recs = []
    for line in text.split('\n'):
        line = line.strip().lstrip('- ').lstrip('* ')
        parts = [p.strip() for p in line.split('|')]
        if len(parts) >= 4:
            symbol = parts[0].strip('*').strip()
            action = parts[1].strip().upper()
            if action not in ('BUY', 'SELL', 'HOLD'):
                continue
            reasoning = parts[2].strip()
            try:
                confidence = int(re.search(r'\d+', parts[3]).group())
            except (AttributeError, ValueError):
                confidence = 5
            confidence = max(1, min(10, confidence))
            if symbol and reasoning:
                recs.append({
                    "symbol": symbol,
                    "action": action,
                    "reasoning": reasoning,
                    "confidence": confidence,
                })
    return recs


def _parse_ai_response(text: str) -> dict:
    """Split the AI response into market_summary, news_digest, recommendations, risk_warnings."""
    sections = {
        'market_summary': '',
        'news_digest': '',
        'recommendations_raw': '',
        'risk_warnings': '',
    }

    # Try to split by section headers
    patterns = [
        (r'##\s*MARKET_SUMMARY[^\n]*', 'market_summary'),
        (r'##\s*NEWS_DIGEST[^\n]*', 'news_digest'),
        (r'##\s*RECOMMENDATIONS[^\n]*', 'recommendations_raw'),
        (r'##\s*RISK_WARNINGS[^\n]*', 'risk_warnings'),
    ]

    # Find all section positions
    positions = []
    for pattern, key in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            positions.append((m.start(), m.end(), key))

    if len(positions) >= 2:
        # Sort by position
        positions.sort(key=lambda x: x[0])
        for i, (start, header_end, key) in enumerate(positions):
            if i + 1 < len(positions):
                content = text[header_end:positions[i + 1][0]]
            else:
                content = text[header_end:]
            sections[key] = content.strip()
    else:
        # Fallback: try old-style headers (A), B), etc.)
        old_patterns = [
            (r'##\s*[A-D]\)\s*Market\s*Summary[^\n]*', 'market_summary'),
            (r'##\s*[A-D]\)\s*(?:Key\s*)?News[^\n]*', 'news_digest'),
            (r'##\s*[A-D]\)\s*Recommendations[^\n]*', 'recommendations_raw'),
            (r'##\s*[A-D]\)\s*Risk[^\n]*', 'risk_warnings'),
        ]
        positions = []
        for pattern, key in old_patterns:
            m = re.search(pattern, text, re.IGNORECASE)
            if m:
                positions.append((m.start(), m.end(), key))

        if len(positions) >= 2:
            positions.sort(key=lambda x: x[0])
            for i, (start, header_end, key) in enumerate(positions):
                if i + 1 < len(positions):
                    content = text[header_end:positions[i + 1][0]]
                else:
                    content = text[header_end:]
                sections[key] = content.strip()
        else:
            # Can't parse sections — put everything in market_summary
            sections['market_summary'] = text

    # Parse recommendations into structured format
    recs = _parse_recommendations(sections['recommendations_raw'])

    # Combine market summary with risk warnings
    market_summary = sections['market_summary']
    if sections['risk_warnings']:
        market_summary += '\n\n## Risk Warnings\n' + sections['risk_warnings']

    return {
        'market_summary': market_summary,
        'news_digest': sections['news_digest'],
        'recommendations': recs,
    }


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
        "created_at": format_hkt(s.created_at),
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
    from fastapi import HTTPException
    from config import get_settings

    settings = get_settings()
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env file."
        )

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

    # Parse AI response into sections
    parsed = _parse_ai_response(analysis)

    # Persist summary
    ai_summary = AISummary(
        model_used=model or client._default_model,
        market_summary=parsed['market_summary'],
        recommendations=json.dumps(parsed['recommendations']) if parsed['recommendations'] else None,
        news_digest=parsed['news_digest'] or None,
    )
    session.add(ai_summary)
    await session.commit()
    await session.refresh(ai_summary)

    return _serialize_summary(ai_summary)

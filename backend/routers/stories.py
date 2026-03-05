"""Saved stories router — persist and analyse AI analysis results."""

import logging
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ai.openrouter import OpenRouterClient
from config import get_settings
from database import get_db, SavedStory, Setting
from tz import format_hkt

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stories", tags=["stories"])


# --- Request / Response models ---

class SaveStoryRequest(BaseModel):
    source: str
    title: str
    content: str
    market: str = "US"  # "US" or "HK"


class AnalyseStoriesRequest(BaseModel):
    period: str  # "1w", "1m", "3m"
    market: str = "US"  # "US" or "HK"
    source: Optional[str] = None  # filter by story source e.g. "active_stocks_analysis"


# --- Endpoints ---

@router.get("")
async def list_stories(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    market: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
    exclude_source: Optional[str] = Query(None),
    session: AsyncSession = Depends(get_db),
):
    """Return saved stories sorted by saved_at descending."""
    offset = (page - 1) * limit
    query = select(SavedStory)
    count_query = select(func.count(SavedStory.id))
    if market:
        query = query.where(SavedStory.market == market)
        count_query = count_query.where(SavedStory.market == market)
    if source:
        query = query.where(SavedStory.source == source)
        count_query = count_query.where(SavedStory.source == source)
    if exclude_source:
        query = query.where(SavedStory.source != exclude_source)
        count_query = count_query.where(SavedStory.source != exclude_source)
    result = await session.execute(
        query.order_by(SavedStory.saved_at.desc()).offset(offset).limit(limit)
    )
    stories = result.scalars().all()
    total = (await session.execute(count_query)).scalar() or 0

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "stories": [
            {
                "id": s.id,
                "source": s.source,
                "market": s.market,
                "title": s.title,
                "content": s.content,
                "saved_at": format_hkt(s.saved_at),
            }
            for s in stories
        ],
    }


@router.post("")
async def save_story(req: SaveStoryRequest, session: AsyncSession = Depends(get_db)):
    """Save an AI analysis result as a story."""
    story = SavedStory(
        source=req.source,
        market=req.market,
        title=req.title,
        content=req.content,
    )
    session.add(story)
    await session.commit()
    await session.refresh(story)
    return {
        "id": story.id,
        "source": story.source,
        "market": story.market,
        "title": story.title,
        "content": story.content,
        "saved_at": format_hkt(story.saved_at),
    }


@router.delete("/{story_id}")
async def delete_story(story_id: int, session: AsyncSession = Depends(get_db)):
    """Delete a saved story by ID."""
    result = await session.execute(select(SavedStory).where(SavedStory.id == story_id))
    story = result.scalars().first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    await session.delete(story)
    await session.commit()
    return {"deleted": True, "id": story_id}


@router.post("/analyse")
async def analyse_stories(req: AnalyseStoriesRequest, session: AsyncSession = Depends(get_db)):
    """Analyse saved stories over a time period to identify trends."""
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=400, detail="OpenRouter API key not configured.")

    # Determine cutoff date
    period_map = {"1w": 7, "1m": 30, "3m": 90}
    days = period_map.get(req.period)
    if days is None:
        raise HTTPException(status_code=400, detail="Invalid period. Use 1w, 1m, or 3m.")

    cutoff = datetime.utcnow() - timedelta(days=days)

    query = (
        select(SavedStory)
        .where(SavedStory.saved_at >= cutoff)
        .where(SavedStory.market == req.market)
        .where(SavedStory.source != "trend_analysis")
    )
    if req.source:
        query = query.where(SavedStory.source == req.source)
    result = await session.execute(query.order_by(SavedStory.saved_at.asc()))
    stories = result.scalars().all()

    if not stories:
        raise HTTPException(status_code=404, detail="No saved stories found in this period.")

    # Build context from all stories
    story_texts = []
    for s in stories:
        story_texts.append(
            f"--- [{s.source}] {s.title} (saved: {format_hkt(s.saved_at)}) ---\n{s.content}\n"
        )
    combined = "\n".join(story_texts)

    period_label = {"1w": "1 week", "1m": "1 month", "3m": "3 months"}[req.period]

    prompt = f"""You are a senior financial analyst specialising in trend analysis and sector rotation.

Below are {len(stories)} saved AI analysis results from the past {period_label}, presented in chronological order:

{combined}

Based on these analyses over time, perform the following:

## 1. Recurring Themes & Trends
Identify industries, sectors, or asset classes that appear REPEATEDLY across multiple analyses.
- Which sectors show consistent money inflows or bullish signals?
- Which sectors show consistent money outflows or bearish signals?
- Are there any stocks or symbols mentioned multiple times?

## 2. Emerging Trends
Identify new themes that appeared recently but were not present in earlier analyses. These may represent emerging opportunities or risks.

## 3. Long-term Investment Signals
Based on the frequency and consistency of signals:
- Which sectors/industries are showing a SUSTAINED trend worth investing in for the medium-to-long term?
- Which sectors should investors AVOID or reduce exposure to?
- Provide specific stock symbols with reasoning.

## 4. Timeline Analysis
Create a brief timeline showing how market sentiment and sector preferences evolved over the {period_label} period.

## 5. Actionable Recommendations
Provide 5-10 specific investment recommendations based on the trend analysis:
SYMBOL | ACTION | Reasoning based on trend analysis | Confidence (1-10)

Format your response in clear markdown."""

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
                {"role": "system", "content": "You are a senior financial analyst specialising in long-term trend analysis, sector rotation, and investment strategy. Analyse patterns across multiple data points over time."},
                {"role": "user", "content": prompt},
            ],
            model=model,
            temperature=0.4,
            max_tokens=40000,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI analysis failed: {exc}")
    finally:
        await client.close()

    return {
        "period": req.period,
        "stories_analysed": len(stories),
        "analysis": analysis,
        "model_used": model or settings.openrouter_model,
    }

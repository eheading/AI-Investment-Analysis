"""Pre-market analysis router — sector inflow predictions before US market open."""

import logging
import re

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.openrouter import OpenRouterClient
from ai.prompts import SYSTEM_PROMPT, PREMARKET_ANALYSIS_TEMPLATE
from collectors.premarket_collector import collect_premarket_data, format_premarket_for_prompt
from config import get_settings
from database import get_db, Setting

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/premarket", tags=["premarket"])


@router.get("/data")
async def get_premarket_data(session: AsyncSession = Depends(get_db)):
    """Return raw pre-market data (futures, sector ETFs, VIX, yields, global markets, news)."""
    try:
        data = await collect_premarket_data(session)
    except Exception as exc:
        logger.exception("Failed to collect pre-market data")
        raise HTTPException(status_code=502, detail=f"Failed to collect pre-market data: {exc}")
    return data


@router.post("/analyze")
async def analyze_premarket(session: AsyncSession = Depends(get_db)):
    """Run full pre-market analysis pipeline: collect data → format → AI → return."""
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise HTTPException(
            status_code=400,
            detail="OpenRouter API key not configured. Please set OPENROUTER_API_KEY in .env file.",
        )

    # Step 1: Collect pre-market data
    try:
        data = await collect_premarket_data(session)
    except Exception as exc:
        logger.exception("Failed to collect pre-market data")
        raise HTTPException(status_code=502, detail=f"Pre-market data collection failed: {exc}")

    # Step 2: Format for AI prompt
    market_data, news_data = format_premarket_for_prompt(data)

    if not market_data and not news_data:
        raise HTTPException(status_code=404, detail="No pre-market data available for analysis.")

    user_content = PREMARKET_ANALYSIS_TEMPLATE.format(
        market_data=market_data,
        news_data=news_data,
    )

    # Step 3: Determine model
    model_row = await session.execute(
        select(Setting).where(Setting.key == "openrouter_model")
    )
    row = model_row.scalars().first()
    model = row.value if row and row.value else None

    # Step 4: Call AI
    client = OpenRouterClient()
    try:
        analysis = await client.chat_completion(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
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

    # Step 5: Parse sector predictions
    sector_predictions = _parse_sector_predictions(analysis)

    return {
        "premarket_data": data,
        "analysis": analysis,
        "sector_predictions": sector_predictions,
        "model_used": model or client._default_model,
    }


def _parse_sector_predictions(ai_text: str) -> list[dict]:
    """Parse SECTOR | INFLOW/OUTFLOW | Reasoning | Confidence | Top Picks lines."""
    if not ai_text:
        return []

    pattern = re.compile(
        r"([A-Za-z\s&]+?)\s*\|\s*(INFLOW|OUTFLOW)\s*\|\s*(.+?)\s*\|\s*(\d{1,2})\s*\|\s*(.+)",
        re.IGNORECASE,
    )

    predictions = []
    for match in pattern.finditer(ai_text):
        try:
            confidence = max(1, min(10, int(match.group(4))))
        except ValueError:
            confidence = 5

        top_picks = [s.strip() for s in match.group(5).split(",") if s.strip()]

        predictions.append({
            "sector": match.group(1).strip(),
            "direction": match.group(2).strip().upper(),
            "reasoning": match.group(3).strip(),
            "confidence": confidence,
            "top_picks": top_picks,
        })

    return predictions

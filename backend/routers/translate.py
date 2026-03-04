"""Translation router — uses LLM to translate between English and Traditional Chinese."""

import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ai.openrouter import OpenRouterClient
from config import get_settings
from database import get_db, Setting

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/translate", tags=["translate"])


class TranslateRequest(BaseModel):
    text: str
    target: str  # "zh" or "en"


@router.post("")
async def translate_text(req: TranslateRequest, session: AsyncSession = Depends(get_db)):
    """Translate text between English and Traditional Chinese using the selected LLM."""
    settings = get_settings()
    if not settings.openrouter_api_key:
        raise HTTPException(status_code=400, detail="OpenRouter API key not configured.")

    if req.target not in ("zh", "en"):
        raise HTTPException(status_code=400, detail="Target must be 'zh' or 'en'.")

    if not req.text.strip():
        return {"translated": ""}

    if req.target == "zh":
        instruction = (
            "Translate the following text into Traditional Chinese (繁體中文). "
            "Keep all stock symbols, numbers, and markdown formatting exactly as-is. "
            "Only translate the natural language parts."
        )
    else:
        instruction = (
            "Translate the following text into English. "
            "Keep all stock symbols, numbers, and markdown formatting exactly as-is. "
            "Only translate the natural language parts."
        )

    model_row = await session.execute(
        select(Setting).where(Setting.key == "openrouter_model")
    )
    row = model_row.scalars().first()
    model = row.value if row and row.value else None

    client = OpenRouterClient()
    try:
        translated = await client.chat_completion(
            messages=[
                {"role": "system", "content": instruction},
                {"role": "user", "content": req.text},
            ],
            model=model,
            temperature=0.2,
            max_tokens=4000,
        )
    except Exception as exc:
        await client.close()
        raise HTTPException(status_code=502, detail=f"Translation failed: {exc}")
    finally:
        await client.close()

    return {"translated": translated}

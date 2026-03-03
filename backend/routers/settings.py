from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db, Setting
from ai.openrouter import OpenRouterClient
from config import get_settings

router = APIRouter(prefix="/settings", tags=["settings"])


class ModelUpdate(BaseModel):
    model: str


@router.get("/models")
async def list_models():
    """List available models from OpenRouter."""
    client = OpenRouterClient()
    try:
        models = await client.list_models()
    finally:
        await client.close()
    return models


@router.get("/model")
async def get_current_model(session: AsyncSession = Depends(get_db)):
    """Get the currently configured AI model."""
    result = await session.execute(
        select(Setting).where(Setting.key == "openrouter_model")
    )
    row = result.scalars().first()
    current = row.value if row and row.value else get_settings().openrouter_model
    return {"model": current}


@router.put("/model")
async def update_model(body: ModelUpdate, session: AsyncSession = Depends(get_db)):
    """Update the AI model setting."""
    result = await session.execute(
        select(Setting).where(Setting.key == "openrouter_model")
    )
    row = result.scalars().first()
    if row:
        row.value = body.model
    else:
        session.add(Setting(key="openrouter_model", value=body.model))
    await session.commit()
    return {"model": body.model, "message": "Model updated successfully"}

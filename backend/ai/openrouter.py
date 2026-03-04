"""OpenRouter API client for AI-powered financial analysis."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

import httpx

from config import get_settings
from ai.prompts import MARKET_ANALYSIS_TEMPLATE, SYSTEM_PROMPT

logger = logging.getLogger(__name__)

_BASE_URL = "https://openrouter.ai/api/v1"
_MODEL_CACHE_TTL = 3600  # 1 hour


class OpenRouterClient:
    """Async client for the OpenRouter chat-completion API."""

    def __init__(self, api_key: str | None = None, default_model: str | None = None):
        settings = get_settings()
        self._api_key = api_key or settings.openrouter_api_key
        self._default_model = default_model or settings.openrouter_model
        self._client = httpx.AsyncClient(base_url=_BASE_URL, timeout=600.0)
        self._models_cache: list[dict[str, Any]] | None = None
        self._models_cache_ts: float = 0.0

    # -- helpers ---------------------------------------------------------------

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self._api_key}",
            "HTTP-Referer": "http://localhost:3000",
            "X-Title": "AI Investment Agent",
            "Content-Type": "application/json",
        }

    async def close(self) -> None:
        await self._client.aclose()

    # -- models ----------------------------------------------------------------

    async def list_models(self) -> list[dict[str, Any]]:
        """Return available chat models (cached for 1 hour)."""
        now = time.monotonic()
        if self._models_cache is not None and now - self._models_cache_ts < _MODEL_CACHE_TTL:
            return self._models_cache

        try:
            resp = await self._client.get("/models", headers=self._headers())
            resp.raise_for_status()
            data = resp.json().get("data", [])
        except httpx.HTTPError as exc:
            logger.error("Failed to fetch models: %s", exc)
            return self._models_cache or []

        chat_models = []
        for m in data:
            # Keep only models that support chat completions
            if "chat" not in m.get("id", "").lower() and "instruct" not in m.get("id", "").lower():
                # OpenRouter tags most models; fall back to keeping all if unsure
                pass
            pricing = m.get("pricing", {})
            chat_models.append(
                {
                    "id": m.get("id"),
                    "name": m.get("name"),
                    "context_length": m.get("context_length"),
                    "pricing": {
                        "prompt": pricing.get("prompt"),
                        "completion": pricing.get("completion"),
                    },
                }
            )

        self._models_cache = chat_models
        self._models_cache_ts = now
        logger.info("Cached %d models from OpenRouter", len(chat_models))
        return chat_models

    # -- chat completions ------------------------------------------------------

    async def chat_completion(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 40000,
        *,
        _max_retries: int = 3,
    ) -> str:
        """Send a chat-completion request and return the assistant content.

        Retries with exponential back-off on rate-limit (429) errors.
        """
        model = model or self._default_model
        payload: dict[str, Any] = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        last_exc: Exception | None = None
        for attempt in range(_max_retries):
            try:
                resp = await self._client.post(
                    "/chat/completions",
                    headers=self._headers(),
                    json=payload,
                )

                if resp.status_code == 429:
                    wait = 2 ** attempt
                    logger.warning("Rate limited (attempt %d/%d), retrying in %ds", attempt + 1, _max_retries, wait)
                    await asyncio.sleep(wait)
                    continue

                resp.raise_for_status()
                data = resp.json()

                choices = data.get("choices", [])
                if not choices:
                    logger.error("Empty choices in response: %s", data)
                    return ""
                return choices[0].get("message", {}).get("content", "")

            except httpx.HTTPStatusError as exc:
                logger.error("HTTP %d from OpenRouter: %s", exc.response.status_code, exc.response.text[:300])
                last_exc = exc
            except httpx.HTTPError as exc:
                logger.error("Request error (attempt %d/%d): %s", attempt + 1, _max_retries, exc)
                last_exc = exc
                await asyncio.sleep(2 ** attempt)

        logger.error("All %d attempts failed for chat_completion", _max_retries)
        if last_exc:
            raise last_exc
        return ""

    # -- high-level analysis ---------------------------------------------------

    async def analyze_market(
        self,
        market_data: str,
        news_data: str,
        model: str | None = None,
    ) -> str:
        """Run a structured market analysis and return the report text."""
        user_content = MARKET_ANALYSIS_TEMPLATE.format(
            market_data=market_data,
            news_data=news_data,
        )
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]
        return await self.chat_completion(messages, model=model, temperature=0.4, max_tokens=40000)

from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database import get_db, NewsArticle
from collectors.rss_collector import RSS_FEEDS, collect_news

router = APIRouter(prefix="/news", tags=["news"])


@router.get("")
async def list_news(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    source: Optional[str] = None,
    session: AsyncSession = Depends(get_db),
):
    """Return paginated news articles, optionally filtered by source."""
    query = select(NewsArticle).order_by(NewsArticle.published_at.desc().nullslast())

    if source:
        query = query.where(NewsArticle.source == source)

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    result = await session.execute(query)
    articles = result.scalars().all()

    # Total count for pagination metadata
    count_query = select(func.count(NewsArticle.id))
    if source:
        count_query = count_query.where(NewsArticle.source == source)
    total = (await session.execute(count_query)).scalar() or 0

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "articles": [
            {
                "id": a.id, "title": a.title, "summary": a.summary, "url": a.url,
                "source": a.source, "published_at": str(a.published_at) if a.published_at else None,
                "fetched_at": str(a.fetched_at),
            }
            for a in articles
        ],
    }


@router.get("/sources")
async def list_sources():
    """Return the list of available RSS feed sources."""
    return [{"name": f["name"], "url": f["url"]} for f in RSS_FEEDS]


@router.post("/refresh")
async def refresh_news(session: AsyncSession = Depends(get_db)):
    """Manually trigger news collection from RSS feeds."""
    new_count = await collect_news(session)
    return {"count": new_count, "message": f"Collected {new_count} new articles"}

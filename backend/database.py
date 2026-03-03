from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Float, BigInteger, Text, DateTime, func
from datetime import datetime
from typing import Optional

from config import get_settings

engine = create_async_engine(get_settings().database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    symbol: Mapped[str] = mapped_column(String(20), index=True)
    name: Mapped[str] = mapped_column(String(100))
    price: Mapped[float] = mapped_column(Float)
    change_pct: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    volume: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    market_cap: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    category: Mapped[str] = mapped_column(String(20))  # index / commodity / crypto / currency
    region: Mapped[str] = mapped_column(String(10))     # US / EU / ASIA / GLOBAL
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class NewsArticle(Base):
    __tablename__ = "news_articles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500))
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    url: Mapped[str] = mapped_column(String(1000), unique=True)
    source: Mapped[str] = mapped_column(String(100))
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class AISummary(Base):
    __tablename__ = "ai_summaries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    model_used: Mapped[str] = mapped_column(String(100))
    market_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommendations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON text
    news_digest: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)


async def get_db():
    """Dependency that yields an async database session."""
    async with async_session() as session:
        yield session


async def init_db():
    """Create all tables if they don't exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

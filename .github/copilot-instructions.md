# Copilot Instructions — AI Investment Agent

## Build & Run

### Docker (production)
```bash
docker compose up --build
```

### Backend (FastAPI + Python 3.11)
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (Next.js 14 + TypeScript)
```bash
cd frontend
npm install
npm run dev          # dev server on :3000
npm run build        # production build
npm run lint         # ESLint (next/core-web-vitals + next/typescript)
```

There is no test suite or backend linter configured.

## Architecture

Two-service app (backend API + frontend SPA) deployed via Docker Compose.

**Backend** (`backend/`): FastAPI app serving all endpoints under `/api`. On startup it initializes the SQLite database and starts APScheduler for periodic AI summary generation.

- `main.py` — App entrypoint, CORS config, router registration. All routers are mounted at `/api`.
- `database.py` — SQLAlchemy async models (`PriceSnapshot`, `NewsArticle`, `AISummary`, `Setting`) and session factory. Uses `sqlite+aiosqlite`.
- `config.py` — Pydantic `BaseSettings` loading from `.env` in project root (one level up from `backend/`).
- `scheduler.py` — APScheduler job that runs `generate_summary()` on a configurable interval.
- `collectors/` — Data ingestion: `price_collector.py` (yfinance batch download), `rss_collector.py` (RSS feeds via feedparser), `scraper.py` (web scraping with BeautifulSoup).
- `ai/` — LLM integration: `openrouter.py` (async httpx client with retry), `prompts.py` (prompt templates), `summary_engine.py` (orchestrates collect → format → AI → parse → store pipeline).
- `routers/` — API routes: `market`, `news`, `summary`, `settings`, `active_stocks`, `translate`.

**Frontend** (`frontend/`): Single-page Next.js 14 app (App Router, `'use client'`). All state lives in the root `page.tsx` with tab-based navigation.

- `src/lib/api.ts` — Centralized API client. All backend calls go through `fetchAPI()` helper. Long-running calls (generate summary, analyze stocks) use `AbortController` with 10-min timeouts.
- `src/types/index.ts` — Shared TypeScript interfaces matching backend response shapes.
- `src/components/` — UI components: `MarketOverview`, `NewsFeed`, `ActiveStocks`, `SummaryPanel`, `Recommendations`, `ChartModal`, `Header`, `TranslateToggle`.

**Data flow**: Frontend polls backend every 5 minutes for market/news data. AI summaries are generated on-demand (user click) or on schedule (APScheduler). The summary pipeline: collect prices → collect news → scrape overview → format prompt → call OpenRouter → parse recommendations (regex for `SYMBOL | ACTION | Reasoning | Confidence` format) → store in SQLite.

## Key Conventions

- **API URL**: Frontend uses `NEXT_PUBLIC_API_URL` env var (defaults to `/api`). Some endpoints in `api.ts` hardcode `http://localhost:8000/api` for long-running POST requests — these bypass the Next.js proxy.
- **OpenRouter**: All LLM calls go through OpenRouter (`https://openrouter.ai/api/v1`). The model is configurable at runtime via the settings API. The client has built-in retry with exponential backoff for 429s.
- **Database**: SQLite with async SQLAlchemy. DB file lives at `data/investment.db`. All models use `Mapped[]` type annotations (SQLAlchemy 2.0 style).
- **Recommendations format**: AI output is parsed via regex expecting pipe-delimited lines: `SYMBOL | ACTION | Reasoning | Confidence`. Any changes to the prompt template in `prompts.py` must keep this format or update `_parse_recommendations()` in `summary_engine.py`.
- **Styling**: Dark theme with hardcoded hex colors (`#0a0a12`, `#0d0d15`, `#1e1e2e`). Tailwind CSS for layout utilities.
- **Environment**: `.env` file in project root. Required: `OPENROUTER_API_KEY`. Config is loaded via Pydantic `BaseSettings` with `@lru_cache`.

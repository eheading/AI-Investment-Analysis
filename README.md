# AI Investment Agent

An AI-powered investment analysis dashboard that monitors global markets, aggregates financial news, and generates hourly AI summaries with actionable buy/sell recommendations.

## Features

- **Global Market Coverage**: US, European, Asian indexes + commodities + currencies + crypto
- **Multi-Source News**: RSS feeds from Reuters, CNBC, Yahoo Finance, MarketWatch, and more
- **AI-Powered Analysis**: Hourly summaries with buy/sell recommendations using OpenRouter (GPT-4o, Claude, Llama, etc.)
- **Dark Theme Dashboard**: Modern Next.js UI with real-time market data
- **Model Selection**: Admin can choose which LLM model to use for analysis

## Quick Start

### Prerequisites
- Docker & Docker Compose

### Setup

1. Clone the repository
2. Copy `.env.example` to `.env` and add your OpenRouter API key:
   ```bash
   cp .env.example .env
   # Edit .env and add your OPENROUTER_API_KEY
   ```
3. Start the services:
   ```bash
   docker compose up --build
   ```
4. Open the dashboard at [http://localhost:3000](http://localhost:3000)

## Development

### Backend (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
```

## Architecture

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14, React, Tailwind CSS, TypeScript |
| Backend | Python 3.11, FastAPI, APScheduler |
| Database | SQLite (via SQLAlchemy) |
| AI | OpenRouter API (multi-model) |
| Data | yfinance, RSS feeds, web scraping |
| Deployment | Docker Compose |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENROUTER_API_KEY` | OpenRouter API key | Yes |
| `OPENROUTER_MODEL` | Default LLM model | No (default: openai/gpt-4o) |
| `SUMMARY_INTERVAL_MINUTES` | Summary generation interval | No (default: 60) |

## License

MIT

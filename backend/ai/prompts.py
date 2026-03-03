"""Prompt templates for AI-driven financial analysis."""

SYSTEM_PROMPT = (
    "You are a senior financial analyst AI with deep expertise in global equity markets, "
    "macroeconomics, and quantitative analysis. You provide objective, data-driven insights. "
    "Always cite specific data points to support your reasoning. "
    "When uncertain, clearly state your confidence level and the assumptions you are making. "
    "Never fabricate statistics or price targets."
)

MARKET_ANALYSIS_TEMPLATE = """\
Analyze the following market data and recent news. Provide a structured report with these sections:

## A) Market Summary
Provide a concise global overview of current market conditions, key index movements, \
and prevailing sentiment.

## B) Key News Highlights
List the most market-moving news items and explain their potential impact.

## C) Recommendations
For each relevant symbol, provide a recommendation in exactly this format:
SYMBOL | ACTION | Reasoning | Confidence

- SYMBOL: the ticker symbol
- ACTION: one of BUY, SELL, or HOLD
- Reasoning: a brief explanation (1-2 sentences)
- Confidence: an integer from 1 (lowest) to 10 (highest)

## D) Risk Warnings
Highlight key risks, upcoming events, or uncertainties that could invalidate the analysis.

---
### Market Data
{market_data}

### Recent News
{news_data}
"""

NEWS_DIGEST_TEMPLATE = """\
Summarize the following financial news into a concise digest. For each item, note:
- The headline and source
- Why it matters for investors
- Which sectors or tickers are most affected

News:
{news_data}
"""

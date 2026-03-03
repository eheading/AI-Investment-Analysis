"""Prompt templates for AI-driven financial analysis."""

SYSTEM_PROMPT = (
    "You are a senior financial analyst AI with deep expertise in global equity markets, "
    "commodities, currencies, macroeconomics, and quantitative analysis. "
    "You provide objective, data-driven insights. "
    "Always cite specific data points to support your reasoning. "
    "When uncertain, clearly state your confidence level and the assumptions you are making. "
    "Never fabricate statistics or price targets. "
    "If you have the ability to search the internet for real-time information, please do so "
    "to supplement your analysis with the latest market developments, earnings reports, "
    "and breaking news."
)

MARKET_ANALYSIS_TEMPLATE = """\
Analyze the following market data and recent news. Provide a structured report with \
EXACTLY these four sections, using the exact section headers shown below.

## MARKET_SUMMARY
Provide a concise global overview of current market conditions across all regions \
(US, Europe, Asia, emerging markets). Cover key index movements, commodities, currencies, \
crypto, and prevailing sentiment. Identify the main themes driving markets today.

## NEWS_DIGEST
For each major news story (at least 5-8 items):
- **Headline summary**: What happened
- **Market impact**: How it affects markets, which sectors/assets are impacted
- **Related tickers**: Specific stocks or assets affected
Include analysis of industry trends, sector rotations, and any breaking developments. \
If you can search online, include the very latest news beyond what is provided.

## RECOMMENDATIONS
Provide at least 8-12 actionable recommendations. Include:
- Stocks/ETFs from the provided market data that have clear signals
- NEW stock picks based on news themes and industry analysis (not limited to the data provided)
- Global opportunities across US, European, Asian markets and commodities

For EACH recommendation, use EXACTLY this pipe-delimited format on its own line:
SYMBOL | ACTION | Reasoning | Confidence

- SYMBOL: the ticker symbol (e.g., AAPL, NVDA, 0700.HK, VOW3.DE, BTC-USD)
- ACTION: exactly one of BUY, SELL, or HOLD
- Reasoning: 1-2 sentences explaining why, referencing specific news or data
- Confidence: integer from 1 (lowest) to 10 (highest)

Example lines:
NVDA | BUY | AI infrastructure spending continues to accelerate based on cloud earnings. | 8
XOM | SELL | Oil demand outlook weakening as OPEC+ signals production increase. | 6
GC=F | HOLD | Gold consolidating near highs; wait for clearer Fed signal. | 5

## RISK_WARNINGS
Highlight key risks, upcoming events (earnings, Fed meetings, economic data releases), \
or uncertainties that could invalidate the analysis.

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

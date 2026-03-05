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

PREMARKET_ANALYSIS_TEMPLATE = """\
You are analyzing US pre-market data BEFORE the market opens at 9:30 AM ET. \
Your goal is to predict which sectors and industries will see money inflow \
(buying pressure) and outflow (selling pressure) when the market opens.

Use the following data to build your analysis:

### Pre-Market Data
{market_data}

### Overnight News
{news_data}

Provide a structured report with EXACTLY these sections:

## PRE_MARKET_OVERVIEW
Summarize the overall pre-market tone:
- Are US futures pointing to a gap up or gap down? By how much?
- What is the VIX signalling about expected volatility?
- How did overnight global markets perform? Any notable divergences?
- What are Treasury yields doing and what does that imply for rate-sensitive sectors?

## SECTOR_ROTATION_SIGNALS
Analyze the sector ETF pre-market moves:
- Rank all 11 GICS sectors by pre-market performance
- Identify which sectors are showing relative strength vs. the broad market (S&P futures)
- Identify which sectors are lagging
- Explain the rotation theme (e.g., risk-on vs. risk-off, growth vs. value, cyclical vs. defensive)

## SECTOR_INFLOW_PREDICTIONS
For each sector you predict will see SIGNIFICANT money inflow at open, provide a line in this \
EXACT pipe-delimited format:

SECTOR | INFLOW | Reasoning | Confidence | Top Picks

- SECTOR: The sector name (e.g., Technology, Energy, Healthcare)
- INFLOW or OUTFLOW: direction of predicted money flow
- Reasoning: 2-3 sentences explaining why, referencing specific pre-market data and news
- Confidence: integer from 1 (lowest) to 10 (highest)
- Top Picks: 3-5 ticker symbols within that sector most likely to benefit (comma-separated)

Example:
Technology | INFLOW | NASDAQ futures up 1.2% led by strong TSMC earnings overnight. XLK pre-market +0.9% vs SPY +0.4%, showing relative strength. AI/semiconductor theme continues. | 8 | NVDA, AMD, AVGO, MSFT, SMCI
Energy | OUTFLOW | Crude oil futures down 2.1% on OPEC+ production increase signals. XLE pre-market -1.3% vs broad market. Avoid upstream producers. | 7 | XOM, CVX, SLB, OXY, COP

Include ALL sectors with notable signals (at least 5-6 sectors). List INFLOW sectors first, then OUTFLOW sectors.

## NEWS_CATALYSTS
For each major overnight news item:
- Which sectors/stocks does it directly impact?
- Is the impact positive or negative?
- How significant is it (Low/Medium/High)?

## TRADE_IDEAS
Provide 5-8 specific actionable trade ideas for market open based on your analysis. \
For each, use this format:
SYMBOL | ACTION | Entry rationale | Target sector theme

## RISK_FACTORS
List key risks that could invalidate this pre-market analysis (e.g., pending economic data \
releases, Fed speakers, geopolitical events happening during the trading day).
"""

NEWS_DIGEST_TEMPLATE = """\
Summarize the following financial news into a concise digest. For each item, note:
- The headline and source
- Why it matters for investors
- Which sectors or tickers are most affected

News:
{news_data}
"""

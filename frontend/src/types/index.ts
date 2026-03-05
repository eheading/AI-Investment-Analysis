export interface PriceSnapshot {
  id: number;
  symbol: string;
  name: string;
  price: number;
  change_pct: number;
  volume: number;
  market_cap: number;
  category: 'index' | 'commodity' | 'crypto' | 'currency';
  region: string;
  fetched_at: string;
}

export interface NewsArticle {
  id: number;
  title: string;
  summary: string;
  url: string;
  source: string;
  published_at: string;
  fetched_at: string;
}

export interface AISummary {
  id: number;
  model_used: string;
  market_summary: string;
  recommendations: Recommendation[];
  news_digest: string;
  created_at: string;
}

export interface Recommendation {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  reasoning: string;
  confidence: number;
}

export interface ActiveStock {
  symbol: string;
  name: string;
  price: string;
  change: string;
  change_pct: string;
  volume: string;
  market_cap: string;
}

export interface ActiveStocksAnalysis {
  market: string;
  stocks: ActiveStock[];
  analysis: string;
  model_used: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: number; completion: number };
}

export interface SavedStory {
  id: number;
  source: string;
  market: string;
  title: string;
  content: string;
  saved_at: string;
}

export interface PremarketTickerData {
  symbol: string;
  name: string;
  price: number;
  prev_close: number | null;
  change_pct: number | null;
}

export interface PremarketGlobalItem {
  symbol: string;
  name: string;
  price: number;
  change_pct: number | null;
  category: string;
  region: string;
}

export interface PremarketNewsItem {
  title: string;
  summary: string | null;
  source: string;
  published_at: string | null;
}

export interface PremarketData {
  futures: PremarketTickerData[];
  sector_etfs: PremarketTickerData[];
  volatility_rates: PremarketTickerData[];
  global_markets: PremarketGlobalItem[];
  recent_news: PremarketNewsItem[];
  collected_at: string;
}

export interface SectorPrediction {
  sector: string;
  direction: 'INFLOW' | 'OUTFLOW';
  reasoning: string;
  confidence: number;
  top_picks: string[];
}

export interface PremarketAnalysis {
  premarket_data: PremarketData;
  analysis: string;
  sector_predictions: SectorPrediction[];
  model_used: string;
}

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
  title: string;
  content: string;
  saved_at: string;
}

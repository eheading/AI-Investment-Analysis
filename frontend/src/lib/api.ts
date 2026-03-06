import type { PriceSnapshot, NewsArticle, AISummary, ModelInfo, ActiveStock, ActiveStocksAnalysis, SavedStory, PremarketData, PremarketAnalysis } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    cache: 'no-store',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const detail = body?.detail || `API error: ${res.status}`;
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  getMarketPrices: () => fetchAPI<PriceSnapshot[]>('/market/prices'),
  getLivePrices: () => fetchAPI<PriceSnapshot[]>('/market/live'),
  refreshPrices: () => fetchAPI<{ count: number }>('/market/refresh', { method: 'POST' }),
  getNews: async () => {
    const res = await fetchAPI<{ articles: NewsArticle[] }>('/news');
    return res.articles;
  },
  refreshNews: () => fetchAPI<{ count: number }>('/news/refresh', { method: 'POST' }),
  getLatestSummary: () => fetchAPI<AISummary>('/summaries/latest'),
  getSummaries: async (page = 1) => {
    const res = await fetchAPI<{ summaries: AISummary[] }>(`/summaries?page=${page}`);
    return res.summaries;
  },
  generateSummary: async (): Promise<AISummary> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000); // 10 min timeout
    try {
      const res = await fetch('http://localhost:8000/api/summaries/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `API error: ${res.status}`);
      }
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  },
  getModels: () => fetchAPI<ModelInfo[]>('/settings/models'),
  getModel: async () => {
    const res = await fetchAPI<{ model: string }>('/settings/model');
    return res.model;
  },
  setModel: (modelId: string) =>
    fetchAPI<void>('/settings/model', {
      method: 'PUT',
      body: JSON.stringify({ model: modelId }),
    }),
  getPriceHistory: (symbol: string) =>
    fetchAPI<{ symbol: string; name: string; price: number; change_pct: number; fetched_at: string }[]>(
      `/market/prices/${encodeURIComponent(symbol)}`
    ),
  getActiveStocks: (market: string) =>
    fetchAPI<{ market: string; stocks: ActiveStock[] }>(`/active-stocks/${market}?_t=${Date.now()}`),
  getTopGainers: (market: string) =>
    fetchAPI<{ market: string; stocks: ActiveStock[] }>(`/top-gainers/${market}?_t=${Date.now()}`),
  getTopLosers: (market: string) =>
    fetchAPI<{ market: string; stocks: ActiveStock[] }>(`/top-losers/${market}?_t=${Date.now()}`),
  analyzeActiveStocks: async (market: string, symbols?: string[]): Promise<ActiveStocksAnalysis> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000); // 10 min timeout
    try {
      const res = await fetch('http://localhost:8000/api/active-stocks/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market, symbols }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `API error: ${res.status}`);
      }
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  },
  analyzeMoneyFlow: async (market: string): Promise<{ market: string; analysis: string; model_used: string }> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000);
    try {
      const res = await fetch('http://localhost:8000/api/active-stocks/money-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `API error: ${res.status}`);
      }
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  },
  analyzeTopGainers: async (market: string, symbols?: string[]): Promise<ActiveStocksAnalysis> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000);
    try {
      const res = await fetch('http://localhost:8000/api/top-gainers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market, symbols }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `API error: ${res.status}`);
      }
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  },
  analyzeGainersMoneyFlow: async (market: string): Promise<{ market: string; analysis: string; model_used: string }> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000);
    try {
      const res = await fetch('http://localhost:8000/api/top-gainers/money-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `API error: ${res.status}`);
      }
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  },
  analyzeTopLosers: async (market: string, symbols?: string[]): Promise<ActiveStocksAnalysis> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000);
    try {
      const res = await fetch('http://localhost:8000/api/top-losers/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market, symbols }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `API error: ${res.status}`);
      }
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  },
  analyzeLosersMoneyFlow: async (market: string): Promise<{ market: string; analysis: string; model_used: string }> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000);
    try {
      const res = await fetch('http://localhost:8000/api/top-losers/money-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ market }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `API error: ${res.status}`);
      }
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  },
  translateText: async (text: string, target: 'zh' | 'en'): Promise<string> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000);
    try {
      const res = await fetch('http://localhost:8000/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, target }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `API error: ${res.status}`);
      }
      const data = await res.json();
      return data.translated;
    } finally {
      clearTimeout(timeout);
    }
  },

  // --- Stories ---
  getStories: async (page = 1, limit = 50, market?: string, source?: string, excludeSource?: string): Promise<{ stories: SavedStory[]; total: number }> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (market) params.set('market', market);
    if (source) params.set('source', source);
    if (excludeSource) params.set('exclude_source', excludeSource);
    const res = await fetch(`http://localhost:8000/api/stories?${params}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  },

  saveStory: async (source: string, title: string, content: string, market: string): Promise<SavedStory> => {
    const res = await fetch('http://localhost:8000/api/stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, title, content, market }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.detail || `API error: ${res.status}`);
    }
    return res.json();
  },

  deleteStory: async (id: number): Promise<void> => {
    const res = await fetch(`http://localhost:8000/api/stories/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.detail || `API error: ${res.status}`);
    }
  },

  analyseStories: async (period: string, market: string, source?: string): Promise<{ analysis: string; stories_analysed: number }> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000);
    try {
      const res = await fetch('http://localhost:8000/api/stories/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period, market, source: source || undefined }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `API error: ${res.status}`);
      }
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  },

  // --- Pre-Market ---
  getPremarketData: () => fetchAPI<PremarketData>('/premarket/data'),

  analyzePremarket: async (): Promise<PremarketAnalysis> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 600_000);
    try {
      const res = await fetch('http://localhost:8000/api/premarket/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || `API error: ${res.status}`);
      }
      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  },
};

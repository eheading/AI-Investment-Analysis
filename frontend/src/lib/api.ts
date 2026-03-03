import type { PriceSnapshot, NewsArticle, AISummary, ModelInfo } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  getMarketPrices: () => fetchAPI<PriceSnapshot[]>('/market/prices'),
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
  generateSummary: () => fetchAPI<AISummary>('/summaries/generate', { method: 'POST' }),
  getModels: () => fetchAPI<ModelInfo[]>('/settings/models'),
  setModel: (modelId: string) =>
    fetchAPI<void>('/settings/model', {
      method: 'PUT',
      body: JSON.stringify({ model: modelId }),
    }),
  getPriceHistory: (symbol: string) =>
    fetchAPI<{ symbol: string; name: string; price: number; change_pct: number; fetched_at: string }[]>(
      `/market/prices/${encodeURIComponent(symbol)}`
    ),
};

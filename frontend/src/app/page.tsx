'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PriceSnapshot, NewsArticle, AISummary } from '@/types';
import { api } from '@/lib/api';
import Header from '@/components/Header';
import MarketOverview from '@/components/MarketOverview';
import NewsFeed from '@/components/NewsFeed';
import SummaryPanel from '@/components/SummaryPanel';
import Recommendations from '@/components/Recommendations';
import ActiveStocks from '@/components/ActiveStocks';

type Tab = 'overview' | 'news' | 'active' | 'analysis';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Market Overview' },
  { key: 'news', label: 'News Feed' },
  { key: 'active', label: 'Active Stocks' },
  { key: 'analysis', label: 'AI Analysis' },
];

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function Home() {
  const [prices, setPrices] = useState<PriceSnapshot[]>([]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [currentModel, setCurrentModel] = useState<string>('openai/gpt-4o');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const refreshData = useCallback(async () => {
    const results = await Promise.allSettled([
      api.getMarketPrices(),
      api.getNews(),
      api.getLatestSummary(),
      api.getModel(),
    ]);

    const loadedPrices = results[0].status === 'fulfilled' ? results[0].value : [];
    const loadedArticles = results[1].status === 'fulfilled' ? results[1].value : [];

    if (results[0].status === 'fulfilled') setPrices(loadedPrices);
    if (results[1].status === 'fulfilled') setArticles(loadedArticles);
    if (results[2].status === 'fulfilled') setSummary(results[2].value);
    if (results[3].status === 'fulfilled') setCurrentModel(results[3].value);

    setIsLoading(false);

    // Auto-collect data on first visit if DB is empty
    if (loadedPrices.length === 0 || loadedArticles.length === 0) {
      await Promise.allSettled([
        loadedPrices.length === 0 ? api.refreshPrices() : Promise.resolve(null),
        loadedArticles.length === 0 ? api.refreshNews() : Promise.resolve(null),
      ]);
      // Re-fetch after collection
      const freshResults = await Promise.allSettled([
        loadedPrices.length === 0 ? api.getMarketPrices() : Promise.resolve(loadedPrices),
        loadedArticles.length === 0 ? api.getNews() : Promise.resolve(loadedArticles),
      ]);
      if (freshResults[0].status === 'fulfilled') setPrices(freshResults[0].value);
      if (freshResults[1].status === 'fulfilled') setArticles(freshResults[1].value);
    }
  }, []);

  useEffect(() => {
    refreshData();

    const interval = setInterval(async () => {
      const results = await Promise.allSettled([
        api.getMarketPrices(),
        api.getNews(),
      ]);
      if (results[0].status === 'fulfilled') setPrices(results[0].value);
      if (results[1].status === 'fulfilled') setArticles(results[1].value);
    }, REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [refreshData]);

  const [error, setError] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([api.refreshPrices(), api.refreshNews()]);
      const results = await Promise.allSettled([api.getMarketPrices(), api.getNews()]);
      if (results[0].status === 'fulfilled') setPrices(results[0].value);
      if (results[1].status === 'fulfilled') setArticles(results[1].value);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      await api.setModel(currentModel);
      const newSummary = await api.generateSummary();
      setSummary(newSummary);
      setActiveTab('analysis');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate summary';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleModelChange = (modelId: string) => {
    setCurrentModel(modelId);
  };

  const handleModelConfirm = async (modelId: string) => {
    try {
      await api.setModel(modelId);
    } catch {
      // ignore save errors
    }
  };

  const lastUpdated = summary?.created_at
    ? new Date(summary.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#0a0a12', color: '#e5e5e5' }}>
      <Header
        currentModel={currentModel}
        onModelChange={handleModelChange}
        onModelConfirm={handleModelConfirm}
        onGenerateSummary={handleGenerateSummary}
        isGenerating={isGenerating}
        lastUpdated={lastUpdated}
      />

      <main className="mx-auto max-w-7xl px-4 pt-20 pb-12 sm:px-6 lg:px-8">
        {/* Tab navigation */}
        <nav className="mb-8 flex flex-wrap items-center gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-[#1e1e2e] text-gray-400 hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={handleRefreshData}
            disabled={isRefreshing}
            className="ml-auto flex items-center gap-2 rounded-full bg-[#1e1e2e] px-4 py-2 text-sm font-medium text-gray-300 hover:bg-[#2a2a3e] hover:text-white transition-colors disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
            </svg>
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </nav>

        {/* Error toast */}
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Tab content — all rendered, visibility toggled to preserve state */}
        <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
          <MarketOverview prices={prices} />
        </div>

        <div style={{ display: activeTab === 'news' ? 'block' : 'none' }}>
          <NewsFeed articles={articles} />
        </div>

        <div style={{ display: activeTab === 'active' ? 'block' : 'none' }}>
          <ActiveStocks />
        </div>

        <div style={{ display: activeTab === 'analysis' ? 'block' : 'none' }}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d15]">
              <SummaryPanel summary={summary} isLoading={isLoading} />
            </div>
            <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d15] p-6">
              <Recommendations recommendations={summary?.recommendations ?? []} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

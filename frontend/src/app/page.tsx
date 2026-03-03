'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PriceSnapshot, NewsArticle, AISummary, ModelInfo } from '@/types';
import { api } from '@/lib/api';
import Header from '@/components/Header';
import MarketOverview from '@/components/MarketOverview';
import NewsFeed from '@/components/NewsFeed';
import SummaryPanel from '@/components/SummaryPanel';
import Recommendations from '@/components/Recommendations';

type Tab = 'overview' | 'news' | 'analysis';

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'Market Overview' },
  { key: 'news', label: 'News Feed' },
  { key: 'analysis', label: 'AI Analysis' },
];

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

export default function Home() {
  const [prices, setPrices] = useState<PriceSnapshot[]>([]);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [currentModel, setCurrentModel] = useState<string>('openai/gpt-4o');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const refreshData = useCallback(async () => {
    const results = await Promise.allSettled([
      api.getMarketPrices(),
      api.getNews(),
      api.getLatestSummary(),
      api.getModels(),
    ]);

    const loadedPrices = results[0].status === 'fulfilled' ? results[0].value : [];
    const loadedArticles = results[1].status === 'fulfilled' ? results[1].value : [];

    if (results[0].status === 'fulfilled') setPrices(loadedPrices);
    if (results[1].status === 'fulfilled') setArticles(loadedArticles);
    if (results[2].status === 'fulfilled') setSummary(results[2].value);
    if (results[3].status === 'fulfilled') {
      const modelList = results[3].value;
      setModels(modelList);
      if (modelList.length > 0 && currentModel === 'openai/gpt-4o') {
        setCurrentModel(modelList[0].id);
      }
    }

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
  }, [currentModel]);

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

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const newSummary = await api.generateSummary();
      setSummary(newSummary);
    } catch {
      // silently handle — user can retry
    } finally {
      setIsGenerating(false);
    }
  };

  const handleModelChange = async (modelId: string) => {
    setCurrentModel(modelId);
    try {
      await api.setModel(modelId);
    } catch {
      // revert on failure
      setCurrentModel(currentModel);
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
        models={models.map((m) => ({ id: m.id, name: m.name }))}
        onModelChange={handleModelChange}
        onGenerateSummary={handleGenerateSummary}
        isGenerating={isGenerating}
        lastUpdated={lastUpdated}
      />

      <main className="mx-auto max-w-7xl px-4 pt-20 pb-12 sm:px-6 lg:px-8">
        {/* Tab navigation */}
        <nav className="mb-8 flex flex-wrap gap-2">
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
        </nav>

        {/* Tab content */}
        {activeTab === 'overview' && <MarketOverview prices={prices} />}

        {activeTab === 'news' && <NewsFeed articles={articles} />}

        {activeTab === 'analysis' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d15]">
              <SummaryPanel summary={summary} isLoading={isLoading} />
            </div>
            <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d15] p-6">
              <Recommendations recommendations={summary?.recommendations ?? []} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

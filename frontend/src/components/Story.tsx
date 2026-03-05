'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SavedStory } from '@/types';
import { api } from '@/lib/api';
import TranslateToggle from './TranslateToggle';

type Period = '1w' | '1m' | '3m';

const PERIOD_LABELS: Record<Period, string> = {
  '1w': 'Within 1 Week',
  '1m': 'Within 1 Month',
  '3m': 'Within 3 Months',
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    timeZone: 'Asia/Hong_Kong',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SOURCE_LABELS: Record<string, string> = {
  active_stocks_analysis: 'Active Stocks – AI Analysis',
  active_stocks_money_flow: 'Active Stocks – Money Flow',
  top_gainers_analysis: 'Top Gainers – AI Analysis',
  top_gainers_money_flow: 'Top Gainers – Money Flow',
  premarket_analysis: 'Pre-Market Analysis',
  ai_market_analysis: 'AI Market Analysis',
};

function renderMarkdown(text: string, keyPrefix: string) {
  return text.split('\n').map((line, i) => {
    if (line.startsWith('# ')) return <h1 key={`${keyPrefix}-${i}`} className="text-xl font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>;
    if (line.startsWith('## ')) return <h2 key={`${keyPrefix}-${i}`} className="text-lg font-bold text-white mt-4 mb-2">{line.slice(3)}</h2>;
    if (line.startsWith('### ')) return <h3 key={`${keyPrefix}-${i}`} className="text-base font-semibold text-white mt-3 mb-1">{line.slice(4)}</h3>;
    if (line.startsWith('#### ')) return <h4 key={`${keyPrefix}-${i}`} className="text-sm font-semibold text-white mt-2 mb-1">{line.slice(5)}</h4>;
    if (line.startsWith('**') && line.endsWith('**')) return <p key={`${keyPrefix}-${i}`} className="font-bold text-white mt-2">{line.slice(2, -2)}</p>;
    if (line.startsWith('- ') || line.startsWith('* ')) return <li key={`${keyPrefix}-${i}`} className="ml-4 list-disc">{line.slice(2)}</li>;
    if (line.startsWith('|')) return <p key={`${keyPrefix}-${i}`} className="font-mono text-xs mb-0">{line}</p>;
    if (line.trim() === '') return <br key={`${keyPrefix}-${i}`} />;
    return <p key={`${keyPrefix}-${i}`} className="mb-1">{line}</p>;
  });
}

export default function Story({ visible }: { visible?: boolean }) {
  const [stories, setStories] = useState<SavedStory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Market filter
  const [market, setMarket] = useState<'US' | 'HK'>('US');

  // Analysis
  const [period, setPeriod] = useState<Period>('1m');
  const [analyseSource, setAnalyseSource] = useState<string>('');
  const [analysing, setAnalysing] = useState(false);
  const [trendAnalysis, setTrendAnalysis] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [translatedTrend, setTranslatedTrend] = useState<string | null>(null);
  const [savingTrend, setSavingTrend] = useState(false);
  const [trendSaved, setTrendSaved] = useState(false);

  // Read Stories (saved trend analyses)
  const [showReadStories, setShowReadStories] = useState(false);
  const [savedTrends, setSavedTrends] = useState<SavedStory[]>([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const [deleteTrendConfirm, setDeleteTrendConfirm] = useState<number | null>(null);
  const [deletingTrend, setDeletingTrend] = useState(false);
  const [expandedTrends, setExpandedTrends] = useState<Set<number>>(new Set());

  // Expanded story cards
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const fetchStories = useCallback(async (m: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getStories(1, 200, m, undefined, 'trend_analysis');
      setStories(data.stories);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStories(market); }, [fetchStories, market]);

  // Re-fetch when tab becomes visible
  useEffect(() => {
    if (visible) fetchStories(market);
  }, [visible, fetchStories, market]);

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      await api.deleteStory(id);
      setStories((prev) => prev.filter((s) => s.id !== id));
      setDeleteConfirm(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleAnalyse = async () => {
    setAnalysing(true);
    setAnalysisError(null);
    setTrendAnalysis(null);
    setTranslatedTrend(null);
    setTrendSaved(false);
    try {
      const data = await api.analyseStories(period, market, analyseSource || undefined);
      setTrendAnalysis(data.analysis);
    } catch (e: unknown) {
      setAnalysisError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setAnalysing(false);
    }
  };

  const handleSaveTrend = async () => {
    if (!trendAnalysis) return;
    setSavingTrend(true);
    try {
      await api.saveStory(
        'trend_analysis',
        `Trend Analysis${analyseSource ? ` of ${SOURCE_LABELS[analyseSource] || analyseSource}` : ''} — ${PERIOD_LABELS[period]} (${market})`,
        trendAnalysis,
        market,
      );
      setTrendSaved(true);
      setTimeout(() => setTrendSaved(false), 3000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingTrend(false);
    }
  };

  const fetchSavedTrends = useCallback(async () => {
    setLoadingTrends(true);
    try {
      const data = await api.getStories(1, 200, market, 'trend_analysis');
      setSavedTrends(data.stories);
    } catch {
      setSavedTrends([]);
    } finally {
      setLoadingTrends(false);
    }
  }, [market]);

  const handleReadStories = () => {
    if (showReadStories) {
      setShowReadStories(false);
    } else {
      setShowReadStories(true);
      fetchSavedTrends();
    }
  };

  // Re-fetch saved trends when market changes while panel is open
  useEffect(() => {
    if (showReadStories) fetchSavedTrends();
  }, [showReadStories, fetchSavedTrends]);

  const handleDeleteTrend = async (id: number) => {
    setDeletingTrend(true);
    try {
      await api.deleteStory(id);
      setSavedTrends((prev) => prev.filter((s) => s.id !== id));
      setDeleteTrendConfirm(null);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeletingTrend(false);
    }
  };

  const toggleExpandTrend = (id: number) => {
    setExpandedTrends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section className="space-y-6">
      {/* Header & Analyse Controls */}
      <div className="rounded-xl border border-[#1e1e2e] bg-[#0a0a12] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              Story — Saved Analyses ({stories.length})
            </h2>
            <p className="mt-1 text-xs text-gray-500">Save AI analysis results from other pages, then analyse trends over time.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Market toggle */}
            <div className="flex rounded-lg border border-gray-700 overflow-hidden">
              {(['US', 'HK'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMarket(m)}
                  className={`px-3 py-2 text-sm font-medium transition ${
                    market === m
                      ? 'bg-indigo-600 text-white'
                      : 'bg-[#111118] text-gray-400 hover:text-white'
                  }`}
                >
                  {m === 'US' ? '🇺🇸 US' : '🇭🇰 HK'}
                </button>
              ))}
            </div>

            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="rounded-lg border border-gray-700 bg-[#111118] px-3 py-2 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none"
            >
              {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select
              value={analyseSource}
              onChange={(e) => setAnalyseSource(e.target.value)}
              className="rounded-lg border border-gray-700 bg-[#111118] px-3 py-2 text-sm text-gray-300 focus:border-indigo-500 focus:outline-none"
            >
              <option value="">All Sources</option>
              <option value="active_stocks_analysis">Active Stocks – AI Analysis</option>
              <option value="active_stocks_money_flow">Active Stocks – Money Flow</option>
              <option value="top_gainers_analysis">Top Gainers – AI Analysis</option>
              <option value="top_gainers_money_flow">Top Gainers – Money Flow</option>
              <option value="premarket_analysis">Pre-Market Analysis</option>
              <option value="ai_market_analysis">AI Market Analysis</option>
            </select>
            <button
              onClick={handleAnalyse}
              disabled={analysing || stories.length === 0}
              className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {analysing ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
                </svg>
              )}
              {analysing ? 'Analysing...' : 'Analyse Stories'}
            </button>
            <button
              onClick={handleReadStories}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                showReadStories
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                  : 'bg-emerald-600/20 text-emerald-300 border border-emerald-700/30 hover:bg-emerald-600/30'
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              Read Stories
            </button>
          </div>
        </div>
      </div>

      {/* Trend Analysis Result */}
      {analysing && (
        <div className="rounded-xl border border-indigo-800/30 bg-indigo-900/10 p-6">
          <div className="flex items-center gap-3 text-indigo-300">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
            </svg>
            <span className="text-sm font-medium">AI is analysing trends across your saved stories... This may take a minute.</span>
          </div>
        </div>
      )}

      {analysisError && (
        <div className="rounded-xl border border-red-800/30 bg-red-900/10 p-4">
          <p className="text-sm text-red-400">{analysisError}</p>
        </div>
      )}

      {trendAnalysis && !analysing && (
        <div className="rounded-xl border border-indigo-800/30 bg-[#0d0d15] p-6">
          <h3 className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg font-bold text-white">
              <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              Trend Analysis{analyseSource ? ` of ${SOURCE_LABELS[analyseSource] || analyseSource}` : ''} — {PERIOD_LABELS[period]}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveTrend}
                disabled={savingTrend}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  trendSaved
                    ? 'bg-green-600/20 text-green-400 border border-green-700/30'
                    : 'bg-indigo-600/20 text-indigo-300 border border-indigo-700/30 hover:bg-indigo-600/30'
                } disabled:opacity-50`}
              >
                {trendSaved ? (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    Saved!
                  </>
                ) : savingTrend ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                    </svg>
                    Save
                  </>
                )}
              </button>
              <TranslateToggle
                originalText={trendAnalysis}
                onTranslated={(t) => setTranslatedTrend(t)}
                onRestore={() => setTranslatedTrend(null)}
                isTranslated={translatedTrend !== null}
              />
            </div>
          </h3>
          <div className="prose prose-invert prose-sm max-w-none text-gray-300 whitespace-pre-wrap">
            {renderMarkdown(translatedTrend ?? trendAnalysis, 'trend')}
          </div>
        </div>
      )}

      {/* Read Stories — Saved Trend Analyses */}
      {showReadStories && (
        <div className="rounded-xl border border-emerald-800/30 bg-[#0a0a12] p-5">
          <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            Saved Trend Analyses — {market === 'US' ? '🇺🇸 US' : '🇭🇰 HK'} ({savedTrends.length})
          </h3>

          {loadingTrends ? (
            <div className="flex items-center justify-center py-8">
              <svg className="h-6 w-6 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
              </svg>
            </div>
          ) : savedTrends.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No saved trend analyses yet. Analyse stories and click Save to keep them here.</p>
          ) : (
            <div className="space-y-3">
              {savedTrends.map((t) => (
                <div key={t.id} className="rounded-lg border border-[#1e1e2e] bg-[#111118] overflow-hidden">
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#161622] transition"
                    onClick={() => toggleExpandTrend(t.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-300 truncate">{t.title}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{formatTimestamp(t.saved_at)}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {deleteTrendConfirm === t.id ? (
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs text-red-400">Delete?</span>
                          <button
                            onClick={() => handleDeleteTrend(t.id)}
                            disabled={deletingTrend}
                            className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                          >
                            {deletingTrend ? '...' : 'Yes'}
                          </button>
                          <button
                            onClick={() => setDeleteTrendConfirm(null)}
                            className="rounded bg-gray-700 px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-600"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTrendConfirm(t.id); }}
                          className="rounded p-1.5 text-gray-500 hover:bg-red-900/20 hover:text-red-400 transition"
                          title="Delete"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      )}
                      <svg
                        className={`h-4 w-4 text-gray-500 transition-transform ${expandedTrends.has(t.id) ? 'rotate-180' : ''}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                      </svg>
                    </div>
                  </div>
                  {expandedTrends.has(t.id) && (
                    <div className="border-t border-[#1e1e2e] px-4 py-4">
                      <div className="prose prose-invert prose-sm max-w-none text-gray-300 whitespace-pre-wrap">
                        {renderMarkdown(t.content, `st-${t.id}`)}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stories List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <svg className="h-6 w-6 animate-spin text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
          </svg>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-800/30 bg-red-900/10 p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      ) : stories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="mb-4 h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
          <p className="text-sm text-gray-500">No saved stories yet.</p>
          <p className="mt-1 text-xs text-gray-600">Save AI analysis results from Active Stocks, Top Gainers, or AI Analysis pages.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {stories.map((story) => (
            <div key={story.id} className="rounded-xl border border-[#1e1e2e] bg-[#0a0a12] overflow-hidden">
              {/* Story Header */}
              <div
                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-[#111118] transition"
                onClick={() => toggleExpand(story.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-medium text-indigo-300 whitespace-nowrap">
                      {SOURCE_LABELS[story.source] || story.source}
                    </span>
                    <span className="text-xs text-gray-500">{formatTimestamp(story.saved_at)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-300 truncate">{story.title}</p>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {/* Delete button */}
                  {deleteConfirm === story.id ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-red-400">Delete?</span>
                      <button
                        onClick={() => handleDelete(story.id)}
                        disabled={deleting}
                        className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 disabled:opacity-50"
                      >
                        {deleting ? '...' : 'Yes'}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="rounded bg-gray-700 px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-600"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteConfirm(story.id); }}
                      className="rounded p-1.5 text-gray-500 hover:bg-red-900/20 hover:text-red-400 transition"
                      title="Delete story"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  )}

                  {/* Expand/collapse */}
                  <svg
                    className={`h-4 w-4 text-gray-500 transition-transform ${expanded.has(story.id) ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </div>
              </div>

              {/* Expanded content */}
              {expanded.has(story.id) && (
                <div className="border-t border-[#1e1e2e] px-5 py-4">
                  <div className="prose prose-invert prose-sm max-w-none text-gray-300 whitespace-pre-wrap">
                    {renderMarkdown(story.content, `story-${story.id}`)}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

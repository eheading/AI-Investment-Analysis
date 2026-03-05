'use client';

import { useState } from 'react';
import type { PremarketData, PremarketAnalysis, SectorPrediction } from '@/types';
import { api } from '@/lib/api';
import TranslateToggle from './TranslateToggle';
import SaveToStoryButton from './SaveToStoryButton';

export default function PreMarket() {
  const [data, setData] = useState<PremarketData | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [predictions, setPredictions] = useState<SectorPrediction[]>([]);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translatedAnalysis, setTranslatedAnalysis] = useState<string | null>(null);

  const handleFetchData = async () => {
    setLoadingData(true);
    setError(null);
    try {
      const result = await api.getPremarketData();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch pre-market data');
    } finally {
      setLoadingData(false);
    }
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setTranslatedAnalysis(null);
    try {
      const result: PremarketAnalysis = await api.analyzePremarket();
      setData(result.premarket_data);
      setAnalysis(result.analysis);
      setPredictions(result.sector_predictions);
      setModelUsed(result.model_used);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze pre-market data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">🌅 Pre-Market Analysis</h2>
          <p className="mt-1 text-sm text-gray-400">
            US market sector inflow predictions based on futures, sector ETFs, overnight global moves &amp; news
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleFetchData}
            disabled={loadingData || loading}
            className="rounded-lg bg-[#1e1e2e] px-4 py-2 text-sm font-medium text-gray-300 hover:bg-[#2a2a3e] hover:text-white transition-colors disabled:opacity-50"
          >
            {loadingData ? 'Loading...' : '📊 Fetch Data'}
          </button>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
                </svg>
                Analyzing...
              </span>
            ) : '🤖 Run AI Analysis'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Pre-market data dashboard */}
      {data && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* US Futures */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d15] p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">US Index Futures</h3>
            <div className="space-y-2">
              {data.futures.map((f) => (
                <div key={f.symbol} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{f.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{f.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      (f.change_pct ?? 0) >= 0 ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
                    }`}>
                      {(f.change_pct ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(f.change_pct ?? 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sector ETFs */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d15] p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">Sector ETFs</h3>
            <div className="space-y-2">
              {[...data.sector_etfs]
                .sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0))
                .map((e) => (
                <div key={e.symbol} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">
                    <span className="text-gray-500 mr-1">{e.symbol}</span> {e.name}
                  </span>
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                    (e.change_pct ?? 0) >= 0 ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
                  }`}>
                    {(e.change_pct ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(e.change_pct ?? 0).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* VIX & Yields */}
          <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d15] p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-400 uppercase tracking-wider">Volatility &amp; Yields</h3>
            <div className="space-y-2">
              {data.volatility_rates.map((v) => (
                <div key={v.symbol} className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">{v.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{v.price.toFixed(2)}</span>
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      (v.change_pct ?? 0) >= 0 ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
                    }`}>
                      {(v.change_pct ?? 0) >= 0 ? '▲' : '▼'} {Math.abs(v.change_pct ?? 0).toFixed(2)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sector Predictions Cards */}
      {predictions.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-bold text-white">Sector Inflow/Outflow Predictions</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {predictions.map((p, i) => (
              <div
                key={i}
                className={`rounded-xl border p-4 ${
                  p.direction === 'INFLOW'
                    ? 'border-green-800/50 bg-green-900/10'
                    : 'border-red-800/50 bg-red-900/10'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                      p.direction === 'INFLOW'
                        ? 'bg-green-600/30 text-green-400'
                        : 'bg-red-600/30 text-red-400'
                    }`}>
                      {p.direction === 'INFLOW' ? '💰 INFLOW' : '📤 OUTFLOW'}
                    </span>
                    <span className="text-sm font-bold text-white">{p.sector}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500">Confidence:</span>
                    <span className={`text-xs font-bold ${
                      p.confidence >= 7 ? 'text-green-400' : p.confidence >= 4 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {p.confidence}/10
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mb-2">{p.reasoning}</p>
                {p.top_picks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {p.top_picks.map((ticker) => (
                      <span
                        key={ticker}
                        className="rounded bg-[#1e1e2e] px-2 py-0.5 text-xs font-mono text-blue-400"
                      >
                        {ticker}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full AI Analysis */}
      {analysis && (
        <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d15] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Full AI Analysis</h3>
            <div className="flex items-center gap-2">
              {modelUsed && (
                <span className="text-xs text-gray-500">Model: {modelUsed}</span>
              )}
              <TranslateToggle
                originalText={analysis}
                onTranslated={setTranslatedAnalysis}
                onRestore={() => setTranslatedAnalysis(null)}
                isTranslated={translatedAnalysis !== null}
              />
              <SaveToStoryButton
                source="premarket_analysis"
                title={`Pre-Market Analysis - ${new Date().toLocaleDateString()}`}
                content={translatedAnalysis || analysis}
                defaultMarket="US"
              />
            </div>
          </div>
          <div
            className="prose prose-invert prose-sm max-w-none text-gray-300"
            style={{ whiteSpace: 'pre-wrap' }}
          >
            {translatedAnalysis || analysis}
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16">
          <svg className="h-10 w-10 animate-spin text-blue-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
          </svg>
          <p className="text-sm text-gray-400">Collecting pre-market data and running AI analysis...</p>
          <p className="text-xs text-gray-600 mt-1">This may take a minute</p>
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-4xl mb-4">🌅</p>
          <h3 className="text-lg font-semibold text-gray-300 mb-2">Pre-Market Intelligence</h3>
          <p className="text-sm text-gray-500 max-w-md">
            Click <strong>&quot;Fetch Data&quot;</strong> to view current pre-market signals, or{' '}
            <strong>&quot;Run AI Analysis&quot;</strong> to get sector inflow/outflow predictions for market open.
          </p>
        </div>
      )}
    </div>
  );
}

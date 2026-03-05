'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ActiveStock } from '@/types';
import { api } from '@/lib/api';
import ChartModal from './ChartModal';
import TranslateToggle from './TranslateToggle';

type Market = 'US' | 'HK';

export default function TopGainers() {
  const [market, setMarket] = useState<Market>('US');
  const [stocks, setStocks] = useState<ActiveStock[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [moneyFlow, setMoneyFlow] = useState<string | null>(null);
  const [analyzingFlow, setAnalyzingFlow] = useState(false);
  const [translatedAnalysis, setTranslatedAnalysis] = useState<string | null>(null);
  const [translatedFlow, setTranslatedFlow] = useState<string | null>(null);
  const [chartSymbol, setChartSymbol] = useState<{ symbol: string; name: string } | null>(null);

  const fetchStocks = useCallback(async (m: Market) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getTopGainers(m);
      setStocks(data.stocks);
      setSelected(new Set());
      setAnalysis(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch stocks');
      setStocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStocks(market);
  }, [market, fetchStocks]);

  const toggleSelect = (symbol: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === stocks.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(stocks.map((s) => s.symbol)));
    }
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const symbols = selected.size > 0 ? Array.from(selected) : undefined;
      const result = await api.analyzeTopGainers(market, symbols);
      setAnalysis(result.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleMoneyFlow = async () => {
    setAnalyzingFlow(true);
    setError(null);
    try {
      const result = await api.analyzeGainersMoneyFlow(market);
      setMoneyFlow(result.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Money flow analysis failed');
    } finally {
      setAnalyzingFlow(false);
    }
  };

  const changeColor = (change: string) => {
    if (!change) return 'text-gray-400';
    if (change.startsWith('+') || (change.startsWith('0') === false && !change.startsWith('-') && parseFloat(change) > 0))
      return 'text-[#22c55e]';
    if (change.startsWith('-')) return 'text-[#ef4444]';
    return 'text-gray-400';
  };

  return (
    <section>
      {chartSymbol && (
        <ChartModal
          symbol={chartSymbol.symbol}
          name={chartSymbol.name}
          onClose={() => setChartSymbol(null)}
        />
      )}

      {/* Controls */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        {/* Market toggle */}
        {(['US', 'HK'] as Market[]).map((m) => (
          <button
            key={m}
            onClick={() => setMarket(m)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors ${
              market === m
                ? 'bg-blue-600 text-white'
                : 'bg-[#1e1e2e] text-gray-400 hover:text-gray-200'
            }`}
          >
            {m === 'US' ? '🇺🇸 US Market' : '🇭🇰 HK Market'}
          </button>
        ))}

        {/* Refresh */}
        <button
          onClick={() => fetchStocks(market)}
          disabled={loading}
          className="rounded-full bg-[#1e1e2e] px-4 py-2 text-sm font-medium text-gray-300 hover:bg-[#2a2a3e] hover:text-white transition-colors disabled:opacity-50"
        >
          <svg
            className={`inline h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
          </svg>
          Refresh
        </button>

        {/* AI Money Flow */}
        <button
          onClick={handleMoneyFlow}
          disabled={analyzingFlow || loading || stocks.length === 0}
          className="rounded-full bg-amber-600 px-5 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {analyzingFlow ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
              </svg>
              Analysing Flow...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
              AI Money Flow
            </>
          )}
        </button>

        {/* AI Analyze */}
        <button
          onClick={handleAnalyze}
          disabled={analyzing || loading || stocks.length === 0}
          className="ml-auto rounded-full bg-purple-600 px-5 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {analyzing ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              AI Analyze ({selected.size > 0 ? selected.size : 'All'})
            </>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[#1e1e2e] bg-[#0d0d15]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e1e2e] text-left text-xs uppercase tracking-wider text-gray-500">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={stocks.length > 0 && selected.size === stocks.length}
                  onChange={toggleSelectAll}
                  className="rounded border-gray-600 bg-transparent"
                />
              </th>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3 text-right">Change %</th>
              <th className="px-4 py-3 text-right">Volume</th>
              <th className="px-4 py-3 text-right">Market Cap</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#1e1e2e] animate-pulse">
                    <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-[#1e1e2e]" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-[#1e1e2e]" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-[#1e1e2e]" /></td>
                    <td className="px-4 py-3"><div className="ml-auto h-4 w-16 rounded bg-[#1e1e2e]" /></td>
                    <td className="px-4 py-3"><div className="ml-auto h-4 w-14 rounded bg-[#1e1e2e]" /></td>
                    <td className="px-4 py-3"><div className="ml-auto h-4 w-14 rounded bg-[#1e1e2e]" /></td>
                    <td className="px-4 py-3"><div className="ml-auto h-4 w-16 rounded bg-[#1e1e2e]" /></td>
                    <td className="px-4 py-3"><div className="ml-auto h-4 w-16 rounded bg-[#1e1e2e]" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-4 rounded bg-[#1e1e2e]" /></td>
                  </tr>
                ))
              : stocks.map((stock) => (
                  <tr
                    key={stock.symbol}
                    className="border-b border-[#1e1e2e] hover:bg-[#1e1e2e]/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(stock.symbol)}
                        onChange={() => toggleSelect(stock.symbol)}
                        className="rounded border-gray-600 bg-transparent"
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold text-white">{stock.symbol}</td>
                    <td className="px-4 py-3 text-gray-300 max-w-[200px] truncate">{stock.name}</td>
                    <td className="px-4 py-3 text-right text-white font-medium">{stock.price}</td>
                    <td className={`px-4 py-3 text-right font-medium ${changeColor(stock.change_pct)}`}>
                      {stock.change}
                    </td>
                    <td className={`px-4 py-3 text-right font-medium ${changeColor(stock.change_pct)}`}>
                      {stock.change_pct}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-300">{stock.volume}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{stock.market_cap}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setChartSymbol({ symbol: stock.symbol, name: stock.name })}
                        className="rounded p-1 text-gray-500 hover:bg-[#1e1e2e] hover:text-blue-400 transition-colors"
                        title="View chart"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && stocks.length === 0 && (
          <div className="py-12 text-center text-sm text-gray-500">
            No top gainers data available.
          </div>
        )}
      </div>

      {/* AI Analysis */}
      {analyzing && (
        <div className="mt-6 rounded-xl border border-purple-800/30 bg-purple-900/10 p-6">
          <div className="flex items-center gap-3 text-purple-300">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
            </svg>
            <span className="text-sm font-medium">AI is analyzing the stocks... This may take a minute.</span>
          </div>
        </div>
      )}

      {analysis && !analyzing && (
        <div className="mt-6 rounded-xl border border-[#1e1e2e] bg-[#0d0d15] p-6">
          <h3 className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg font-bold text-white">
              <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
              </svg>
              AI Analysis
            </span>
            <TranslateToggle
              originalText={analysis}
              onTranslated={(t) => setTranslatedAnalysis(t)}
              onRestore={() => setTranslatedAnalysis(null)}
              isTranslated={translatedAnalysis !== null}
            />
          </h3>
          <div className="prose prose-invert prose-sm max-w-none text-gray-300 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-white [&>h4]:text-white [&>strong]:text-white [&>ul]:text-gray-300 [&>ol]:text-gray-300 whitespace-pre-wrap">
            {(translatedAnalysis ?? analysis).split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>;
              if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-white mt-4 mb-2">{line.slice(3)}</h2>;
              if (line.startsWith('### ')) return <h3 key={i} className="text-base font-semibold text-white mt-3 mb-1">{line.slice(4)}</h3>;
              if (line.startsWith('#### ')) return <h4 key={i} className="text-sm font-semibold text-white mt-2 mb-1">{line.slice(5)}</h4>;
              if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold text-white mt-2">{line.slice(2, -2)}</p>;
              if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
              if (line.trim() === '') return <br key={i} />;
              return <p key={i} className="mb-1">{line}</p>;
            })}
          </div>
        </div>
      )}

      {/* Money Flow Loading */}
      {analyzingFlow && (
        <div className="mt-6 rounded-xl border border-amber-800/30 bg-amber-900/10 p-6">
          <div className="flex items-center gap-3 text-amber-300">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
            </svg>
            <span className="text-sm font-medium">AI is analysing sector money flow... This may take a minute.</span>
          </div>
        </div>
      )}

      {/* Money Flow Result */}
      {moneyFlow && !analyzingFlow && (
        <div className="mt-6 rounded-xl border border-amber-800/30 bg-[#0d0d15] p-6">
          <h3 className="mb-4 flex items-center justify-between">
            <span className="flex items-center gap-2 text-lg font-bold text-white">
              <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
              AI Money Flow Analysis
            </span>
            <TranslateToggle
              originalText={moneyFlow}
              onTranslated={(t) => setTranslatedFlow(t)}
              onRestore={() => setTranslatedFlow(null)}
              isTranslated={translatedFlow !== null}
            />
          </h3>
          <div className="prose prose-invert prose-sm max-w-none text-gray-300 [&>h1]:text-white [&>h2]:text-white [&>h3]:text-white [&>h4]:text-white [&>strong]:text-white [&>ul]:text-gray-300 [&>ol]:text-gray-300 whitespace-pre-wrap">
            {(translatedFlow ?? moneyFlow).split('\n').map((line, i) => {
              if (line.startsWith('# ')) return <h1 key={`mf-${i}`} className="text-xl font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>;
              if (line.startsWith('## ')) return <h2 key={`mf-${i}`} className="text-lg font-bold text-white mt-4 mb-2">{line.slice(3)}</h2>;
              if (line.startsWith('### ')) return <h3 key={`mf-${i}`} className="text-base font-semibold text-white mt-3 mb-1">{line.slice(4)}</h3>;
              if (line.startsWith('#### ')) return <h4 key={`mf-${i}`} className="text-sm font-semibold text-white mt-2 mb-1">{line.slice(5)}</h4>;
              if (line.startsWith('**') && line.endsWith('**')) return <p key={`mf-${i}`} className="font-bold text-white mt-2">{line.slice(2, -2)}</p>;
              if (line.startsWith('- ') || line.startsWith('* ')) return <li key={`mf-${i}`} className="ml-4 list-disc">{line.slice(2)}</li>;
              if (line.startsWith('|')) return <p key={`mf-${i}`} className="font-mono text-xs mb-0">{line}</p>;
              if (line.trim() === '') return <br key={`mf-${i}`} />;
              return <p key={`mf-${i}`} className="mb-1">{line}</p>;
            })}
          </div>
        </div>
      )}
    </section>
  );
}

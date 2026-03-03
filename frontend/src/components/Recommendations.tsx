'use client';

export interface Recommendation {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  reasoning: string;
  confidence: number;
}

const actionStyles = {
  BUY: 'bg-[#22c55e]/20 text-[#22c55e]',
  SELL: 'bg-[#ef4444]/20 text-[#ef4444]',
  HOLD: 'bg-[#eab308]/20 text-[#eab308]',
} as const;

function confidenceColor(confidence: number): string {
  if (confidence >= 7) return 'bg-[#22c55e]';
  if (confidence >= 4) return 'bg-[#eab308]';
  return 'bg-[#ef4444]';
}

export default function Recommendations({ recommendations }: { recommendations: Recommendation[] }) {
  const sorted = [...recommendations].sort((a, b) => b.confidence - a.confidence);

  const buyCount = recommendations.filter((r) => r.action === 'BUY').length;
  const sellCount = recommendations.filter((r) => r.action === 'SELL').length;
  const holdCount = recommendations.filter((r) => r.action === 'HOLD').length;

  return (
    <section>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13h2v8H3zm6-4h2v12H9zm6-6h2v18h-2zm6 10h2v8h-2z" />
        </svg>
        <h2 className="text-xl font-bold text-white">AI Recommendations</h2>
      </div>

      {/* Summary stats */}
      <div className="flex items-center gap-3 mb-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#22c55e]/20 px-3 py-1 text-sm font-medium text-[#22c55e]">
          BUY {buyCount}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ef4444]/20 px-3 py-1 text-sm font-medium text-[#ef4444]">
          SELL {sellCount}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eab308]/20 px-3 py-1 text-sm font-medium text-[#eab308]">
          HOLD {holdCount}
        </span>
      </div>

      {/* Cards */}
      {sorted.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No recommendations available</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((rec) => (
            <div
              key={rec.symbol}
              className="rounded-lg border border-[#1e1e2e] bg-[#111118] p-4"
            >
              {/* Symbol + Action badge */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-lg font-bold text-white">{rec.symbol}</span>
                <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${actionStyles[rec.action]}`}>
                  {rec.action}
                </span>
              </div>

              {/* Confidence meter */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">Confidence: {rec.confidence}/10</span>
                </div>
                <div className="h-2 w-full rounded-full bg-gray-700">
                  <div
                    className={`h-2 rounded-full ${confidenceColor(rec.confidence)}`}
                    style={{ width: `${(rec.confidence / 10) * 100}%` }}
                  />
                </div>
              </div>

              {/* Reasoning */}
              <p className="text-sm text-gray-400">{rec.reasoning}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

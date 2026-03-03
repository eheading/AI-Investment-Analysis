'use client';

import { useState } from 'react';
import { PriceSnapshot } from '@/types';
import ChartModal from './ChartModal';

const TABS = [
  { key: 'index', label: 'Indexes' },
  { key: 'commodity', label: 'Commodities' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'currency', label: 'Currencies' },
] as const;

type Category = PriceSnapshot['category'];

function formatPrice(price: number, category: Category): string {
  const decimals = category === 'currency' ? 4 : 2;
  return price.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function RegionBadge({ region }: { region: string }) {
  return (
    <span className="inline-block rounded-full bg-[#1e1e2e] px-2 py-0.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
      {region}
    </span>
  );
}

function PriceCard({ item, onClick }: { item: PriceSnapshot; onClick: () => void }) {
  const changePct = item.change_pct ?? 0;
  const positive = changePct >= 0;
  return (
    <div
      className="rounded-lg border border-[#1e1e2e] bg-[#111118] p-4 cursor-pointer hover:border-blue-500/50 transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{item.name}</p>
          <p className="text-xs text-gray-500">{item.symbol}</p>
        </div>
        <RegionBadge region={item.region} />
      </div>
      <p className="mt-3 text-lg font-bold text-white">
        {formatPrice(item.price, item.category)}
      </p>
      <p className={`mt-1 text-sm font-medium ${positive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
        {positive ? '▲' : '▼'} {positive ? '+' : ''}
        {changePct.toFixed(2)}%
      </p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-lg border border-[#1e1e2e] bg-[#111118] p-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-[#1e1e2e]" />
          <div className="h-3 w-16 rounded bg-[#1e1e2e]" />
        </div>
        <div className="h-4 w-10 rounded-full bg-[#1e1e2e]" />
      </div>
      <div className="mt-3 h-5 w-20 rounded bg-[#1e1e2e]" />
      <div className="mt-2 h-4 w-14 rounded bg-[#1e1e2e]" />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export default function MarketOverview({ prices }: { prices: PriceSnapshot[] }) {
  const [activeTab, setActiveTab] = useState<Category>('index');
  const [chartItem, setChartItem] = useState<PriceSnapshot | null>(null);

  const filtered = prices.filter((p) => p.category === activeTab);

  const loading = prices.length === 0;

  return (
    <section>
      {/* Chart modal */}
      {chartItem && (
        <ChartModal
          symbol={chartItem.symbol}
          name={chartItem.name}
          onClose={() => setChartItem(null)}
        />
      )}

      {/* Tab pills */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-[#1e1e2e] text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <SkeletonGrid />
      ) : activeTab === 'index' ? (
        <IndexGrid items={filtered} onSelect={setChartItem} />
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => (
            <PriceCard key={item.id} item={item} onClick={() => setChartItem(item)} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Indexes sub-grouped by region */
function IndexGrid({ items, onSelect }: { items: PriceSnapshot[]; onSelect: (item: PriceSnapshot) => void }) {
  const grouped = items.reduce<Record<string, PriceSnapshot[]>>((acc, item) => {
    (acc[item.region] ??= []).push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([region, regionItems]) => (
        <div key={region}>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            {region}
          </h3>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {regionItems.map((item) => (
              <PriceCard key={item.id} item={item} onClick={() => onSelect(item)} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

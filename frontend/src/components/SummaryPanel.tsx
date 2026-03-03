'use client';

import { useState } from 'react';

export interface Recommendation {
  symbol: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  reasoning: string;
  confidence: number;
}

export interface AISummary {
  id: number;
  model_used: string;
  market_summary: string;
  recommendations: Recommendation[];
  news_digest: string;
  created_at: string;
}

interface SummaryPanelProps {
  summary: AISummary | null;
  isLoading: boolean;
}

/** Convert simple markdown-like syntax to HTML: **bold**, line breaks, and bullet points. */
function formatMarkdown(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
        return `<li class="ml-4 list-disc">${trimmed.slice(2)}</li>`;
      }
      if (trimmed === '') return '<br />';
      return `<p>${trimmed}</p>`;
    })
    .join('');
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// --- Sub-components ---

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <svg
        className="mb-4 h-12 w-12 text-gray-600"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
        />
      </svg>
      <p className="text-sm text-gray-500">
        No summaries yet. Click <span className="text-gray-300">Generate Summary</span> to create one.
      </p>
    </div>
  );
}

function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="h-6 w-48 rounded bg-gray-700/50" />
        <div className="h-5 w-16 rounded-full bg-gray-700/50" />
      </div>
      <div className="h-3 w-32 rounded bg-gray-700/30" />
      <div className="space-y-3 rounded-lg bg-[#111118] p-5">
        <div className="h-4 w-36 rounded bg-gray-700/40" />
        <div className="h-3 w-full rounded bg-gray-700/30" />
        <div className="h-3 w-5/6 rounded bg-gray-700/30" />
        <div className="h-3 w-4/6 rounded bg-gray-700/30" />
      </div>
      <div className="space-y-3 rounded-lg bg-[#111118] p-5">
        <div className="h-4 w-28 rounded bg-gray-700/40" />
        <div className="h-3 w-full rounded bg-gray-700/30" />
        <div className="h-3 w-3/4 rounded bg-gray-700/30" />
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-400">
      {icon}
      {children}
    </h3>
  );
}

// --- Icons ---

function ChartIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}

function NewspaperIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5" />
    </svg>
  );
}

// --- Main Component ---

export default function SummaryPanel({ summary, isLoading }: SummaryPanelProps) {
  const [newsExpanded, setNewsExpanded] = useState(true);

  if (isLoading) return <SkeletonLoader />;
  if (!summary) return <EmptyState />;

  return (
    <div className="space-y-5 p-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white">AI Market Analysis</h2>
          <span className="rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-xs font-medium text-indigo-300">
            {summary.model_used}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">{formatTimestamp(summary.created_at)}</p>
      </div>

      <hr className="border-[#1e1e2e]" />

      {/* Market Summary */}
      <section>
        <SectionTitle icon={<ChartIcon />}>Market Summary</SectionTitle>
        <div className="rounded-lg bg-[#111118] p-5">
          <div
            className="prose-sm text-gray-300 leading-relaxed [&_strong]:text-white [&_li]:my-1 [&_p]:my-1.5 [&_p:first-child]:mt-0"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(summary.market_summary) }}
          />
        </div>
      </section>

      <hr className="border-[#1e1e2e]" />

      {/* News Digest (collapsible) */}
      <section>
        <button
          type="button"
          onClick={() => setNewsExpanded((prev) => !prev)}
          className="flex w-full items-center justify-between text-left"
        >
          <SectionTitle icon={<NewspaperIcon />}>News Digest</SectionTitle>
          <svg
            className={`h-4 w-4 text-gray-500 transition-transform ${newsExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
        {newsExpanded && (
          <div className="mt-2 rounded-lg bg-[#111118] p-5">
            <div
              className="prose-sm text-gray-300 leading-relaxed [&_strong]:text-white [&_li]:my-1 [&_p]:my-1.5 [&_p:first-child]:mt-0"
              dangerouslySetInnerHTML={{ __html: formatMarkdown(summary.news_digest) }}
            />
          </div>
        )}
      </section>
    </div>
  );
}

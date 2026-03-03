'use client';

import { useState } from 'react';
import { NewsArticle } from '@/types';

interface NewsFeedProps {
  articles: NewsArticle[];
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const past = new Date(dateStr).getTime();
  const diffMs = now - past;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

function SkeletonCard() {
  return (
    <div className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-4 mb-2 animate-pulse">
      <div className="h-4 bg-gray-700 rounded w-3/4 mb-3" />
      <div className="h-3 bg-gray-800 rounded w-full mb-1.5" />
      <div className="h-3 bg-gray-800 rounded w-5/6 mb-4" />
      <div className="flex items-center justify-between">
        <div className="h-5 bg-gray-700 rounded-full w-16" />
        <div className="h-3 bg-gray-800 rounded w-12" />
      </div>
    </div>
  );
}

export default function NewsFeed({ articles }: NewsFeedProps) {
  const [activeSource, setActiveSource] = useState<string>('All');

  // Loading skeleton
  if (articles.length === 0) {
    return (
      <div>
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <div className="h-7 w-12 bg-gray-800 rounded-full animate-pulse" />
          <div className="h-7 w-20 bg-gray-800 rounded-full animate-pulse" />
          <div className="h-7 w-24 bg-gray-800 rounded-full animate-pulse" />
        </div>
        <div className="max-h-[600px] overflow-y-auto pr-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const sources = Array.from(new Set(articles.map((a) => a.source)));
  const filtered =
    activeSource === 'All'
      ? articles
      : articles.filter((a) => a.source === activeSource);

  return (
    <div>
      {/* Source filter bar */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-thin">
        {['All', ...sources].map((src) => (
          <button
            key={src}
            onClick={() => setActiveSource(src)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              activeSource === src
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {src}
          </button>
        ))}
      </div>

      {/* Scrollable news list */}
      <div
        className="max-h-[600px] overflow-y-auto pr-1"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#2a2a3a transparent',
        }}
      >
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            No articles from this source
          </div>
        ) : (
          filtered.map((article) => (
            <div
              key={article.id}
              className="bg-[#111118] border border-[#1e1e2e] rounded-lg p-4 mb-2 transition-colors hover:border-[#2a2a4a]"
            >
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white font-bold text-sm hover:text-blue-400 transition-colors line-clamp-2"
              >
                {article.title}
              </a>
              <p className="text-gray-400 text-xs mt-2 line-clamp-3 leading-relaxed">
                {article.summary}
              </p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400">
                  {article.source}
                </span>
                <span className="text-[10px] text-gray-500">
                  {timeAgo(article.published_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

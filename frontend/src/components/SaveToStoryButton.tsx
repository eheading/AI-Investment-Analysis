'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface SaveToStoryButtonProps {
  source: string;
  title: string;
  content: string;
  defaultMarket?: 'US' | 'HK';
}

export default function SaveToStoryButton({ source, title, content, defaultMarket }: SaveToStoryButtonProps) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPicker, setShowPicker] = useState(false);

  const handleSave = async (market: 'US' | 'HK') => {
    setSaving(true);
    setShowPicker(false);
    try {
      await api.saveStory(source, title, content, market);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => {
          if (defaultMarket) {
            handleSave(defaultMarket);
          } else {
            setShowPicker((p) => !p);
          }
        }}
        disabled={saving}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
          saved
            ? 'bg-green-600/20 text-green-400 border border-green-700/30'
            : 'bg-indigo-600/20 text-indigo-300 border border-indigo-700/30 hover:bg-indigo-600/30'
        } disabled:opacity-50`}
        title="Save to Story"
      >
        {saved ? (
          <>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
            Saved!
          </>
        ) : saving ? (
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
            Save to Story
          </>
        )}
      </button>

      {/* Market picker dropdown */}
      {showPicker && (
        <div className="absolute right-0 top-full z-50 mt-1 rounded-lg border border-gray-700 bg-[#111118] shadow-xl">
          <button
            onClick={() => handleSave('US')}
            className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-gray-300 hover:bg-indigo-600/20 hover:text-white rounded-t-lg"
          >
            🇺🇸 US Market
          </button>
          <button
            onClick={() => handleSave('HK')}
            className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-gray-300 hover:bg-indigo-600/20 hover:text-white rounded-b-lg"
          >
            🇭🇰 HK Market
          </button>
        </div>
      )}
    </div>
  );
}

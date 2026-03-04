'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

interface TranslateToggleProps {
  originalText: string;
  onTranslated: (text: string) => void;
  onRestore: () => void;
  isTranslated: boolean;
}

export default function TranslateToggle({ originalText, onTranslated, onRestore, isTranslated }: TranslateToggleProps) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    if (isTranslated) {
      onRestore();
      return;
    }
    setLoading(true);
    try {
      const translated = await api.translateText(originalText, 'zh');
      onTranslated(translated);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-full border border-gray-600 px-3 py-1 text-xs font-medium text-gray-300 hover:border-gray-400 hover:text-white transition-colors disabled:opacity-50"
      title={isTranslated ? 'Switch to English' : 'Switch to Traditional Chinese'}
    >
      {loading ? (
        <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182M20.015 4.356v4.992" />
        </svg>
      ) : (
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m10.5 21 5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 0 1 6-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 0 1-3.827-5.802" />
        </svg>
      )}
      {loading ? 'Translating...' : isTranslated ? 'EN' : '中文'}
    </button>
  );
}

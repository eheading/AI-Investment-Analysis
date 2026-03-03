'use client';

import React from 'react';

interface HeaderProps {
  currentModel: string;
  models: { id: string; name: string }[];
  onModelChange: (modelId: string) => void;
  onGenerateSummary: () => void;
  isGenerating: boolean;
  lastUpdated: string | null;
}

const FALLBACK_MODELS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o' },
  { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini' },
  { id: 'openai/gpt-4.1', name: 'GPT-4.1' },
  { id: 'openai/o3-mini', name: 'OpenAI o3-mini' },
  { id: 'anthropic/claude-3.7-sonnet', name: 'Claude 3.7 Sonnet' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3.5-haiku', name: 'Claude 3.5 Haiku' },
  { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
  { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro' },
  { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1' },
  { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3' },
  { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick' },
  { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
  { id: 'mistralai/mistral-large-2', name: 'Mistral Large 2' },
  { id: 'qwen/qwen-2.5-72b-instruct', name: 'Qwen 2.5 72B' },
  { id: 'x-ai/grok-2-1212', name: 'Grok 2' },
];

export default function Header({
  currentModel,
  models,
  onModelChange,
  onGenerateSummary,
  isGenerating,
  lastUpdated,
}: HeaderProps) {
  const displayModels = models.length > 0 ? models : FALLBACK_MODELS;
  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 px-6 py-3 flex items-center justify-between"
      style={{ backgroundColor: '#111118', borderBottom: '1px solid #1e1e2e' }}
    >
      {/* Left: App title */}
      <div className="flex items-center gap-2">
        <svg
          className="w-5 h-5 text-blue-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
          <polyline points="16 7 22 7 22 13" />
        </svg>
        <h1 className="text-sm font-semibold text-blue-400 tracking-wide">
          AI Investment Agent
        </h1>
        {lastUpdated && (
          <span className="hidden sm:inline text-xs text-gray-500 ml-2">
            Updated {lastUpdated}
          </span>
        )}
      </div>

      {/* Right: Status, Generate, Model selector */}
      <div className="flex items-center gap-3">
        {/* Live status indicator */}
        <div className="hidden sm:flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-xs text-green-400">Live</span>
        </div>

        {/* Generate Summary button */}
        <button
          onClick={onGenerateSummary}
          disabled={isGenerating}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors"
        >
          {isGenerating && (
            <svg
              className="animate-spin h-3.5 w-3.5 text-white"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
          )}
          {isGenerating ? 'Generating…' : 'Generate Summary'}
        </button>

        {/* Model selector */}
        <select
          value={currentModel}
          onChange={(e) => onModelChange(e.target.value)}
          className="text-sm bg-gray-800 text-gray-200 border border-gray-700 rounded-md px-2 py-1.5 outline-none focus:border-blue-500 transition-colors cursor-pointer"
        >
          {displayModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
}

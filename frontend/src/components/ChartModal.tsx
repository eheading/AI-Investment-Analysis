'use client';

import { useEffect, useRef, useState } from 'react';
import { createChart, ColorType } from 'lightweight-charts';

interface OHLCData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartModalProps {
  symbol: string;
  name: string;
  onClose: () => void;
}

const PERIODS = [
  { value: '1mo', label: '1M' },
  { value: '3mo', label: '3M' },
  { value: '6mo', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '2y', label: '2Y' },
  { value: '5y', label: '5Y' },
];

function calcEMA(data: { close: number }[], period: number): { time: string; value: number }[] {
  const emaValues: { time: string; value: number }[] = [];
  const k = 2 / (period + 1);
  let ema = 0;

  for (let i = 0; i < data.length; i++) {
    const d = data[i] as OHLCData;
    if (i === 0) {
      ema = d.close;
    } else {
      ema = d.close * k + ema * (1 - k);
    }
    if (i >= period - 1) {
      emaValues.push({ time: d.time, value: Math.round(ema * 10000) / 10000 });
    }
  }
  return emaValues;
}

export default function ChartModal({ symbol, name, onClose }: ChartModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<OHLCData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6mo');
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';
    fetch(`${apiBase}/market/ohlc/${encodeURIComponent(symbol)}?period=${period}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((d: OHLCData[]) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [symbol, period]);

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    const container = chartContainerRef.current;
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: '#0a0a12' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#1e1e2e' },
        horzLines: { color: '#1e1e2e' },
      },
      width: container.clientWidth,
      height: 420,
      crosshair: {
        mode: 0,
      },
      timeScale: {
        borderColor: '#1e1e2e',
        timeVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1e1e2e',
      },
    });

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });
    candleSeries.setData(data);

    // EMA 20
    const ema20Data = calcEMA(data, 20);
    if (ema20Data.length > 0) {
      const ema20Series = chart.addLineSeries({
        color: '#3b82f6',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema20Series.setData(ema20Data);
    }

    // EMA 5
    const ema5Data = calcEMA(data, 5);
    if (ema5Data.length > 0) {
      const ema5Series = chart.addLineSeries({
        color: '#f59e0b',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
      });
      ema5Series.setData(ema5Data);
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      chart.applyOptions({ width: container.clientWidth });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-4xl rounded-xl border border-[#1e1e2e] bg-[#0d0d15] p-6">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{name}</h2>
            <p className="text-xs text-gray-500">{symbol}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Legend */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400 mr-4">
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-4 bg-blue-500" /> EMA 20
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-0.5 w-4 bg-amber-500" /> EMA 5
              </span>
            </div>
            {/* Period selector */}
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    period === p.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-[#1e1e2e] text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {/* Close */}
            <button
              onClick={onClose}
              className="ml-2 rounded-full p-1.5 text-gray-400 hover:bg-[#1e1e2e] hover:text-white transition-colors"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Chart */}
        {loading ? (
          <div className="flex h-[420px] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex h-[420px] items-center justify-center text-sm text-red-400">
            Failed to load chart data: {error}
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[420px] items-center justify-center text-sm text-gray-500">
            No OHLC data available for {symbol}
          </div>
        ) : (
          <div ref={chartContainerRef} />
        )}
      </div>
    </div>
  );
}

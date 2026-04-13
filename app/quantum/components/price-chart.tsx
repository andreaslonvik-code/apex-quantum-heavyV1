"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, ComposedChart, ReferenceLine } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, Activity, Zap } from "lucide-react";

// Generate realistic OHLCV data
function generateCandleData(basePrice: number, volatility: number, points: number) {
  const data = [];
  let price = basePrice;
  const now = Date.now();
  
  for (let i = points; i > 0; i--) {
    const change = (Math.random() - 0.48) * volatility;
    const open = price;
    const close = price + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const volume = Math.floor(50000 + Math.random() * 150000);
    
    data.push({
      time: new Date(now - i * 60000).toLocaleTimeString("no-NO", { hour: "2-digit", minute: "2-digit" }),
      open,
      high,
      low,
      close,
      volume,
      isUp: close >= open,
    });
    
    price = close;
  }
  return data;
}

const timeframes = [
  { key: "1m", label: "1M", points: 60 },
  { key: "5m", label: "5M", points: 48 },
  { key: "15m", label: "15M", points: 32 },
  { key: "1h", label: "1H", points: 24 },
  { key: "1d", label: "1D", points: 30 },
  { key: "1w", label: "1W", points: 52 },
];

interface PriceChartProps {
  selectedTicker?: string;
}

export function PriceChart({ selectedTicker = "MU" }: PriceChartProps) {
  const [timeframe, setTimeframe] = useState("5m");
  
  const tickerData: Record<string, { price: number; volatility: number; change: number; name: string }> = {
    MU: { price: 422.35, volatility: 8, change: 2.41, name: "Micron Technology" },
    CEG: { price: 286.50, volatility: 5, change: -0.95, name: "Constellation Energy" },
    VRT: { price: 295.11, volatility: 6, change: 2.60, name: "Vertiv Holdings" },
    RKLB: { price: 68.05, volatility: 4, change: -1.54, name: "Rocket Lab" },
    LMND: { price: 54.45, volatility: 3, change: -3.17, name: "Lemonade Inc" },
    ABSI: { price: 2.98, volatility: 0.5, change: -6.67, name: "Absci Corporation" },
  };
  
  const ticker = tickerData[selectedTicker] || tickerData.MU;
  const tf = timeframes.find(t => t.key === timeframe) || timeframes[1];
  
  const chartData = useMemo(() => 
    generateCandleData(ticker.price, ticker.volatility, tf.points),
    [ticker.price, ticker.volatility, tf.points, selectedTicker]
  );
  
  const currentPrice = chartData[chartData.length - 1]?.close || ticker.price;
  const isPositive = ticker.change >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card rounded-xl border border-[rgba(0,240,255,0.1)] p-4 h-full flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-white">{selectedTicker}</h2>
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-[#00f0ff]"
              />
            </div>
            <p className="text-xs text-zinc-500">{ticker.name}</p>
          </div>
          
          <div className="flex items-center gap-3 pl-4 border-l border-zinc-800">
            <div>
              <p className="text-2xl font-bold neon-text-cyan">
                ${currentPrice.toFixed(2)}
              </p>
              <div className={`flex items-center gap-1 text-sm ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                {isPositive ? "+" : ""}{ticker.change.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
        
        {/* Timeframe Selector */}
        <Tabs value={timeframe} onValueChange={setTimeframe}>
          <TabsList className="bg-zinc-900/50 border border-zinc-800">
            {timeframes.map(tf => (
              <TabsTrigger
                key={tf.key}
                value={tf.key}
                className="text-xs data-[state=active]:bg-[#00f0ff]/20 data-[state=active]:text-[#00f0ff]"
              >
                {tf.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Main Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="70%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#00f0ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#71717a", fontSize: 10 }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={["dataMin - 2", "dataMax + 2"]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#71717a", fontSize: 10 }}
              width={50}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "rgba(17, 17, 19, 0.95)",
                border: "1px solid rgba(0, 240, 255, 0.2)",
                borderRadius: "8px",
                padding: "12px",
              }}
              labelStyle={{ color: "#fff", fontWeight: "bold" }}
              formatter={(value: number, name: string) => [
                `$${value.toFixed(2)}`,
                name.charAt(0).toUpperCase() + name.slice(1),
              ]}
            />
            <ReferenceLine y={ticker.price} stroke="#71717a" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="close"
              stroke="#00f0ff"
              strokeWidth={2}
              fill="url(#priceGradient)"
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Volume Chart */}
        <ResponsiveContainer width="100%" height="25%">
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide />
            <Bar
              dataKey="volume"
              fill="rgba(0, 240, 255, 0.3)"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Quick Stats */}
      <div className="flex items-center justify-between pt-3 border-t border-zinc-800/50 mt-2">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-zinc-500" />
            <span className="text-zinc-500">Vol:</span>
            <span className="text-zinc-300">2.4M</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-[#00f0ff]" />
            <span className="text-zinc-500">Volatilitet:</span>
            <span className="text-[#00f0ff]">Hoy</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">Oppdatert</span>
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1.5 h-1.5 rounded-full bg-emerald-400"
          />
          <span className="text-[10px] text-emerald-400">Live</span>
        </div>
      </div>
    </motion.div>
  );
}

"use client";

import { motion } from "framer-motion";
import { Eye, TrendingUp, TrendingDown, AlertTriangle, Zap, BarChart2, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Dynamic watchlist with asymmetric scores
const watchlistData = [
  { ticker: "PLTR", name: "Palantir", price: 82.45, change: 3.21, score: 94, special: true },
  { ticker: "NVDA", name: "NVIDIA", price: 892.50, change: 1.85, score: 88, special: false },
  { ticker: "SMCI", name: "Super Micro", price: 924.30, change: -2.14, score: 85, special: false },
  { ticker: "ARM", name: "ARM Holdings", price: 148.20, change: 4.52, score: 82, special: false },
  { ticker: "AVGO", name: "Broadcom", price: 1345.80, change: 0.92, score: 79, special: false },
  { ticker: "AMD", name: "AMD", price: 178.35, change: -0.45, score: 77, special: false },
  { ticker: "MSTR", name: "MicroStrategy", price: 1567.00, change: 5.23, score: 75, special: false },
  { ticker: "COIN", name: "Coinbase", price: 234.50, change: 2.87, score: 73, special: false },
  { ticker: "SQ", name: "Block Inc", price: 78.90, change: -1.23, score: 71, special: false },
  { ticker: "SNOW", name: "Snowflake", price: 167.40, change: 1.56, score: 69, special: false },
  { ticker: "CRWD", name: "CrowdStrike", price: 312.80, change: 0.78, score: 68, special: false },
  { ticker: "DDOG", name: "Datadog", price: 128.60, change: -0.92, score: 66, special: false },
  { ticker: "NET", name: "Cloudflare", price: 94.25, change: 2.14, score: 65, special: false },
  { ticker: "SHOP", name: "Shopify", price: 78.45, change: -1.87, score: 63, special: false },
  { ticker: "TTD", name: "Trade Desk", price: 92.30, change: 1.23, score: 61, special: false },
];

// Generate mini sparkline data
function generateSparkline(isPositive: boolean) {
  const points = [];
  let value = 50;
  for (let i = 0; i < 20; i++) {
    value += (Math.random() - (isPositive ? 0.4 : 0.6)) * 10;
    value = Math.max(20, Math.min(80, value));
    points.push(value);
  }
  return points;
}

const MiniSparkline = ({ data, isPositive }: { data: number[]; isPositive: boolean }) => {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const points = data
    .map((v, i) => `${(i / (data.length - 1)) * 60},${40 - ((v - min) / range) * 30}`)
    .join(" ");

  return (
    <svg width="60" height="40" className="opacity-60">
      <polyline
        points={points}
        fill="none"
        stroke={isPositive ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const suggestedActions = [
  { ticker: "PLTR", action: "KJOP", amount: 100, reason: "Dip til $80 nar" },
  { ticker: "CEG", action: "KJOP", amount: 25, reason: "Undervektet -15%" },
  { ticker: "ABSI", action: "SELG", amount: 500, reason: "Score under 5" },
];

export function RightSidebar() {
  const handleRebalance = () => {
    toast.success("Reallokering startet!", {
      description: "APEX QUANTUM analyserer optimale posisjoner...",
    });
  };

  const handlePurge = () => {
    toast("Self-Evolution aktivert", {
      description: "Rensker suboptimale strategier fra systemet.",
      icon: <RefreshCw className="w-4 h-4 text-[#ff00aa]" />,
    });
  };

  return (
    <motion.aside
      initial={{ x: 320, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="fixed right-0 top-[70px] bottom-0 w-[320px] glass-card border-l border-[rgba(0,240,255,0.1)] flex flex-col z-40"
    >
      {/* Watchlist Header */}
      <div className="p-4 border-b border-zinc-800/50">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#00f0ff]" />
            Dynamisk Watchlist
          </h2>
          <Badge variant="outline" className="text-[10px] border-[#00f0ff]/30 text-[#00f0ff]">
            {watchlistData.length} tickers
          </Badge>
        </div>
        <p className="text-[10px] text-zinc-500">
          Elite-tickers med asymmetrisk upside score (0-100)
        </p>
      </div>

      {/* Watchlist */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {watchlistData.map((stock, index) => (
            <motion.div
              key={stock.ticker}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`cyber-table-row p-2 rounded-lg cursor-pointer ${
                stock.special ? "bg-[#ff00aa]/5 border border-[#ff00aa]/20" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white text-sm">{stock.ticker}</span>
                      {stock.special && (
                        <Badge className="text-[8px] px-1 py-0 bg-[#ff00aa]/20 text-[#ff00aa] border-[#ff00aa]/30">
                          EKSTREM
                        </Badge>
                      )}
                    </div>
                    <span className="text-[9px] text-zinc-500">{stock.name}</span>
                  </div>
                </div>
                
                <MiniSparkline 
                  data={generateSparkline(stock.change >= 0)} 
                  isPositive={stock.change >= 0}
                />
                
                <div className="flex flex-col items-end">
                  <span className="text-sm font-medium text-white">
                    ${stock.price.toFixed(2)}
                  </span>
                  <span className={`text-[10px] flex items-center gap-0.5 ${
                    stock.change >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {stock.change >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(2)}%
                  </span>
                </div>
                
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 ml-2 ${
                    stock.score >= 80
                      ? "border-[#00f0ff]/50 text-[#00f0ff] bg-[#00f0ff]/10"
                      : stock.score >= 65
                      ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                      : "border-zinc-600/50 text-zinc-400 bg-zinc-600/10"
                  }`}
                >
                  {stock.score}
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </ScrollArea>

      {/* Scoring Engine Summary */}
      <div className="p-3 border-t border-zinc-800/50">
        <div className="flex items-center gap-2 mb-2">
          <BarChart2 className="w-4 h-4 text-[#ff00aa]" />
          <h3 className="text-xs font-semibold text-white">Asymmetrisk Scoring Engine</h3>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded bg-zinc-900/50">
            <p className="text-lg font-bold text-emerald-400">7</p>
            <p className="text-[9px] text-zinc-500">KJOP</p>
          </div>
          <div className="p-2 rounded bg-zinc-900/50">
            <p className="text-lg font-bold text-zinc-400">5</p>
            <p className="text-[9px] text-zinc-500">HOLD</p>
          </div>
          <div className="p-2 rounded bg-zinc-900/50">
            <p className="text-lg font-bold text-red-400">3</p>
            <p className="text-[9px] text-zinc-500">SELG</p>
          </div>
        </div>
      </div>

      {/* Autonomous Reallocation Panel */}
      <div className="p-3 border-t border-zinc-800/50">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-[#00f0ff]" />
          <h3 className="text-xs font-semibold text-white">Autonom Reallokering</h3>
        </div>
        
        <div className="space-y-2 mb-3">
          {suggestedActions.map((action, i) => (
            <div 
              key={i}
              className={`flex items-center justify-between p-2 rounded text-xs ${
                action.action === "KJOP" 
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : "bg-red-500/10 border border-red-500/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge 
                  className={`text-[9px] ${
                    action.action === "KJOP"
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {action.action}
                </Badge>
                <span className="font-semibold text-white">{action.ticker}</span>
              </div>
              <span className="text-zinc-500">{action.amount} stk</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={handleRebalance}
            size="sm"
            className="cyber-button bg-gradient-to-r from-[#00f0ff] to-[#00a0ff] text-black font-semibold text-xs"
          >
            <Zap className="w-3 h-3 mr-1" />
            Realloker na
          </Button>
          <Button
            onClick={handlePurge}
            size="sm"
            variant="outline"
            className="border-[#ff00aa]/30 text-[#ff00aa] hover:bg-[#ff00aa]/10 text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Purge & Evolve
          </Button>
        </div>
      </div>
    </motion.aside>
  );
}

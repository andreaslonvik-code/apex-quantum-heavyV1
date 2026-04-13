"use client";

import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, AlertTriangle, DollarSign, Percent, BarChart3 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

// Realistic portfolio data matching v6.1 blueprint
const portfolioData = [
  { ticker: "MU", name: "Micron Technology", amount: 1909, value: 806420, weight: 40.2, score: 9, today: 2.41, action: "HOLD", change: 18420 },
  { ticker: "CEG", name: "Constellation Energy", amount: 291, value: 197820, weight: 19.8, score: 8, today: -0.95, action: "BUY", change: -1880 },
  { ticker: "VRT", name: "Vertiv Holdings", amount: 637, value: 188050, weight: 18.8, score: 8, today: 2.60, action: "HOLD", change: 4750 },
  { ticker: "RKLB", name: "Rocket Lab", amount: 919, value: 62570, weight: 6.3, score: 7, today: -1.54, action: "BUY", change: -980 },
  { ticker: "LMND", name: "Lemonade Inc", amount: 705, value: 38370, weight: 3.8, score: 6, today: -3.17, action: "HOLD", change: -1255 },
  { ticker: "ABSI", name: "Absci Corp", amount: 934, value: 2780, weight: 0.3, score: 5, today: -6.67, action: "SELL", change: -199 },
];

const summaryStats = {
  totalValue: 1296010,
  totalChange: 18856,
  changePercent: 1.48,
  carThisYear: 29.6,
  maxDrawdown: -12.4,
};

export function LeftSidebar() {
  return (
    <motion.aside
      initial={{ x: -280, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="fixed left-0 top-[70px] bottom-0 w-[280px] glass-card border-r border-[rgba(0,240,255,0.1)] flex flex-col z-40"
    >
      {/* Portfolio Summary Cards */}
      <div className="p-4 space-y-3 border-b border-zinc-800/50">
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Portefolje Oversikt
        </h2>

        <div className="grid grid-cols-2 gap-2">
          {/* Total Value */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3 h-3 text-[#00f0ff]" />
              <span className="text-[10px] text-zinc-500 uppercase">Total Verdi</span>
            </div>
            <p className="text-lg font-bold text-white">
              {summaryStats.totalValue.toLocaleString("no-NO")}
              <span className="text-xs text-zinc-500 ml-1">NOK</span>
            </p>
          </motion.div>

          {/* Total Change */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-zinc-500 uppercase">Endring</span>
            </div>
            <p className={`text-lg font-bold ${summaryStats.changePercent >= 0 ? "text-emerald-400" : "text-red-400"}`}>
              {summaryStats.changePercent >= 0 ? "+" : ""}{summaryStats.changePercent.toFixed(2)}%
            </p>
          </motion.div>

          {/* CAR This Year */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart3 className="w-3 h-3 text-[#ff00aa]" />
              <span className="text-[10px] text-zinc-500 uppercase">CAR 2026</span>
            </div>
            <p className="text-lg font-bold text-[#00f0ff]">
              +{summaryStats.carThisYear}%
            </p>
          </motion.div>

          {/* Max Drawdown */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/50"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] text-zinc-500 uppercase">Max DD</span>
            </div>
            <p className="text-lg font-bold text-red-400">
              {summaryStats.maxDrawdown}%
            </p>
          </motion.div>
        </div>
      </div>

      {/* Portfolio Table */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-4 py-2 border-b border-zinc-800/50">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Posisjoner
          </h2>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500 text-[10px] uppercase">
                  <th className="text-left py-2 px-1">Ticker</th>
                  <th className="text-right py-2 px-1">Verdi</th>
                  <th className="text-right py-2 px-1">%</th>
                  <th className="text-center py-2 px-1">Score</th>
                </tr>
              </thead>
              <tbody>
                {portfolioData.map((stock, index) => (
                  <motion.tr
                    key={stock.ticker}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="cyber-table-row border-b border-zinc-800/30 cursor-pointer"
                  >
                    <td className="py-2 px-1">
                      <div className="flex flex-col">
                        <span className="font-semibold text-white">{stock.ticker}</span>
                        <span className="text-[9px] text-zinc-500 truncate max-w-[80px]">
                          {stock.name}
                        </span>
                      </div>
                    </td>
                    <td className="text-right py-2 px-1">
                      <div className="flex flex-col items-end">
                        <span className="text-white font-medium">
                          {(stock.value / 1000).toFixed(0)}k
                        </span>
                        <span className={`text-[9px] flex items-center gap-0.5 ${stock.change >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {stock.change >= 0 ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
                          {stock.today >= 0 ? "+" : ""}{stock.today.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="text-right py-2 px-1">
                      <span className="text-zinc-400">{stock.weight.toFixed(0)}%</span>
                    </td>
                    <td className="text-center py-2 px-1">
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1.5 py-0 ${
                          stock.score >= 8
                            ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10"
                            : stock.score >= 6
                            ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                            : "border-red-500/50 text-red-400 bg-red-500/10"
                        }`}
                      >
                        {stock.score}
                      </Badge>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </ScrollArea>
      </div>

      {/* Action Badges */}
      <div className="p-3 border-t border-zinc-800/50">
        <div className="flex flex-wrap gap-1.5">
          {portfolioData.map((stock) => (
            <Badge
              key={stock.ticker}
              variant="outline"
              className={`text-[9px] ${
                stock.action === "BUY"
                  ? "border-[#00f0ff]/50 text-[#00f0ff] bg-[#00f0ff]/10"
                  : stock.action === "SELL"
                  ? "border-red-500/50 text-red-400 bg-red-500/10"
                  : "border-zinc-600/50 text-zinc-400 bg-zinc-600/10"
              }`}
            >
              {stock.ticker}: {stock.action}
            </Badge>
          ))}
        </div>
      </div>
    </motion.aside>
  );
}

"use client";

import { motion } from "framer-motion";
import { Shield, Brain, Clock, Zap } from "lucide-react";

export function Footer() {
  return (
    <motion.footer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="fixed bottom-0 left-[280px] right-[320px] h-10 glass-card border-t border-[rgba(0,240,255,0.1)] flex items-center justify-center gap-6 text-[10px] text-zinc-500 z-30"
    >
      <div className="flex items-center gap-1.5">
        <Shield className="w-3 h-3 text-emerald-400" />
        <span>ZERO-ERROR PROTOCOL v2.3</span>
      </div>
      <div className="w-px h-4 bg-zinc-800" />
      <div className="flex items-center gap-1.5">
        <Brain className="w-3 h-3 text-[#ff00aa]" />
        <span>Self-thinking & selvlærende</span>
      </div>
      <div className="w-px h-4 bg-zinc-800" />
      <div className="flex items-center gap-1.5">
        <Clock className="w-3 h-3 text-[#00f0ff]" />
        <span>24/7 autonom drift</span>
      </div>
      <div className="w-px h-4 bg-zinc-800" />
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-amber-400" />
        <span>Latency: 0.3ms</span>
      </div>
    </motion.footer>
  );
}

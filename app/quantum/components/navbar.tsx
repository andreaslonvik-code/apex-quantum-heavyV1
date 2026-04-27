"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Atom, Clock, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

export function Navbar() {
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = {
        timeZone: "Europe/Oslo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      };
      const formatted = now.toLocaleString("no-NO", options).replace(",", "");
      setCurrentTime(`${formatted} CEST`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleConnect = () => {
    setShowConnectModal(false);
    window.location.href = "/connect-alpaca";
  };

  return (
    <>
      <motion.nav
        initial={{ y: -70, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 h-[70px] z-50 glass-card border-b border-[rgba(0,240,255,0.1)]"
      >
        <div className="h-full px-6 flex items-center justify-between">
          {/* Left - Logo */}
          <div className="flex items-center gap-3">
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 20px rgba(0, 240, 255, 0.3)",
                  "0 0 40px rgba(0, 240, 255, 0.6)",
                  "0 0 20px rgba(0, 240, 255, 0.3)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00f0ff] to-[#ff00aa] flex items-center justify-center"
            >
              <Atom className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                <span className="neon-text-cyan">APEX</span>{" "}
                <span className="text-white">QUANTUM</span>
              </h1>
              <p className="text-[10px] text-zinc-500 tracking-widest uppercase">
                v8 · Alpaca · 24/7
              </p>
            </div>
          </div>

          {/* Center - Atomic Clock */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="hidden md:flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900/50 border border-zinc-800"
          >
            <Clock className="w-4 h-4 text-[#00f0ff]" />
            <span className="font-mono text-sm text-zinc-300 tracking-wider">
              {currentTime || "Loading..."}
            </span>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-[#00f0ff]"
            />
          </motion.div>

          {/* Right - Tagline + Connect */}
          <div className="flex items-center gap-4">
            <p className="hidden lg:block text-sm text-zinc-400 italic">
              Framover og oppover, alltid! 🚀
            </p>

            <div className="flex items-center gap-3">
              {isConnected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs text-emerald-400">Tilkoblet</span>
                </motion.div>
              )}

              <Button
                onClick={() => setShowConnectModal(true)}
                className="cyber-button bg-gradient-to-r from-[#00f0ff] to-[#00a0ff] hover:from-[#00d0ff] hover:to-[#0080ff] text-black font-semibold px-5 py-2 rounded-full neon-cyan-glow"
              >
                <Zap className="w-4 h-4 mr-2" />
                {isConnected ? "Alpaca Tilkoblet" : "Koble Alpaca-konto"}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="rounded-full border border-zinc-800 hover:border-[#00f0ff]/50 hover:bg-[#00f0ff]/5"
              >
                <User className="w-5 h-5 text-zinc-400" />
              </Button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Connect Modal */}
      <Dialog open={showConnectModal} onOpenChange={setShowConnectModal}>
        <DialogContent className="glass-card border-[#00f0ff]/20 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl neon-text-cyan">
              Koble til Alpaca
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              Lim inn dine Alpaca API-nøkler for å la APEX QUANTUM handle på dine vegne.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="p-4 rounded-lg bg-zinc-900/50 border border-zinc-800">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">A</span>
                </div>
                <div>
                  <h3 className="font-semibold">Alpaca API Keys</h3>
                  <p className="text-xs text-zinc-500">Krypteres med AES-256-GCM</p>
                </div>
              </div>
              <ul className="text-sm text-zinc-400 space-y-1">
                <li>• Velg Paper eller Live Trading</li>
                <li>• Lim inn API Key ID + Secret</li>
                <li>• Vi validerer mot Alpaca og lagrer kryptert</li>
              </ul>
            </div>

            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full cyber-button bg-gradient-to-r from-[#00f0ff] to-[#ff00aa] hover:opacity-90 text-white font-semibold py-3 rounded-lg"
            >
              Gå til tilkoblingssiden
            </Button>

            <p className="text-xs text-center text-zinc-500">
              Ved å koble til godtar du våre vilkår for autonom handel.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

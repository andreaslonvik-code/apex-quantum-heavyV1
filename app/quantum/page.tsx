"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Navbar } from "./components/navbar";
import { LeftSidebar } from "./components/left-sidebar";
import { RightSidebar } from "./components/right-sidebar";
import { PriceChart } from "./components/price-chart";
import { AIChat } from "./components/ai-chat";
import { Footer } from "./components/footer";
import { useToast, ToastContainer } from '@/app/components/toast';

// Quantum particles background
function QuantumParticles() {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 5,
    }));
    setParticles(newParticles);
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="quantum-particle"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
          }}
          animate={{
            y: [0, -20, 0],
            x: [0, 10, -10, 0],
            opacity: [0.2, 0.6, 0.2],
          }}
          transition={{
            duration: 8 + Math.random() * 4,
            repeat: Infinity,
            delay: particle.delay,
            ease: "easeInOut",
          }}
        />
      ))}
      
      {/* Gradient overlays */}
      <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-[#00f0ff]/5 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-[#ff00aa]/5 to-transparent" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-[#00f0ff]/3 to-transparent blur-3xl" />
    </div>
  );
}

export default function QuantumDashboard() {
  const { toasts, remove: removeToast } = useToast();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <QuantumParticles />
      
      {/* Navbar */}
      <Navbar />
      
      {/* Left Sidebar */}
      <LeftSidebar />
      
      {/* Right Sidebar */}
      <RightSidebar />
      
      {/* Main Content */}
      <main className="fixed top-[70px] bottom-10 left-[280px] right-[320px] p-4 overflow-hidden z-10">
        <div className="h-full flex flex-col gap-4">
          {/* Price Chart - Top Half */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="flex-1 min-h-0"
          >
            <PriceChart selectedTicker="MU" />
          </motion.div>
          
          {/* AI Chat - Bottom Half */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="flex-1 min-h-0"
          >
            <AIChat />
          </motion.div>
        </div>
      </main>
      
      {/* Footer */}
      <Footer />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

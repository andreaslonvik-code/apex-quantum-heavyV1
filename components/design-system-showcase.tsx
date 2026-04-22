'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/**
 * Apex Quantum Design System Showcase Component
 * Demonstrates the core design elements and components
 */
export function DesignSystemShowcase() {
  return (
    <div className="space-y-8 p-6 max-w-4xl mx-auto">
      <div className="text-center space-y-4">
        <h1 className="neon-text-cyan text-4xl font-bold">
          APEX QUANTUM DESIGN SYSTEM
        </h1>
        <p className="text-zinc-400 text-lg">
          Cyber-quantum aesthetic for autonomous trading
        </p>
      </div>

      {/* Color Palette */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Color Palette</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-2">
            <div className="w-full h-16 bg-[#00f0ff] rounded-lg border border-[#00f0ff]/30"></div>
            <p className="text-sm text-center text-zinc-400">Neon Cyan</p>
            <p className="text-xs text-center text-zinc-500">#00f0ff</p>
          </div>
          <div className="space-y-2">
            <div className="w-full h-16 bg-[#ff00aa] rounded-lg border border-[#ff00aa]/30"></div>
            <p className="text-sm text-center text-zinc-400">Neon Magenta</p>
            <p className="text-xs text-center text-zinc-500">#ff00aa</p>
          </div>
          <div className="space-y-2">
            <div className="w-full h-16 bg-[#10b981] rounded-lg border border-[#10b981]/30"></div>
            <p className="text-sm text-center text-zinc-400">Success Green</p>
            <p className="text-xs text-center text-zinc-500">#10b981</p>
          </div>
          <div className="space-y-2">
            <div className="w-full h-16 bg-[#ef4444] rounded-lg border border-[#ef4444]/30"></div>
            <p className="text-sm text-center text-zinc-400">Error Red</p>
            <p className="text-xs text-center text-zinc-500">#ef4444</p>
          </div>
        </div>
      </section>

      {/* Typography */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Typography</h2>
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold text-white">Heading 1 - Space Grotesk</h1>
            <p className="text-zinc-500">3xl / Bold / Primary headings</p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-white">Heading 2 - Space Grotesk</h2>
            <p className="text-zinc-500">2xl / Semibold / Section headings</p>
          </div>
          <div>
            <p className="text-base text-zinc-300">Body text - Regular weight, optimized for readability in dark theme</p>
            <p className="text-zinc-500">base / Regular / Body content</p>
          </div>
          <div>
            <code className="text-sm text-[#00f0ff] bg-zinc-900 px-2 py-1 rounded">
              const code = 'monospace font';
            </code>
            <p className="text-zinc-500">sm / Geist Mono / Code snippets</p>
          </div>
        </div>
      </section>

      {/* Components */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Components</h2>

        {/* Buttons */}
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-white">Buttons</h3>
          <div className="flex flex-wrap gap-4">
            <Button className="cyber-button bg-gradient-to-r from-[#00f0ff] to-[#00a0ff] text-black font-semibold">
              Primary Action
            </Button>
            <Button variant="outline" className="border-[#ff00aa]/30 text-[#ff00aa] hover:bg-[#ff00aa]/10">
              Secondary Action
            </Button>
            <Button variant="ghost" className="text-zinc-400 hover:text-white">
              Ghost Button
            </Button>
          </div>
        </div>

        {/* Badges */}
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-white">Badges</h3>
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-400">Active</Badge>
            <Badge className="bg-red-500/20 text-red-400">Error</Badge>
            <Badge className="bg-blue-500/20 text-blue-400">Info</Badge>
            <Badge className="bg-amber-500/20 text-amber-400">Warning</Badge>
          </div>
        </div>

        {/* Cards */}
        <div className="space-y-2">
          <h3 className="text-lg font-medium text-white">Cards</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card rounded-xl border border-[rgba(0,240,255,0.1)] p-4"
            >
              <h4 className="text-white font-semibold mb-2">Glassmorphic Card</h4>
              <p className="text-zinc-400 text-sm">Semi-transparent with blur effect</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#00f0ff] animate-pulse"></div>
                <span className="text-xs text-[#00f0ff]">Live Data</span>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4"
            >
              <h4 className="text-white font-semibold mb-2">Standard Card</h4>
              <p className="text-zinc-400 text-sm">Solid background for data tables</p>
              <div className="mt-3">
                <Badge className="bg-[#ff00aa]/20 text-[#ff00aa]">AI Powered</Badge>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Animations */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Animations</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl border border-[rgba(0,240,255,0.1)] p-4 text-center">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-12 h-12 bg-[#00f0ff] rounded-full mx-auto mb-2"
            />
            <p className="text-zinc-400 text-sm">Pulse Animation</p>
          </div>

          <div className="glass-card rounded-xl border border-[rgba(255,0,170,0.1)] p-4 text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-2 border-[#ff00aa] border-t-transparent rounded-full mx-auto mb-2"
            />
            <p className="text-zinc-400 text-sm">Spin Animation</p>
          </div>

          <div className="glass-card rounded-xl border border-[rgba(16,185,129,0.1)] p-4 text-center">
            <motion.div
              animate={{
                boxShadow: [
                  "0 0 10px rgba(16, 185, 129, 0.3)",
                  "0 0 20px rgba(16, 185, 129, 0.5)",
                  "0 0 10px rgba(16, 185, 129, 0.3)",
                ],
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-12 h-12 bg-emerald-500 rounded-full mx-auto mb-2"
            />
            <p className="text-zinc-400 text-sm">Glow Animation</p>
          </div>
        </div>
      </section>

      {/* Implementation Status */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-white">Implementation Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card rounded-xl border border-emerald-500/20 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
              <h3 className="text-white font-semibold">Completed</h3>
            </div>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• CSS custom properties & design tokens</li>
              <li>• Component library with consistent styling</li>
              <li>• Animation system & micro-interactions</li>
              <li>• Responsive design & mobile optimization</li>
              <li>• Dark theme with glassmorphic effects</li>
            </ul>
          </div>

          <div className="glass-card rounded-xl border border-amber-500/20 p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-amber-500"></div>
              <h3 className="text-white font-semibold">In Progress</h3>
            </div>
            <ul className="text-sm text-zinc-400 space-y-1">
              <li>• Design system documentation</li>
              <li>• Component usage guidelines</li>
              <li>• Accessibility improvements</li>
              <li>• Storybook integration</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
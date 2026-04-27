'use client';

import { useState } from 'react';
import { AlertCircle, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * APEX QUANTUM v8 — Legal Disclaimers & Risk Warning (Alpaca)
 */
export function LegalDisclaimers() {
  const [accepted, setAccepted] = useState(false);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={cn(
      'fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4',
      accepted && 'hidden'
    )}>
      <div className="bg-[#111113] border border-[#27272a] rounded-lg max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            <AlertCircle className="w-8 h-8 text-red-500 flex-shrink-0 mt-1" />
            <div>
              <h1 className="text-2xl font-bold text-white">Risk Disclaimer</h1>
              <p className="text-sm text-zinc-400 mt-1">
                APEX QUANTUM v8 | Please read carefully before using
              </p>
            </div>
          </div>

          {/* Main Disclaimer */}
          <div className="space-y-4 text-sm">
            <section className="space-y-2">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <span className="w-1 h-1 bg-cyan-400 rounded-full" />
                Trading Risk Warning
              </h2>
              <p className="text-zinc-300 leading-relaxed">
                APEX QUANTUM is an autonomous AI trading engine designed for experienced traders. 
                <strong className="text-red-400"> Trading futures, stocks, and derivatives is inherently risky 
                and can result in total loss of capital.</strong> Past performance is not indicative of future results. 
                The system operates 24/7 and may execute trades without manual oversight. You are responsible 
                for all trades executed in your accounts.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <span className="w-1 h-1 bg-magenta-400 rounded-full" />
                No Financial Advice
              </h2>
              <p className="text-zinc-300 leading-relaxed">
                This service does <strong>not</strong> constitute financial advice, investment recommendation, 
                or solicitation to buy/sell securities. All trading decisions are yours alone. Consult with a 
                qualified financial advisor before using APEX QUANTUM for real trading.
              </p>
            </section>

            {expanded && (
              <>
                <section className="space-y-2">
                  <h2 className="font-semibold text-white flex items-center gap-2">
                    <span className="w-1 h-1 bg-green-400 rounded-full" />
                    System Risks
                  </h2>
                  <ul className="text-zinc-300 space-y-1 ml-4 list-disc">
                    <li>Technology failures or connectivity issues may prevent order execution</li>
                    <li>API failures from brokers (Alpaca) could delay or cancel orders</li>
                    <li>Market gaps can cause stop-loss orders to execute at worse prices</li>
                    <li>AI algorithms may malfunction or generate incorrect signals</li>
                    <li>Regulatory changes may limit trading capabilities</li>
                    <li>Account liquidation risk due to margin requirements</li>
                  </ul>
                </section>

                <section className="space-y-2">
                  <h2 className="font-semibold text-white flex items-center gap-2">
                    <span className="w-1 h-1 bg-yellow-400 rounded-full" />
                    Day-Trading Risks
                  </h2>
                  <p className="text-zinc-300 leading-relaxed">
                    APEX QUANTUM employs aggressive day-trading strategies targeting 10-12% daily returns. 
                    This style of trading is <strong className="text-yellow-400">extremely high-risk</strong> and 
                    requires rapid execution and constant monitoring. The account can experience significant 
                    drawdowns. Pattern day trader rules may apply to your account.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="font-semibold text-white flex items-center gap-2">
                    <span className="w-1 h-1 bg-blue-400 rounded-full" />
                    Regulatory Compliance
                  </h2>
                  <p className="text-zinc-300 leading-relaxed">
                    APEX QUANTUM complies with relevant securities laws where available. However, laws 
                    regarding algorithmic trading vary by jurisdiction. You are responsible for ensuring 
                    your use complies with local regulations. We're not registered as a financial advisor.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="font-semibold text-white flex items-center gap-2">
                    <span className="w-1 h-1 bg-purple-400 rounded-full" />
                    Data & Privacy
                  </h2>
                  <p className="text-zinc-300 leading-relaxed">
                    Your trading data is processed to improve AI algorithms. We use industry-standard 
                    encryption and security measures. Your API keys are never stored in clear text. 
                    You can delete your account and all associated data at any time.
                  </p>
                </section>

                <section className="space-y-2">
                  <h2 className="font-semibold text-white flex items-center gap-2">
                    <span className="w-1 h-1 bg-red-400 rounded-full" />
                    Liability Limitation
                  </h2>
                  <p className="text-zinc-300 leading-relaxed">
                    APEX QUANTUM is provided "as is" without warranties. We are not liable for trading 
                    losses, system failures, or damage caused by using this service. Your use is at your 
                    own risk and expense.
                  </p>
                </section>
              </>
            )}

            {/* Expand Button */}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-cyan-400 hover:text-cyan-300 text-sm font-semibold flex items-center gap-2 mt-4"
            >
              <MessageSquare className="w-4 h-4" />
              {expanded ? 'Show Less' : 'Show Full Disclaimer'}
            </button>
          </div>

          {/* Acceptance */}
          <div className="border-t border-[#27272a] pt-6 space-y-4">
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="w-5 h-5 rounded border border-[#27272a] bg-[#0a0a0a] checked:bg-cyan-500 cursor-pointer mt-1"
              />
              <span className="text-sm text-zinc-300 group-hover:text-zinc-200">
                I acknowledge that I have read and understood all risks associated with APEX QUANTUM. 
                I take full responsibility for my trading decisions and accept all potential losses.
              </span>
            </label>

            <button
              disabled={!accepted}
              onClick={() => setAccepted(false)}
              className={cn(
                'w-full py-3 rounded-lg font-semibold transition-all duration-200',
                accepted
                  ? 'bg-cyan-500 hover:bg-cyan-600 text-white'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              )}
            >
              {accepted ? 'I Accept & Continue' : 'Accept to Continue'}
            </button>

            <p className="text-xs text-zinc-500 text-center">
              By clicking accept, you agree to these terms. Do not use APEX QUANTUM if you do not accept these risks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Floating Risk Alert Badge
 */
export function RiskAlertBadge() {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-red-500/10 border border-red-500/30">
      <AlertCircle className="w-4 h-4 text-red-500" />
      <span className="text-xs font-semibold text-red-400">HIGH RISK</span>
    </div>
  );
}

/**
 * Trading Loss Threshold Warning
 */
export function DailyLossWarning({ 
  currentLoss, 
  dailyThreshold 
}: { 
  currentLoss: number;
  dailyThreshold: number;
}) {
  const percentUsed = (currentLoss / dailyThreshold) * 100;
  const isWarning = percentUsed > 75;
  const isDanger = percentUsed > 90;

  return (
    <div className={cn(
      'p-3 rounded-lg border',
      isDanger 
        ? 'bg-red-500/10 border-red-500/50' 
        : isWarning 
        ? 'bg-yellow-500/10 border-yellow-500/50'
        : 'bg-blue-500/10 border-blue-500/50'
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className={cn(
          'text-sm font-semibold',
          isDanger ? 'text-red-400' : isWarning ? 'text-yellow-400' : 'text-blue-400'
        )}>
          Daily Loss Threshold
        </span>
        <span className="text-xs text-zinc-400">
          ${currentLoss.toFixed(2)} / ${dailyThreshold.toFixed(2)}
        </span>
      </div>
      <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full transition-all',
            isDanger ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-blue-500'
          )}
          style={{ width: `${Math.min(percentUsed, 100)}%` }}
        />
      </div>
    </div>
  );
}

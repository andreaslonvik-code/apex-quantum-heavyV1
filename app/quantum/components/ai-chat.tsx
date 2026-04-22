"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Zap, RefreshCw, Target, Brain, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from '@/app/components/toast';

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const grokResponses = [
  {
    trigger: "scan",
    response: `**QUANTUM SCAN KOMPLETT** 🔍

Analyserte 847 instrumenter pa 0.3 sekunder.

**ASYMMETRISK ALPHA DETEKTERT:**
- **MU** (Score: 9.2/10) - Memory-boom fortsetter. AI-infrastruktur driver ettersporselen. Entry: $420, Target: $580 (+38%)
- **PLTR** (Score: 8.7/10) - EKSTREM OVERVAKNING AKTIVERT. Regjeringskontrakter + AI-pivot = eksplosiv vekst. Venter pa dip til $78.
- **CEG** (Score: 8.4/10) - Nuklear renessanse er REAL. Datacenter-demand = uendelig.

**RISIKOFAKTORER:**
- VIX opp 12% siste 24t - volatilitet oker
- Fed-meeting om 3 dager - posisjonering pagaende

*Anbefaling: Hold MU-eksponering, akkumuler CEG pa svakhet.*`
  },
  {
    trigger: "pltr",
    response: `**PALANTIR DEEP ANALYSIS** 🎯

PLTR er den mest polariserende aksjen i portefoljen. Her er sannheten:

**BULLCASE (70% sannsynlighet):**
- AIP (Artificial Intelligence Platform) er en game-changer
- Regjeringskontrakter gir recurring revenue
- Commercial-vekst akselererer: +55% YoY
- CEO Karp kjopper aksjer selv

**BEARCASE (30% sannsynlighet):**
- Valuering er strukket (P/S: 22x)
- Insider-salg historisk hoyt
- Konkurranse fra Microsoft, Google

**APEX QUANTUM VERDICT:**
Entry-sone: $76-80
Target 12M: $145 (+85%)
Stop-loss: $68 (-13%)

*Asymmetrisk oppsiden rettferdiggjor risikoen. Akkumuler pa svakhet.*`
  },
  {
    trigger: "rebalance",
    response: `**AUTONOM REALLOKERING INITIALISERT** ⚡

Basert pa dagens momentum og asymmetrisk scoring:

**KJOP:**
- +50 CEG @ $286.50 = $14,325 (undervektet, nuklear-momentum)
- +200 RKLB @ $68.05 = $13,610 (space-kontrakter kommer)

**SELG:**
- -100 ABSI @ $2.98 = $298 (score under 5, kapitalbevaring)

**VENT:**
- MU, VRT, LMND - hold eksisterende posisjoner

**ESTIMERT EFFEKT:**
- Forventet alpha: +3.2% neste maned
- Drawdown-risiko: -5.8% (akseptabelt)

*Klar for utforelse. Si "utfor" for a plassere ordrene.*`
  },
  {
    trigger: "utfor",
    response: `**ORDRE SENDT TIL SAXO** ✅

Folgende handler er plassert:

| Ticker | Aksjon | Antall | Pris | Status |
|--------|--------|--------|------|--------|
| CEG | KJOP | 50 | $286.50 | FYLT |
| RKLB | KJOP | 200 | $68.05 | FYLT |
| ABSI | SELG | 100 | $2.98 | FYLT |

**Total transaksjonskostnad:** $47.50
**Ny portefoljeverdi:** $1,310,235 NOK

*Reallokering komplett. Portefoljen er na optimalisert for maksimal asymmetrisk avkastning.*`
  },
];

const quickActions = [
  { label: "Scan market", icon: Target },
  { label: "Rebalance", icon: RefreshCw },
  { label: "PLTR entry?", icon: Zap },
];

const initialMessages: Message[] = [
  {
    id: "1",
    role: "assistant",
    content: `**APEX QUANTUM AI TRADER v6.1** 🧠

Jeg er din autonome handelspartner. Jeg soker sannhet i markedene - ikke hopium.

**STATUS:**
- Portefolje: $1,296,010 NOK (+1.48% i dag)
- Aktive posisjoner: 6
- Risikoniwa: MODERAT-HOY

**DAGENS OBSERVASJONER:**
1. MU raller pa AI-hype - HOLD, ikke jag
2. PLTR konsoliderer - akkumulasjons-sone nar
3. VRT breakout bekreftet - momentum intakt

*Spor meg om noe. Jeg gir deg brutalt aerlige svar.*`,
    timestamp: new Date(),
  },
  {
    id: "2",
    role: "assistant", 
    content: `**SELV-EVOLUSJON LOGG #847**

Jeg har analysert mine siste 100 anbefalinger:
- Treffrate: 73%
- Gjennomsnittlig avkastning: +8.2%
- Storste feil: For sen exit pa NVDA (-12%)

**LARING:** Jeg ma vare mer aggressiv pa profitt-taking over 15% gevinst.

*Algoritmen er oppdatert. Fremtidige signaler vil reflektere dette.*`,
    timestamp: new Date(Date.now() - 300000),
  },
];

export function AIChat() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { add: addToast } = useToast();

  // Self-learning: Load and save interactions
  const [interactionHistory, setInteractionHistory] = useState<Array<{input: string, response: string, timestamp: Date}>>([]);

  useEffect(() => {
    // Load interaction history from localStorage
    const saved = localStorage.getItem('apex-quantum-interactions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved).map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
        setInteractionHistory(parsed);
      } catch (e) {
        console.error('Failed to load interaction history:', e);
      }
    }
  }, []);

  const saveInteraction = (input: string, response: string) => {
    const newInteraction = { input, response, timestamp: new Date() };
    const updated = [...interactionHistory, newInteraction].slice(-50); // Keep last 50
    setInteractionHistory(updated);
    localStorage.setItem('apex-quantum-interactions', JSON.stringify(updated));
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    addToast("Melding sendt til APEX QUANTUM AI", "info", 2000);

    // Self-learning: Check for similar previous interactions
    const similarInteractions = interactionHistory.filter(item =>
      item.input.toLowerCase().includes(input.toLowerCase().split(' ')[0]) ||
      input.toLowerCase().includes(item.input.toLowerCase().split(' ')[0])
    );

    // Simulate AI response
    await new Promise(resolve => setTimeout(resolve, 1500));

    let responseContent = grokResponses.find(r => 
      input.toLowerCase().includes(r.trigger)
    )?.response;

    if (!responseContent) {
      // Use self-learning to generate better response
      if (similarInteractions.length > 0) {
        const lastSimilar = similarInteractions[similarInteractions.length - 1];
        responseContent = `**LÆRT FRA TIDLIGERE INTERAKSJONER**

Basert pa tidligere samtaler om lignende emner:

${lastSimilar.response.split('\n').slice(0, 3).join('\n')}

**OPPdatERT ANALYSE:**
Interessant sporrsmal. La meg analysere dette med hensyn til dine tidligere interesser...

*Jeg har na lært fra ${interactionHistory.length} tidligere interaksjoner for a gi bedre svar.*`;
      } else {
        responseContent = `**ANALYSERER: "${input}"**

Interessant sporrsmal. La meg grave dypere i dataene...

Basert pa min analyse av 10,000+ datapunkter, ser jeg ingen umiddelbar edge her. Markedet er effisient pa dette omradet.

*Forslag: Fokuser pa de 6 kjerneposisjonene i blueprint. De har hoeyest asymmetrisk potensial.*`;
      }
    }

    const aiMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: responseContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, aiMessage]);
    setIsTyping(false);

    // Save interaction for self-learning
    saveInteraction(input, responseContent);

    addToast("APEX QUANTUM AI har svart", "success", 2000);
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
    setTimeout(() => handleSend(), 100);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="glass-card rounded-xl border border-[rgba(0,240,255,0.1)] flex flex-col h-full"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{
              boxShadow: [
                "0 0 10px rgba(255, 0, 170, 0.3)",
                "0 0 20px rgba(255, 0, 170, 0.5)",
                "0 0 10px rgba(255, 0, 170, 0.3)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff00aa] to-[#00f0ff] flex items-center justify-center"
          >
            <Brain className="w-5 h-5 text-white" />
          </motion.div>
          <div>
            <h2 className="font-bold text-white flex items-center gap-2">
              APEX QUANTUM AI Trader
              <Sparkles className="w-4 h-4 text-[#ff00aa]" />
            </h2>
            <p className="text-[10px] text-zinc-500">Grok-drevet • Selvlærende • Brutalt ærlig</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-emerald-400">AKTIV</span>
          </motion.div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    message.role === "user"
                      ? "bg-[#00f0ff]/20 border border-[#00f0ff]/30"
                      : "bg-zinc-900/50 border border-zinc-800/50"
                  }`}
                >
                  <div 
                    className="text-sm text-zinc-300 prose-custom whitespace-pre-wrap"
                    dangerouslySetInnerHTML={{ 
                      __html: message.content
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
                        .replace(/\n/g, '<br/>')
                    }}
                  />
                  <p className="text-[9px] text-zinc-600 mt-2">
                    {message.timestamp.toLocaleTimeString("no-NO")}
                  </p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-zinc-500 text-sm"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-[#ff00aa]"
              />
              APEX QUANTUM tenker...
            </motion.div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2">
          {quickActions.map((action) => (
            <Button
              key={action.label}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.label)}
              className="text-xs border-zinc-800 hover:border-[#00f0ff]/50 hover:bg-[#00f0ff]/5 hover:text-[#00f0ff]"
            >
              <action.icon className="w-3 h-3 mr-1.5" />
              {action.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Spor APEX QUANTUM..."
            className="flex-1 bg-zinc-900/50 border-zinc-800 focus:border-[#00f0ff]/50 focus:ring-[#00f0ff]/20 text-white placeholder:text-zinc-600"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isTyping}
            className="cyber-button bg-gradient-to-r from-[#ff00aa] to-[#00f0ff] hover:opacity-90 text-white"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

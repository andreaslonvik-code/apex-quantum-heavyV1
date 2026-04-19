# APEX QUANTUM v6.1 - Production-Grade AI Trading Engine

<div align="center">

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Grok-4](https://img.shields.io/badge/Grok-4--Heavy-FF6B6B?style=for-the-badge)](https://grok.ai)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**The future of autonomous trading, powered by Grok-4-Heavy AI**

[Documentation](#features) • [Quick Start](#installation) • [API Reference](#api-reference) • [Deployment](#deployment)

</div>

---

## 🚀 Features

### 🤖 Advanced AI Engine
- **Grok-4-Heavy** LLM for intelligent trading signals
- Self-learning algorithms with parameter optimization
- Real-time market sentiment analysis
- Pattern recognition across multi-exchange data

### 📊 Real-Time Streaming
- **WebSocket** for live price updates
- **Server-Sent Events** for optimal bandwidth
- 100ms market refresh interval
- Multi-exchange support (US, Oslo, Germany, HK)

### 🛡️ Enterprise Security
- **Rate limiting** (60 req/min, 1000/hour)
- **Security headers** (CSP, HSTS, X-Frame-Options)
- **API key encryption** and secure storage
- Sentry integration for error tracking

### 📱 Modern Responsive UI
- **Mobile-first design** (320px → 4K)
- **Dark mode** with cyber-quantum aesthetic
- **Glassmorphic components** with neon effects
- Real-time dashboard with live data

### 💼 Institutional Trading
- Automated trade execution with risk management
- Day-trading strategies (dip buying, scalping, momentum)
- Multi-exchange arbitrage
- Portfolio optimization using AI
- Detailed audit logs

### 🧠 Self-Learning System
- Continuous strategy analysis and optimization
- Sharpe ratio and drawdown tracking
- Win rate and profit factor calculations
- Adaptive parameter tuning

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+ (20+ recommended)
- npm or yarn
- Grok-4-Heavy API key from xAI
- Saxo Bank API credentials (optional)

### Installation

```bash
# Clone repository
git clone https://github.com/andreaslonvik-code/apex-quantum-heavyV1.git
cd apex-quantum-heavyV1

# Install dependencies
npm install

# Configure environment
cp .env.local .env.local
# Edit with your API keys

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

---

## 🌐 API Reference

### Trading Signals
```bash
POST /api/apex/grok-analysis
{
  "symbol": "MU",
  "currentPrice": 110.50,
  "priceHistory": [109, 110, 110.50],
  "volume": 5000000,
  "rsi": 55,
  "macd": { "value": 0.5, "signal": 0.3, "histogram": 0.2 }
}
```

### Stream Analysis
```bash
GET /api/apex/grok-analysis?action=stream&symbol=MU
# Returns Server-Sent Events stream
```

### Portfolio Optimization
```bash
POST /api/apex/grok-analysis?action=optimize
{
  "positions": [{ "symbol": "MU", "amount": 100, "price": 110.50 }],
  "marketConditions": { "volatility": "high" }
}
```

### Performance Metrics
```bash
GET /api/apex/grok-analysis?action=metrics
```

---

## 🔧 Configuration

Edit `.env.local`:

```env
# AI & Trading
XAI_API_KEY=sk_...
GROK_MODEL=grok-4-heavy
TRADING_CAPITAL=1000000
TRADING_MODE=sandbox

# Saxo Bank (optional)
SAXO_API_KEY=...
SAXO_ACCOUNT_ID=...

# Security
RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_REQUESTS_PER_HOUR=1000

# Logging
LOG_LEVEL=info
SENTRY_DSN=https://...
```

Full config options: [PRODUCTION_GUIDE.md](./PRODUCTION_GUIDE.md#configuration-guide)

---

## 🚀 Deployment

### Vercel (Recommended)
```bash
npm install -g vercel
vercel --prod
```

### Docker
```bash
npm run docker:build
npm run docker:run
```

### Self-Hosted
See [PRODUCTION_GUIDE.md](./PRODUCTION_GUIDE.md#option-3-self-hosted-vps)

Complete guide: [PRODUCTION_GUIDE.md](./PRODUCTION_GUIDE.md)

---

## 📊 Project Structure

```
apex-quantum-heavyV1/
├── app/api/apex/              # Trading API endpoints
├── components/                # React components
├── lib/                       # Core libraries
│   ├── grok.ts               # Grok-4-Heavy integration
│   ├── streaming.ts          # WebSocket/SSE
│   ├── error-handler.ts      # Error management
│   ├── logger.ts             # Structured logging
│   ├── middleware.ts         # Request middleware
│   ├── rate-limiter.ts       # Rate limiting
│   └── store.ts              # Zustand state
├── public/                    # Static assets
├── .env.local                 # Environment variables
└── PRODUCTION_GUIDE.md        # Deployment guide
```

---

## 🔐 Security

✅ Environment variables for secrets  
✅ Rate limiting on all endpoints  
✅ Input validation & sanitization  
✅ Security headers enforced  
✅ API key encryption  
✅ Error tracking & monitoring  
✅ Audit logging  
✅ Regular dependency updates  

---

## ⚠️ Legal Disclaimer

This system is for experienced traders only. Trading carries risk of total loss.

- ❌ NOT financial advice
- ❌ Use only capital you can lose
- ✅ Read full disclaimers in the app
- ✅ Consult a financial advisor

See [legal-disclaimers.tsx](./components/legal-disclaimers.tsx)

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/andreaslonvik-code/apex-quantum-heavyV1/issues)
- **Email**: support@apexquantum.no
- **Docs**: [PRODUCTION_GUIDE.md](./PRODUCTION_GUIDE.md)

---

## 📄 License

MIT - See [LICENSE](LICENSE)

---

<div align="center">

**APEX QUANTUM v6.1** © 2026 | Powered by Grok-4-Heavy

</div>

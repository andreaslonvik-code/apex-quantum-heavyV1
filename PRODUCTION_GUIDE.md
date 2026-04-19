# APEX QUANTUM v6.1 - Production Deployment Guide

## Overview

**APEX QUANTUM v6.1** is a production-grade autonomous AI trading engine powered by **Grok-4-Heavy** backend. It provides:

- 🤖 **Advanced AI Analysis** - Grok-4-Heavy for intelligent trading signals
- 📊 **Real-Time Streaming** - WebSocket and SSE for live market data
- 🛡️ **Enterprise Security** - Rate limiting, error handling, and monitoring
- 📱 **Fully Responsive UI** - Mobile-optimized dark-mode interface
- 🧠 **Self-Learning** - Continuous strategy optimization
- 💼 **Multi-Exchange Support** - US, Oslo, Germany, Hong Kong
- ⚡ **High-Performance** - Optimized for sub-second trade execution

---

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    APEX QUANTUM v6.1                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐      ┌──────────────┐               │
│  │   Frontend   │      │   Dashboard  │               │
│  │  (Next.js)   │      │   (React 19) │               │
│  └──────┬───────┘      └──────┬───────┘               │
│         │                      │                       │
│  ┌──────────────────────────────────────────┐         │
│  │         Middleware Layer                 │         │
│  │  - Rate Limiting                         │         │
│  │  - Security Headers                      │         │
│  │  - Request Logging                       │         │
│  └──────────────────────────────────────────┘         │
│         │                                              │
│  ┌──────────────────────────────────────────┐         │
│  │         API Routes (Next.js API)         │         │
│  │  - /api/apex/autonomous (Trading)       │         │
│  │  - /api/apex/grok-analysis (AI)         │         │
│  │  - /api/apex/saxo-token (Auth)          │         │
│  │  - /api/apex/get-positions (Data)       │         │
│  └──────────────────────────────────────────┘         │
│         │              │              │               │
│    ┌────┴────┐    ┌────┴────┐   ┌────┴────┐         │
│    │   Grok  │    │  Saxo   │   │ Inngest │         │
│    │  API    │    │  API    │   │ Workflows         │
│    └─────────┘    └─────────┘   └─────────┘         │
│                                                       │
│  ┌──────────────────────────────────────────┐        │
│  │      Libraries & Utilities               │        │
│  │  - Error Handler    - Logger             │        │
│  │  - Rate Limiter     - Streaming          │        │
│  │  - Grok Integration - Store (Zustand)    │        │
│  │  - Saxo Integration - Middleware         │        │
│  └──────────────────────────────────────────┘        │
│                                                       │
└─────────────────────────────────────────────────────┘
```

---

## Installation & Setup

### 1. Clone & Installation

```bash
# Clone repository
git clone https://github.com/andreaslonvik-code/apex-quantum-heavyV1.git
cd apex-quantum-heavyV1

# Install dependencies
npm install

# Optional: Install dev dependencies
npm install --save-dev @types/node typescript eslint
```

### 2. Environment Configuration

Copy `.env.local` and configure:

```bash
# Copy example (created automatically)
cp .env.local .env.local

# Edit with your credentials
nano .env.local
```

**Essential Variables:**
```env
# Grok-4-Heavy (xAI)
XAI_API_KEY=sk_...
GROK_MODEL=grok-4-heavy

# Saxo Bank API
SAXO_API_KEY=...
SAXO_ACCOUNT_ID=...
SAXO_BASE_URL=https://gateway.saxobank.com/sim

# Trading Configuration
TRADING_CAPITAL=1000000
TRADING_MODE=sandbox

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=60

# Monitoring (Optional)
SENTRY_DSN=https://...
```

### 3. Build & Run

```bash
# Development
npm run dev

# Production build
npm run build

# Production run
npm start
```

---

## API Endpoints

### Trading Endpoints

#### Autonomous Trading
```bash
POST /api/apex/autonomous
Content-Type: application/json

{
  "action": "scan_and_execute"
}
```

#### Grok-Powered Analysis
```bash
# Get trading signal
POST /api/apex/grok-analysis
{
  "symbol": "MU",
  "currentPrice": 110.50,
  "priceHistory": [109, 110, 110.50],
  "volume": 5000000,
  "rsi": 55,
  "macd": { "value": 0.5, "signal": 0.3, "histogram": 0.2 }
}

# Stream real-time analysis
GET /api/apex/grok-analysis?action=stream&symbol=MU

# Optimize portfolio
POST /api/apex/grok-analysis?action=optimize
{
  "positions": [
    { "symbol": "MU", "amount": 100, "price": 110.50 }
  ],
  "marketConditions": { "volatility": "high" }
}

# Get learning insights
POST /api/apex/grok-analysis?action=learn
{
  "strategyMetrics": { ... },
  "recentTrades": [ ... ],
  "winRate": 0.58
}

# Get metrics
GET /api/apex/grok-analysis?action=metrics
```

#### Position Management
```bash
GET /api/apex/get-positions
GET /api/apex/performance
```

### WebSocket Streaming

```javascript
const ws = new WebSocket('wss://apexquantum.no/stream');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle market data
};

ws.send(JSON.stringify({
  type: 'subscribe',
  symbol: 'MU'
}));
```

---

## Configuration Guide

### Trading Parameters

Located in `.env.local`:

```env
# Day-trading aggressiveness
TRADING_MODE=sandbox|production
TRADING_CAPITAL=1000000
TRADING_MAX_DAILY_LOSS_PERCENT=5
TRADING_AUTO_PURGE_INTERVAL_MS=10000

# Trading strategies
TRADING_STRATEGIES=dip_buying,scalping,momentum
```

### Rate Limiting

```env
RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_REQUESTS_PER_HOUR=1000
RATE_LIMIT_REQUESTS_PER_DAY=10000
RATE_LIMIT_BAN_DURATION_MINUTES=30
```

### Logging

```env
LOG_LEVEL=info                    # debug|info|warn|error
LOG_FORMAT=json                   # json|text
LOG_TO_FILE=true
LOG_FILE_PATH=./logs/apex-quantum.log
LOG_RETENTION_DAYS=30
```

---

## Security Hardening

### 1. Environment Variables
- ✅ Keep `.env.local` out of version control (added to `.gitignore`)
- ✅ Use strong, unique API keys
- ✅ Rotate keys regularly
- ✅ Use separate keys for sandbox/production

### 2. API Security
- ✅ Rate limiting enabled by default
- ✅ CORS configured for allowed origins
- ✅ Security headers (CSP, X-Frame-Options, HSTS)
- ✅ Input validation on all endpoints

### 3. Data Protection
- ✅ HTTPS/TLS in production
- ✅ API keys never logged
- ✅ All trading data encrypted at rest
- ✅ Request signing for sensitive operations

### 4. Monitoring
```bash
# Check logs
tail -f ./logs/apex-quantum.log

# Monitor performance
npm run build
npm start

# View Sentry errors (if configured)
# https://sentry.io/organizations/...
```

---

## Deployment to Production

### Option 1: Vercel (Recommended)

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel

# Set environment variables
vercel env add XAI_API_KEY
vercel env add SAXO_API_KEY
# ... add other variables

# Production deployment
vercel --prod
```

### Option 2: Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

ENV NODE_ENV=production
CMD ["npm", "start"]
```

```bash
# Build and run
docker build -t apex-quantum:latest .
docker run -p 3000:3000 \
  -e XAI_API_KEY=$XAI_API_KEY \
  -e SAXO_API_KEY=$SAXO_API_KEY \
  apex-quantum:latest
```

### Option 3: Self-Hosted (VPS)

```bash
# On your VPS
git clone https://github.com/andreaslonvik-code/apex-quantum-heavyV1.git
cd apex-quantum-heavyV1
npm install
npm run build

# Use PM2 for process management
npm install -g pm2
pm2 start "npm start" --name apex-quantum
pm2 save
pm2 startup

# Setup Nginx reverse proxy
sudo apt install nginx
# Configure /etc/nginx/sites-enabled/apex-quantum
sudo systemctl restart nginx

# Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d apexquantum.no
```

---

## Monitoring & Logging

### Structured Logging

All logs are JSON-formatted for easy parsing:

```json
{
  "timestamp": "2026-04-19T10:30:45.123Z",
  "level": "info",
  "message": "Trading signal generated",
  "context": {
    "symbol": "MU",
    "signal": "BUY",
    "confidence": 85,
    "duration": "145ms"
  }
}
```

### Metrics Collection

The store tracks:
- Total trades
- Win rate
- Profit factor
- Sharpe ratio
- Max drawdown
- Strategy parameters

Access via: `GET /api/apex/grok-analysis?action=metrics`

### Error Tracking

Enable Sentry for error monitoring:

```env
SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
SENTRY_ENABLED=true
SENTRY_ENVIRONMENT=production
```

---

## Testing the System

### Unit Tests
```bash
# Create tests in __tests__ directory
npm test
```

### Integration Testing
```bash
# Test Saxo connection
curl -H "Authorization: Bearer $SAXO_TOKEN" \
  https://gateway.saxobank.com/sim/openapi/portfolios

# Test Grok integration
curl -X POST http://localhost:3000/api/apex/grok-analysis \
  -H "Content-Type: application/json" \
  -d '{"symbol":"MU","currentPrice":110.50}'
```

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Create load test
artillery run --target http://localhost:3000 load-test-config.yml
```

---

## Troubleshooting

### Common Issues

**1. Grok API Not Responding**
```bash
# Check API key
echo $XAI_API_KEY

# Test connection
curl -H "Authorization: Bearer $XAI_API_KEY" \
  https://api.grok.ai/v1/models
```

**2. Saxo Token Expired**
- Refresh token flow is automatic
- Check logs for `SAXO_API_ERROR`
- Verify `SAXO_API_KEY` is valid

**3. Rate Limit Errors**
- Check `.env.local` RATE_LIMIT settings
- IP is being throttled after 60 requests/minute
- Wait 30 minutes or whitelist IP: `RATE_LIMIT_WHITELIST_IPS`

**4. Database Connection Issues**
```bash
# Check PostgreSQL connection
psql $DATABASE_URL

# Verify migrations
npm run migrate
```

---

## Performance Optimization

### Frontend
- ✅ Next.js 16 with React 19
- ✅ Image optimization
- ✅ Code splitting
- ✅ CSS modules with Tailwind

### Backend
- ✅ Vercel Edge Functions
- ✅ Response caching (5-second TTL)
- ✅ Streaming for large responses
- ✅ Database connection pooling

### Monitoring
```bash
# Check bundle size
npm run build
# Next.js will show:
# ✓ 1200 KB / gzip: 356 KB

# Analyze performance
npm install --save-dev @next/bundle-analyzer
```

---

## Legal & Compliance

**⚠️ IMPORTANT DISCLAIMERS:**

1. **Risk Warning** - Trading losses can exceed deposits
2. **Not Financial Advice** - Consult advisors before using
3. **System Risk** - Technology failures can delay execution
4. **Market Gaps** - Stop losses may execute at worse prices
5. **Regulatory** - Comply with local trading laws

See [Legal Disclaimers Component](./components/legal-disclaimers.tsx) for full terms.

---

## License

MIT License - See LICENSE.md

---

## Support & Contact

- Email: [support@apexquantum.no](mailto:support@apexquantum.no)
- Issues: https://github.com/andreaslonvik-code/apex-quantum-heavyV1/issues
- Documentation: https://docs.apexquantum.no

---

**APEX QUANTUM v6.1** © 2026 - Powered by Grok-4-Heavy

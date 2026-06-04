/**
 * READ-ONLY data puller for backtesting.
 *
 * Two credential sources (auto-detected):
 *   A) Direct paper keys in env: ALPACA_PAPER_KEY_ID / ALPACA_PAPER_SECRET_KEY
 *      -> node --env-file=.analysis-data/paper.env scripts/analysis/pull-alpaca-history.mjs
 *   B) Stored keys: decrypt the user's row from Supabase using the same
 *      AES-256-GCM format as lib/crypto.ts (needs ENCRYPTION_KEY, SUPABASE_*,
 *      CLERK_SECRET_KEY from .env.local). Pass the email as arg.
 *      -> node --env-file=.env.local scripts/analysis/pull-alpaca-history.mjs <email>
 *
 * Pulls the FULL order history (paginated, not the in-app 500 cap) and, for
 * every symbol ever traded, the daily price history needed to backtest
 * alternative exit settings.
 *
 * Makes only GET calls to Alpaca. Places no orders, mutates nothing. The keys
 * stay in memory and are NEVER written to disk — only the resulting
 * orders/bars JSON is saved under .analysis-data/ (gitignored). Refuses to
 * run against anything other than a paper account.
 */
import { createDecipheriv } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';

const EMAIL = process.argv[2] || 'andreas.lonvik@gmail.com';
const OUT_DIR = '.analysis-data';
const PAPER_DATA = 'https://data.alpaca.markets';
const PAPER_TRADING = 'https://paper-api.alpaca.markets';

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

// ── Vei B: same format as lib/crypto.ts ("ivHex:tagHex:cipherHex", AES-256-GCM) ──
function decrypt(payload) {
  const [ivHex, tagHex, cipherHex] = payload.split(':');
  const key = Buffer.from(need('ENCRYPTION_KEY'), 'hex');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(cipherHex, 'hex')), decipher.final()]).toString('utf8');
}

async function credsFromStore(email) {
  const cRes = await fetch(`https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${need('CLERK_SECRET_KEY')}` } });
  if (!cRes.ok) throw new Error(`Clerk lookup failed: ${cRes.status}`);
  const users = await cRes.json();
  if (!users.length) throw new Error(`No Clerk user for ${email}`);
  const url = `${need('SUPABASE_URL')}/rest/v1/alpaca_accounts?clerk_user_id=eq.${users[0].id}`
    + `&select=api_key_enc,api_secret_enc,environment`;
  const k = need('SUPABASE_SERVICE_ROLE_KEY');
  const sRes = await fetch(url, { headers: { apikey: k, Authorization: `Bearer ${k}` } });
  if (!sRes.ok) throw new Error(`Supabase query failed: ${sRes.status}`);
  const rows = await sRes.json();
  if (!rows.length) throw new Error(`No alpaca_accounts row for ${email}`);
  if (rows[0].environment !== 'paper') throw new Error(`SAFETY STOP: stored env is "${rows[0].environment}", expected paper`);
  return { apiKey: decrypt(rows[0].api_key_enc), apiSecret: decrypt(rows[0].api_secret_enc) };
}

async function resolveCreds() {
  if (process.env.ALPACA_PAPER_KEY_ID && process.env.ALPACA_PAPER_SECRET_KEY) {
    console.log('▶ Using direct paper keys from env (Vei A).');
    return { apiKey: process.env.ALPACA_PAPER_KEY_ID, apiSecret: process.env.ALPACA_PAPER_SECRET_KEY };
  }
  console.log(`▶ Resolving stored paper keys for ${EMAIL} (Vei B).`);
  return credsFromStore(EMAIL);
}

function alpacaHeaders(creds) {
  return { 'APCA-API-KEY-ID': creds.apiKey, 'APCA-API-SECRET-KEY': creds.apiSecret };
}

// Paginate /v2/orders backwards via `until` cursor until exhausted.
async function pullAllOrders(creds) {
  const all = [];
  let until = null;
  for (let page = 0; page < 100; page++) {
    const qs = new URLSearchParams({ status: 'all', limit: '500', direction: 'desc', nested: 'true' });
    if (until) qs.set('until', until);
    const res = await fetch(`${PAPER_TRADING}/v2/orders?${qs}`, { headers: alpacaHeaders(creds) });
    if (!res.ok) throw new Error(`getOrders failed: ${res.status} ${await res.text()}`);
    const batch = await res.json();
    if (!batch.length) break;
    all.push(...batch);
    // Next page ends just before the oldest order in this batch.
    const oldest = batch[batch.length - 1].submitted_at;
    if (!oldest || batch.length < 500) break;
    until = oldest;
  }
  return all;
}

// Daily bars for one symbol going back `years`, paginated via page_token.
async function pullDailyBars(creds, symbol, startISO) {
  const bars = [];
  let pageToken = null;
  for (let page = 0; page < 50; page++) {
    const qs = new URLSearchParams({ timeframe: '1Day', start: startISO, limit: '10000', adjustment: 'split' });
    if (pageToken) qs.set('page_token', pageToken);
    const res = await fetch(`${PAPER_DATA}/v2/stocks/${encodeURIComponent(symbol)}/bars?${qs}`, {
      headers: alpacaHeaders(creds),
    });
    if (!res.ok) {
      console.warn(`  ! bars ${symbol}: ${res.status} ${await res.text()}`);
      break;
    }
    const json = await res.json();
    if (json.bars?.length) bars.push(...json.bars);
    pageToken = json.next_page_token;
    if (!pageToken) break;
  }
  return bars;
}

async function main() {
  const creds = await resolveCreds();
  console.log('▶ Verifying paper credentials …');
  const acctRes = await fetch(`${PAPER_TRADING}/v2/account`, { headers: alpacaHeaders(creds) });
  if (!acctRes.ok) throw new Error(`Account check failed: ${acctRes.status} ${await acctRes.text()}`);
  const acct = await acctRes.json();
  console.log(`  ✓ paper account ${acct.account_number} (status: ${acct.status}, equity: ${acct.equity})`);

  console.log('▶ Pulling full order history (read-only) …');
  const orders = await pullAllOrders(creds);
  console.log(`  ✓ ${orders.length} orders`);

  const filled = orders.filter((o) => o.filled_at);
  const dates = filled.map((o) => o.filled_at).sort();
  const earliest = dates[0] ? dates[0].slice(0, 10) : null;
  // Start bars a bit before the first trade so indicators (SMA50/ATR) warm up.
  const startISO = earliest ? `${Number(earliest.slice(0, 4)) - 1}${earliest.slice(4)}` : '2024-01-01';

  const symbols = [...new Set(orders.map((o) => o.symbol))].sort();
  console.log(`▶ Pulling daily bars for ${symbols.length} symbols since ${startISO} …`);
  const barsBySymbol = {};
  for (const sym of symbols) {
    const bars = await pullDailyBars(creds, sym, startISO);
    barsBySymbol[sym] = bars;
    console.log(`  ✓ ${sym}: ${bars.length} bars`);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(`${OUT_DIR}/orders.json`, JSON.stringify(orders, null, 2));
  writeFileSync(`${OUT_DIR}/bars.json`, JSON.stringify(barsBySymbol));
  writeFileSync(`${OUT_DIR}/meta.json`, JSON.stringify({
    account_id: acct.account_number, environment: 'paper', equity: acct.equity,
    orderCount: orders.length, filledCount: filled.length,
    symbolCount: symbols.length, earliestFill: earliest, barsStart: startISO,
  }, null, 2));

  console.log(`\n✓ Saved to ${OUT_DIR}/ — orders.json, bars.json, meta.json`);
  console.log(`  orders=${orders.length} filled=${filled.length} symbols=${symbols.length} since=${earliest}`);
}

main().catch((e) => { console.error('✗', e.message); process.exit(1); });

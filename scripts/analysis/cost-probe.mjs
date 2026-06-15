// One-off READ-ONLY probe: connected users + grok_decisions token stats.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// 1) Connected users
const { data: accts, error: e1 } = await sb
  .from('alpaca_accounts')
  .select('clerk_user_id, environment, start_balance, created_at');
if (e1) { console.error('accts', e1); process.exit(1); }
console.log('=== CONNECTED USERS ===');
console.log('total accounts:', accts.length);
const byEnv = {};
for (const a of accts) byEnv[a.environment] = (byEnv[a.environment] || 0) + 1;
console.log('by environment:', byEnv);

// 2) grok_decisions stats (last 30 days)
const since = new Date(Date.now() - 30 * 864e5).toISOString();
const { data: gd, error: e2 } = await sb
  .from('grok_decisions')
  .select('clerk_user_id, blueprint_id, decided_at, prompt_tokens, output_tokens, num_sources_used, failed')
  .gte('decided_at', since)
  .order('decided_at', { ascending: true });
if (e2) { console.error('gd', e2); process.exit(1); }

console.log('\n=== GROK_DECISIONS (last 30d) ===');
console.log('total rows:', gd.length);
const ok = gd.filter((r) => !r.failed);
console.log('non-failed:', ok.length, '| failed:', gd.length - ok.length);

const sum = (arr, k) => arr.reduce((s, r) => s + (r[k] || 0), 0);
const avg = (arr, k) => (arr.length ? Math.round(sum(arr, k) / arr.filter((r)=>r[k]!=null).length) : 0);
console.log('avg prompt_tokens:', avg(ok, 'prompt_tokens'));
console.log('avg output_tokens:', avg(ok, 'output_tokens'));
console.log('avg num_sources_used:', (sum(ok,'num_sources_used')/ok.filter(r=>r.num_sources_used!=null).length||0).toFixed(2));
console.log('rows with live-search (sources>0):', ok.filter((r)=>(r.num_sources_used||0)>0).length);

// distinct users that triggered grok calls
const users = [...new Set(ok.map((r) => r.clerk_user_id))];
console.log('distinct users calling grok:', users.length);
const byUser = {};
for (const r of ok) byUser[r.clerk_user_id] = (byUser[r.clerk_user_id] || 0) + 1;
console.log('calls per user:', byUser);

// by blueprint
const byBp = {};
for (const r of ok) byBp[r.blueprint_id] = (byBp[r.blueprint_id] || 0) + 1;
console.log('calls per blueprint:', byBp);

// calls per day (recent 10 days)
const byDay = {};
for (const r of ok) { const d = r.decided_at.slice(0,10); byDay[d]=(byDay[d]||0)+1; }
const days = Object.keys(byDay).sort();
console.log('\ncalls per day (last 10):');
for (const d of days.slice(-10)) console.log('  ', d, byDay[d]);
const recent = days.slice(-7).map(d=>byDay[d]);
console.log('avg calls/day (last 7 active days):', recent.length? Math.round(recent.reduce((a,b)=>a+b,0)/recent.length):0);

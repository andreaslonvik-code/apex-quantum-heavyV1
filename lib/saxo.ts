// lib/saxo.ts
import { sql } from '@vercel/postgres';

const SAXO_BASE = process.env.SAXO_ENV === 'live' 
  ? 'https://gateway.saxobank.com/openapi' 
  : 'https://sim.gateway.saxobank.com/sim/openapi';

let accessToken = process.env.SAXO_ACCESS_TOKEN;

export async function refreshSaxoToken() {
  // Full OAuth2 refresh logic her (bruk din eksisterende kode eller la v0 generere)
  // ...
  accessToken = newToken;
}

export async function sendSaxoOrder(order: any) {
  await refreshSaxoToken(); // alltid refresh først

  const payload = {
    AssetType: 'Stock',
    Uic: order.uic || await getUicFromTicker(order.ticker), // legg til mapping
    BuySell: order.action === 'BUY' ? 'Buy' : 'Sell',
    OrderType: order.priceType || 'Market',
    Amount: order.quantity,
    ManualOrder: true,
    Duration: { DurationType: 'DayOrder' }
  };

  const res = await fetch(`${SAXO_BASE}/trade/v2/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  // LOGG ALT TIL DB + Inngest
  await sql`INSERT INTO apex_audit_log (order_data, saxo_response, status) 
            VALUES (${JSON.stringify(order)}, ${JSON.stringify(data)}, ${data.OrderStatus || 'UNKNOWN'})`;

  if (!res.ok || data.OrderStatus === 'Annullert') {
    throw new Error(`Saxo feil: ${data.Message || JSON.stringify(data)}`);
  }

  return data;
}

// Hjelpefunksjon for å hente UIC (Saxo krever dette)
async function getUicFromTicker(ticker: string) {
  // Kall Saxo instrument search her – implementer ved behov
  return ticker; // fallback
}

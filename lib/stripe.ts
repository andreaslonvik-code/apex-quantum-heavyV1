import Stripe from 'stripe';

const apiKey = process.env.STRIPE_SECRET_KEY;

/**
 * Server-side Stripe client. `null` if STRIPE_SECRET_KEY is not configured —
 * call sites must check before use so build-time evaluation in environments
 * without env vars (preview deploys, local dev) doesn't crash.
 */
export const stripe: Stripe | null = apiKey ? new Stripe(apiKey) : null;

export const PLUS_PRICE_ID = process.env.STRIPE_PLUS_PRICE_ID ?? null;

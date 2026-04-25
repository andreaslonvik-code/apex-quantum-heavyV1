/**
 * Service-role Supabase client for server-only contexts (cron, inngest).
 * Bypasses RLS — never import from a Route Handler that handles user requests
 * unless you've manually authorized the caller (e.g. Vercel cron secret).
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function createAdminClient() {
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — required for cron/inngest');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

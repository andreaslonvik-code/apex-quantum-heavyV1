/**
 * Database client — Supabase.
 * Use `createClient` from utils/supabase/server.ts in API routes.
 * Use `createClient` from utils/supabase/client.ts in Client Components.
 *
 * This file exists as a re-export convenience for server contexts
 * where you already have a cookieStore.
 */
export { createClient } from '@/utils/supabase/server';

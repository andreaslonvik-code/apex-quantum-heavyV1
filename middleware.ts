import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * M5 fix — root middleware.ts (was non-standard proxy.ts which Next.js
 * never picked up; every route was de-facto public unless its handler
 * called auth() itself). This file is auto-detected by Next.js and now
 * enforces Clerk session on every non-public route.
 *
 * Public-route allowlist below is the explicit list of unauthenticated
 * surfaces. Anything not matched here requires a Clerk session.
 *
 * Adding a new public route? Add it here AND review whether the route's
 * handler safely tolerates being hit by anyone.
 */
const isPublicRoute = createRouteMatcher([
  // Marketing site
  '/',
  '/om-oss',
  '/kontakt',
  '/blogg',
  '/status',
  '/personvern',
  '/vilkar',
  '/risikofaktorer',
  '/cookies',
  '/pris',
  '/plus',
  '/innsyn',                  // public transparency page
  '/quantum',                 // public demo
  // Auth flows
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/callback(.*)',
  // Public API endpoints
  '/api/apex/saxo-token',     // auth checked inside handler
  '/api/inngest(.*)',
  '/api/cron(.*)',            // CRON_SECRET enforced inside handler (C5)
  '/api/marketing(.*)',
  '/api/transparency(.*)',    // public read-only timeline for /innsyn
  '/api/plus/stripe-webhook', // verified by Stripe signature
  '/api/plus/email-unsubscribe', // HMAC token verified inside (C4)
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};

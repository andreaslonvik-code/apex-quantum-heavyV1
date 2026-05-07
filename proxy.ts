import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Routes accessible without being logged in
const isPublicRoute = createRouteMatcher([
  '/',                     // marketing landing page
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/callback(.*)',         // Saxo OAuth redirect — user may carry Clerk session
  '/api/apex/saxo-token',  // called from callback page; auth checked inside handler
  '/api/inngest(.*)',      // Inngest webhooks
  '/api/cron(.*)',         // Vercel cron jobs
  '/api/marketing(.*)',    // Public landing-page endpoints (no PII leaked)
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

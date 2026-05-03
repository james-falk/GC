import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Protected route matchers — expand as features land.
const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/projects(.*)',
  '/organizations(.*)',
  '/subcontractors(.*)',
  '/pay-apps(.*)',
  '/change-orders(.*)',
  '/documents(.*)',
  '/drift(.*)',
  '/exports(.*)',
  '/team(.*)',
  '/settings(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and static assets
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run on API routes
    '/(api|trpc)(.*)',
  ],
};

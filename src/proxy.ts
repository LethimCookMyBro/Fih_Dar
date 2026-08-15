import { clerkMiddleware } from '@clerk/nextjs/server';

// Auth is enforced per resource — `requireAuthOrRedirect()` in the protected
// pages and `requireCurrentClerkUser()` in every protected route handler — so
// this only has to attach the Clerk session to the request.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ]
};

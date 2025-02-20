import { clerkMiddleware } from "@clerk/nextjs/server";

// This example protects all routes including api/trpc routes
// Please edit this to allow other routes to be public as needed.
export default clerkMiddleware();

// Only run middleware on these paths, and ensure sign-in route is public
export const config = {
  matcher: ["/settings(.*)", "/((?!.+\\.[\\w]+$|_next|sign-in).*)"],
};

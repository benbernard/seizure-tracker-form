import {
  clerkMiddleware,
  getAuth,
  type ClerkMiddlewareAuth,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const DEBUG_AUTH = false;

// Development-only logging helper
function devLog(message: string, ...args: unknown[]) {
  if (process.env.NODE_ENV === "development" && DEBUG_AUTH) {
    console.log("\x1b[35m%s\x1b[0m", "[Middleware]", message, ...args);
  }
}

// Export Clerk's middleware
export default clerkMiddleware(
  async (authPromise: ClerkMiddlewareAuth, req: NextRequest) => {
    devLog("Middleware executing for:", req.nextUrl.pathname);

    const auth = await authPromise();
    const { userId } = auth;

    // Get allowlist from environment variable
    const allowlist =
      process.env.CLERK_ALLOWLIST_EMAILS?.split(",").map((email) =>
        email.trim(),
      ) || [];
    devLog("Allowlist:", allowlist);

    // If no allowlist configured, allow all authenticated users
    if (allowlist.length === 0) {
      devLog("No allowlist configured, allowing all users");
      return NextResponse.next();
    }

    // If no user, redirect to sign-in
    if (!userId) {
      devLog("No user found, redirecting to sign-in");
      return NextResponse.redirect(
        new URL(
          `/sign-in?redirect_url=${encodeURIComponent(req.url)}`,
          req.url,
        ),
      );
    }

    // Get user's email from session claims
    const email = auth.sessionClaims?.email as string | undefined;
    devLog("User email:", email);

    // If user has no email or email is not in allowlist, redirect to unauthorized
    if (!email || !allowlist.includes(email)) {
      devLog("Access denied for email:", email);
      // Clear any existing session to force a new auth check
      const response = NextResponse.redirect(new URL("/unauthorized", req.url));
      response.headers.set("Set-Cookie", ""); // Clear cookies
      return response;
    }

    devLog("Access granted for email:", email);
    return NextResponse.next();
  },
);

// Configure middleware matcher to protect both settings and API routes,
// but exclude the seizure API endpoint so it can be accessed without authentication
export const config = {
  matcher: [
    "/settings/:path*",
    {
      source: "/api/:path*",
      not: ["/api/seizure"],
    },
  ],
};

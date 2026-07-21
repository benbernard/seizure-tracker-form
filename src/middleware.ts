import {
  type ClerkMiddlewareAuth,
  clerkMiddleware,
  getAuth,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { isLocalAuth } from "./lib/clerk";

const DEBUG_AUTH = false;

const localAuth = isLocalAuth();

function devLog(message: string, ...args: unknown[]) {
  if (process.env.NODE_ENV === "development" && DEBUG_AUTH) {
    console.log("\x1b[35m%s\x1b[0m", "[Middleware]", message, ...args);
  }
}

function isPublicPath(pathname: string): boolean {
  // Public patient pages and the public seizure submission endpoint
  if (pathname.startsWith("/p/")) return true;
  if (pathname.startsWith("/api/seizure/")) return true;

  // Landing page and auth/error pages
  if (
    pathname === "/" ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/sign-up") ||
    pathname === "/unauthorized"
  ) {
    return true;
  }

  return false;
}

export async function middlewareHandler(
  authPromise: ClerkMiddlewareAuth,
  req: NextRequest,
) {
  const pathname = req.nextUrl.pathname;
  devLog("Middleware executing for:", pathname);

  if (isPublicPath(pathname)) {
    devLog("Public path, skipping auth");
    return NextResponse.next();
  }

  const auth = await authPromise();
  const { userId } = auth;

  const allowlist =
    process.env.CLERK_ALLOWLIST_EMAILS?.split(",").map((email) =>
      email.trim(),
    ) || [];
  devLog("Allowlist:", allowlist);

  if (allowlist.length === 0) {
    devLog("No allowlist configured, allowing all authenticated users");
    if (!userId) {
      return NextResponse.redirect(
        new URL(
          `/sign-in?redirect_url=${encodeURIComponent(req.url)}`,
          req.url,
        ),
      );
    }
    return NextResponse.next();
  }

  if (!userId) {
    devLog("No user found, redirecting to sign-in");
    return NextResponse.redirect(
      new URL(`/sign-in?redirect_url=${encodeURIComponent(req.url)}`, req.url),
    );
  }

  const email = auth.sessionClaims?.email as string | undefined;
  devLog("User email:", email);

  if (!email || !allowlist.includes(email)) {
    devLog("Access denied for email:", email);
    const response = NextResponse.redirect(new URL("/unauthorized", req.url));
    response.headers.set("Set-Cookie", "");
    return response;
  }

  devLog("Access granted for email:", email);
  return NextResponse.next();
}

const clerkMiddlewareInstance = clerkMiddleware(middlewareHandler);

export default function middleware(req: NextRequest, event: NextFetchEvent) {
  if (localAuth) {
    return NextResponse.next();
  }
  return clerkMiddlewareInstance(req, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};

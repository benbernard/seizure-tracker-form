import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";

// Create our middleware handler
async function domainMiddleware(request: NextRequest) {
  // Check if we're in production and on the wrong domain
  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("host") !== "seizure.bernards.space"
  ) {
    const newUrl = new URL(request.url);
    newUrl.protocol = "https:"; // Force HTTPS in production
    newUrl.host = "seizure.bernards.space";

    // pathname, search (query params), and hash are automatically preserved by the URL constructor
    return NextResponse.redirect(newUrl);
  }

  // Let the request continue
  return NextResponse.next();
}

const clerk = clerkMiddleware();

// Export the middleware handler that runs both our domain check and Clerk's auth
export default async function middleware(
  request: NextRequest,
  event: NextFetchEvent,
) {
  // First check the domain
  const response = await domainMiddleware(request);
  if (response.status !== 200) {
    return response;
  }

  // Then run Clerk's middleware
  return clerk(request, event);
}

// Only run middleware on these paths, and ensure sign-in route is public
export const config = {
  matcher: ["/settings(.*)", "/((?!.+\\.[\\w]+$|_next|sign-in).*)"],
};

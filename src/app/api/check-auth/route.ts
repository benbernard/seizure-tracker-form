import { getAuth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { userId, sessionClaims } = await getAuth(request);

  if (!userId) {
    return new NextResponse(null, { status: 401 });
  }

  const email = sessionClaims?.email as string | undefined;
  const allowlist =
    process.env.CLERK_ALLOWLIST_EMAILS?.split(",").map((email) =>
      email.trim(),
    ) || [];

  if (!email || !allowlist.includes(email)) {
    return new NextResponse(null, { status: 403 });
  }

  return new NextResponse(null, { status: 200 });
}

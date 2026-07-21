import {
  auth as clerkAuth,
  getAuth as clerkGetAuth,
} from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

export function isLocalAuth(): boolean {
  return Boolean(process.env.LOCAL_AUTH_USER_ID);
}

export async function auth() {
  if (isLocalAuth()) {
    return { userId: process.env.LOCAL_AUTH_USER_ID } as Awaited<
      ReturnType<typeof clerkAuth>
    >;
  }
  return clerkAuth();
}

export async function getAuth(request: NextRequest) {
  if (isLocalAuth()) {
    return { userId: process.env.LOCAL_AUTH_USER_ID } as Awaited<
      ReturnType<typeof clerkGetAuth>
    >;
  }
  return clerkGetAuth(request);
}

import type {
  ClerkMiddlewareAuth,
  ClerkMiddlewareAuthObject,
} from "@clerk/nextjs/server";
import { NextRequest } from "next/server";
import { middlewareHandler } from "./middleware";

describe("middlewareHandler", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    process.env.CLERK_ALLOWLIST_EMAILS = undefined;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  function req(path: string) {
    return new NextRequest(new URL(`http://localhost:3000${path}`));
  }

  function auth(userId: string | null, email?: string): ClerkMiddlewareAuth {
    const fn = jest.fn().mockResolvedValue({
      userId,
      sessionClaims: email ? { email } : undefined,
    }) as unknown as ClerkMiddlewareAuth;
    fn.protect = jest.fn() as ClerkMiddlewareAuth["protect"];
    return fn;
  }

  test("allows public patient pages without auth", async () => {
    const response = await middlewareHandler(
      auth(null),
      req("/p/some-patient"),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  test("allows the public seizure API without auth", async () => {
    const response = await middlewareHandler(
      auth(null),
      req("/api/seizure/some-patient"),
    );
    expect(response.status).toBe(200);
  });

  test("allows the landing page without auth", async () => {
    const response = await middlewareHandler(auth(null), req("/"));
    expect(response.status).toBe(200);
  });

  test("allows auth pages without auth", async () => {
    const response = await middlewareHandler(auth(null), req("/sign-in"));
    expect(response.status).toBe(200);
  });

  test("redirects unauthenticated users to sign-in for protected paths", async () => {
    const response = await middlewareHandler(auth(null), req("/settings"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/sign-in");
  });

  test("allows authenticated users when allowlist is empty", async () => {
    const response = await middlewareHandler(auth("user_1"), req("/settings"));
    expect(response.status).toBe(200);
  });

  test("allows allowlisted emails", async () => {
    process.env.CLERK_ALLOWLIST_EMAILS = "alice@example.com";
    const response = await middlewareHandler(
      auth("user_1", "alice@example.com"),
      req("/settings"),
    );
    expect(response.status).toBe(200);
  });

  test("redirects non-allowlisted emails to unauthorized", async () => {
    process.env.CLERK_ALLOWLIST_EMAILS = "alice@example.com";
    const response = await middlewareHandler(
      auth("user_1", "bob@example.com"),
      req("/settings"),
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/unauthorized");
  });
});

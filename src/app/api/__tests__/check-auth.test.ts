jest.mock("@/lib/clerk", () => ({ getAuth: jest.fn() }));

import { getAuth } from "@/lib/clerk";
import { NextRequest } from "next/server";
import { GET } from "../check-auth/route";

function req(url: string) {
  return new NextRequest(url);
}

describe("GET /api/check-auth", () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns 200 for an allowlisted email", async () => {
    process.env.CLERK_ALLOWLIST_EMAILS = "alice@example.com";
    (getAuth as jest.Mock).mockResolvedValue({
      userId: "user_1",
      sessionClaims: { email: "alice@example.com" },
    });

    const request = req("http://localhost/api/check-auth");
    const response = await GET(request);

    expect(response.status).toBe(200);
  });

  test("returns 401 when not signed in", async () => {
    process.env.CLERK_ALLOWLIST_EMAILS = "alice@example.com";
    (getAuth as jest.Mock).mockResolvedValue({ userId: null });

    const request = req("http://localhost/api/check-auth");
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  test("returns 403 for a non-allowlisted email", async () => {
    process.env.CLERK_ALLOWLIST_EMAILS = "alice@example.com";
    (getAuth as jest.Mock).mockResolvedValue({
      userId: "user_1",
      sessionClaims: { email: "bob@example.com" },
    });

    const request = req("http://localhost/api/check-auth");
    const response = await GET(request);

    expect(response.status).toBe(403);
  });

  test("allows any authenticated user when allowlist is empty", async () => {
    process.env.CLERK_ALLOWLIST_EMAILS = undefined;
    (getAuth as jest.Mock).mockResolvedValue({
      userId: "user_1",
      sessionClaims: { email: "bob@example.com" },
    });

    const request = req("http://localhost/api/check-auth");
    const response = await GET(request);

    expect(response.status).toBe(200);
  });
});

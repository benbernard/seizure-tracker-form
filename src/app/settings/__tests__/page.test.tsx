jest.mock("@/lib/clerk", () => ({ auth: jest.fn() }));
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
jest.mock("@/app/actions", () => ({
  getSettings: jest.fn(),
}));

import { getSettings } from "@/app/actions";
import { auth } from "@/lib/clerk";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import SettingsPage from "../page";

const mockAuth = auth as jest.Mock;
const mockCookies = cookies as jest.Mock;
const mockGetSettings = getSettings as jest.Mock;

function mockCookieStore(value?: string) {
  mockCookies.mockReturnValue({
    get: jest.fn((name: string) =>
      name === "lastPatientId" ? { value } : undefined,
    ),
  });
}

describe("Settings page", () => {
  test("redirects to sign-in when user is not signed in", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    await expect(SettingsPage()).rejects.toThrow("REDIRECT:/sign-in");
    expect(redirect).toHaveBeenCalledWith("/sign-in?redirect_url=/settings");
  });

  test("redirects to last patient settings from cookie", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCookieStore("pat1");

    await expect(SettingsPage()).rejects.toThrow("REDIRECT:/p/pat1/settings");
    expect(redirect).toHaveBeenCalledWith("/p/pat1/settings");
  });

  test("redirects to current patient settings from settings", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCookieStore();
    mockGetSettings.mockResolvedValue({
      id: "user_1",
      currentPatientId: "pat2",
    });

    await expect(SettingsPage()).rejects.toThrow("REDIRECT:/p/pat2/settings");
    expect(redirect).toHaveBeenCalledWith("/p/pat2/settings");
  });

  test("renders client settings when no patient is known", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCookieStore();
    mockGetSettings.mockResolvedValue({
      id: "user_1",
      currentPatientId: undefined,
    });

    const element = await SettingsPage();
    expect(element).toBeDefined();
  });
});

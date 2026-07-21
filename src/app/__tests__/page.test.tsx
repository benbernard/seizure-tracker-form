jest.mock("@/lib/clerk", () => ({ auth: jest.fn() }));
jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));
jest.mock("next/navigation", () => ({
  redirect: jest.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: jest.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));
jest.mock("@/app/actions", () => ({
  getPublicPatient: jest.fn(),
  getTodaySeizuresPublic: jest.fn(),
  getSettings: jest.fn(),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn((options: { initialData?: unknown }) => ({
    data: options?.initialData ?? [],
  })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));
jest.mock("next/link", () => {
  return function Link({
    children,
    href,
  }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

import {
  getPublicPatient,
  getSettings,
  getTodaySeizuresPublic,
} from "@/app/actions";
import { auth } from "@/lib/clerk";
import { render, screen } from "@testing-library/react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import PatientPage from "../p/[patientId]/page";
import Home from "../page";

const mockAuth = auth as unknown as jest.Mock;
const mockCookies = cookies as jest.Mock;
const mockGetSettings = getSettings as jest.Mock;
const mockGetPublicPatient = jest.mocked(getPublicPatient);
const mockGetTodaySeizuresPublic = jest.mocked(getTodaySeizuresPublic);

function mockCookieStore(value?: string) {
  mockCookies.mockReturnValue({
    get: jest.fn((name: string) =>
      name === "lastPatientId" ? { value } : undefined,
    ),
  });
}

describe("Home page", () => {
  test("redirects signed-in users to last patient from cookie", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCookieStore("pat1");

    await expect(Home()).rejects.toThrow("REDIRECT:/p/pat1");
    expect(redirect).toHaveBeenCalledWith("/p/pat1");
  });

  test("redirects signed-in users to settings when no last patient", async () => {
    mockAuth.mockResolvedValue({ userId: "user_1" });
    mockCookieStore();
    mockGetSettings.mockResolvedValue({
      id: "user_1",
      currentPatientId: undefined,
    });

    await expect(Home()).rejects.toThrow("REDIRECT:/settings");
    expect(redirect).toHaveBeenCalledWith("/settings");
  });

  test("renders landing page for signed-out users", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const element = await Home();
    render(element);

    expect(screen.getByText("Seizure Tracker")).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Sign in as an admin to view patients",
      }),
    ).toHaveAttribute("href", "/sign-in");
  });
});

describe("Patient public page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renders the public patient page when patient exists", async () => {
    mockGetPublicPatient.mockResolvedValue({
      id: "pat1",
      name: "Alex",
      quickButtonSeconds: [5, 10, 15, 20],
    });
    mockGetTodaySeizuresPublic.mockResolvedValue({
      seizures: [{ patient: "pat1", date: 1000, duration: 5, notes: "note" }],
    });

    const element = await PatientPage({
      params: Promise.resolve({ patientId: "pat1" }),
    });
    render(element);

    expect(screen.getByText("Alex Seizure Tracker")).toBeInTheDocument();
    expect(screen.getByText("Today's Seizures (1)")).toBeInTheDocument();
  });

  test("calls notFound when patient does not exist", async () => {
    mockGetPublicPatient.mockResolvedValue(null);

    await expect(
      PatientPage({ params: Promise.resolve({ patientId: "missing" }) }),
    ).rejects.toThrow("NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });
});

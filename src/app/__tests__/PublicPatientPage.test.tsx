jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn((options) => ({ data: options?.initialData ?? [] })),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));

jest.mock("react-dom", () => ({
  ...jest.requireActual("react-dom"),
  useFormStatus: jest.fn(() => ({ pending: false })),
}));

jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

jest.mock("@/lib/clerk-client", () => ({
  useAuth: jest.fn(() => ({ isSignedIn: false, userId: null })),
}));

jest.mock("next/link", () => {
  return function Link({
    children,
    href,
    "aria-label": ariaLabel,
  }: {
    children: React.ReactNode;
    href: string;
    "aria-label"?: string;
  }) {
    return (
      <a href={href} aria-label={ariaLabel}>
        {children}
      </a>
    );
  };
});

jest.mock("../actions", () => ({
  getTodaySeizuresPublic: jest.fn(),
  submitSeizurePublic: jest.fn(),
}));

import { useAuth } from "@/lib/clerk-client";
import { useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { submitSeizurePublic } from "../actions";
import PublicPatientPage from "../p/[patientId]/PublicPatientPage";

describe("PublicPatientPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useQuery as jest.Mock).mockImplementation((options) => ({
      data: options?.initialData ?? [],
    }));
  });

  test("renders patient name and today seizure count", () => {
    render(
      <PublicPatientPage
        patientId="pat1"
        patientName="Alex"
        initialSeizures={[
          { patient: "pat1", date: 1000, duration: 10, notes: "note" },
        ]}
      />,
    );

    expect(screen.getByText("Alex Seizure Tracker")).toBeInTheDocument();
    expect(screen.getByText("Today's Seizures (1)")).toBeInTheDocument();
  });

  test("quick submit button calls submitSeizurePublic", async () => {
    const user = userEvent.setup();
    (submitSeizurePublic as jest.Mock).mockResolvedValue({ success: true });

    render(
      <PublicPatientPage
        patientId="pat1"
        patientName="Alex"
        initialSeizures={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "10s" }));

    await waitFor(() => {
      expect(submitSeizurePublic).toHaveBeenCalledWith(
        "pat1",
        "10",
        "QuickAction",
      );
    });
  });

  test("manual form submission calls submitSeizurePublic with notes", async () => {
    const user = userEvent.setup();
    (submitSeizurePublic as jest.Mock).mockResolvedValue({ success: true });

    render(
      <PublicPatientPage
        patientId="pat1"
        patientName="Alex"
        initialSeizures={[]}
      />,
    );

    await user.type(screen.getByLabelText("Duration (seconds)"), "15");
    await user.type(
      screen.getByPlaceholderText("Optional notes"),
      "felt tired",
    );
    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(submitSeizurePublic).toHaveBeenCalledWith(
        "pat1",
        "15",
        expect.stringContaining("felt tired"),
      );
    });
  });

  test("shows empty state when no seizures", () => {
    render(
      <PublicPatientPage
        patientId="pat1"
        patientName="Alex"
        initialSeizures={[]}
      />,
    );

    expect(screen.getByText("No seizures recorded today.")).toBeInTheDocument();
  });

  test("shows history and medication link next to today's seizures", () => {
    render(
      <PublicPatientPage
        patientId="pat1"
        patientName="Alex"
        initialSeizures={[]}
      />,
    );

    expect(
      screen.getByRole("link", { name: "History and medication" }),
    ).toHaveAttribute("href", "/p/pat1/graphs");
  });

  test("shows sign in link when not signed in", () => {
    render(
      <PublicPatientPage
        patientId="pat1"
        patientName="Alex"
        initialSeizures={[]}
      />,
    );

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });

  test("shows settings link when signed in", () => {
    (useAuth as jest.Mock).mockReturnValue({
      isSignedIn: true,
      userId: "user_1",
    });

    render(
      <PublicPatientPage
        patientId="pat1"
        patientName="Alex"
        initialSeizures={[]}
      />,
    );

    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/p/pat1/settings",
    );
  });

  test("renders custom quick button durations", async () => {
    const user = userEvent.setup();
    (submitSeizurePublic as jest.Mock).mockResolvedValue({ success: true });

    render(
      <PublicPatientPage
        patientId="pat1"
        patientName="Alex"
        quickButtonSeconds={[3, 7, 12]}
        initialSeizures={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "7s" }));

    await waitFor(() => {
      expect(submitSeizurePublic).toHaveBeenCalledWith(
        "pat1",
        "7",
        "QuickAction",
      );
    });
  });
});

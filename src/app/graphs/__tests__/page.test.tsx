jest.mock("next/link", () => {
  return function Link({
    children,
    href,
    title,
  }: { children: React.ReactNode; href: string; title?: string }) {
    return (
      <a href={href} title={title}>
        {children}
      </a>
    );
  };
});
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));
jest.mock("../../components/PatientContext", () => ({
  usePatientId: jest.fn(),
}));
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("@/app/actions", () => ({
  getSettings: jest.fn(),
  listSeizures: jest.fn(),
  listMedicationChanges: jest.fn(),
  createMedicationChange: jest.fn(),
  deleteMedicationChange: jest.fn(),
}));

import { useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { usePatientId } from "../../components/PatientContext";
import GraphsPage from "../page";

const mockUseQuery = useQuery as jest.Mock;
const mockUsePatientId = usePatientId as jest.Mock;

describe("Graphs page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      const key = options.queryKey;
      if (key[0] === "settings") {
        return {
          data: { id: "user_1", currentPatientId: undefined },
          isLoading: false,
        };
      }
      return { data: [], isLoading: false };
    });
  });

  test("shows message when no patient is selected", () => {
    mockUsePatientId.mockReturnValue(undefined);

    render(<GraphsPage />);
    expect(screen.getByText("No Patient Selected")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Go to Settings" }),
    ).toHaveAttribute("href", "/settings");
  });

  test("shows loading state while settings load", () => {
    mockUsePatientId.mockReturnValue(undefined);
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    render(<GraphsPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  test("back button goes to the current patient's public page", () => {
    mockUsePatientId.mockReturnValue("pat1");

    render(<GraphsPage />);
    expect(screen.getByRole("link", { name: "Back" })).toHaveAttribute(
      "href",
      "/p/pat1",
    );
  });
});

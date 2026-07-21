jest.mock("@/lib/clerk-client", () => ({
  SignOutButton: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  useAuth: () => ({ isLoaded: true, isSignedIn: true, signOut: jest.fn() }),
}));
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn(),
  useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
}));
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));
jest.mock("../../components/PatientSelector", () => ({
  __esModule: true,
  default: function MockPatientSelector({
    settings,
  }: {
    settings: { currentPatientId?: string };
  }) {
    return (
      <div data-testid="patient-selector">
        {settings.currentPatientId || "no-patient"}
      </div>
    );
  },
}));
jest.mock("@/app/actions", () => ({
  addPatientOwner: jest.fn(),
  createPatient: jest.fn(),
  deleteAllSeizures: jest.fn(),
  getPatientOwnerEmails: jest.fn(),
  getPatients: jest.fn(),
  getSettings: jest.fn(),
  listMedicationChanges: jest.fn(),
  listSeizures: jest.fn(),
  removePatientOwner: jest.fn(),
  updatePatientQuickButtons: jest.fn(),
  updateSettings: jest.fn(),
  uploadSeizuresFromCSV: jest.fn(),
}));
jest.mock("@/lib/utils/clipboard", () => ({
  copyText: jest.fn(),
}));

import {
  createPatient,
  deleteAllSeizures,
  updatePatientQuickButtons,
  uploadSeizuresFromCSV,
} from "@/app/actions";
import { copyText } from "@/lib/utils/clipboard";
import { useQuery } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ClientSettings from "../ClientSettings";

const mockUseQuery = useQuery as jest.Mock;
const mockOpen = jest.fn();
const mockCopyText = copyText as jest.Mock;

function buildSettings(currentPatientId?: string) {
  return { id: "user_1", currentPatientId, updatedAt: 1 };
}

function buildPatient(id: string, name: string) {
  return {
    id,
    name,
    ownerId: "owner@example.com",
    allowedUserIds: [],
    createdAt: 1,
  };
}

function setupQuery(settings?: unknown, patients?: unknown, owners?: unknown) {
  mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
    const key = options.queryKey;
    if (key[0] === "settings") {
      return { data: settings, isLoading: false, isError: false, error: null };
    }
    if (key[0] === "patients") {
      return {
        data: patients || [],
        refetch: jest.fn(() => Promise.resolve({ data: patients || [] })),
      };
    }
    if (key[0] === "patientOwners") {
      return {
        data: owners || { owners: [] },
        isLoading: false,
        isError: false,
        error: null,
      };
    }
    return { data: undefined, isLoading: false, isError: false, error: null };
  });
}

describe("ClientSettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    window.open = mockOpen;
  });

  test("shows loading state", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
    });

    render(<ClientSettings />);
    expect(screen.getByText("Loading settings...")).toBeInTheDocument();
  });

  test("shows error state", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("boom"),
    });

    render(<ClientSettings />);
    expect(screen.getByText(/Error loading settings/)).toHaveTextContent(
      "boom",
    );
  });

  test("renders patient selector and new patient form", () => {
    setupQuery(buildSettings());

    render(<ClientSettings />);
    expect(screen.getByTestId("patient-selector")).toHaveTextContent(
      "no-patient",
    );
    expect(
      screen.getByRole("button", { name: "New Patient" }),
    ).toBeInTheDocument();
  });

  test("shows a link to the history and medication page for the current patient", () => {
    setupQuery(buildSettings("pat1"), [buildPatient("pat1", "Alex")]);

    render(<ClientSettings />);
    const link = screen.getByRole("link", {
      name: "Open history and medication page",
    });
    expect(link).toHaveAttribute("href", "/p/pat1/graphs");
  });

  test("shows a message instead of the public link when no patient is selected", () => {
    setupQuery(buildSettings());

    render(<ClientSettings />);
    expect(
      screen.getByText("Select a patient to see the public link."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Open public page" }),
    ).not.toBeInTheDocument();
  });

  test("shows the public patient link for the current patient", async () => {
    setupQuery(buildSettings("pat1"), [buildPatient("pat1", "Alex")]);

    render(<ClientSettings />);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Open public page" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Copy public link" }),
      ).toBeInTheDocument();
    });
  });

  test("copies the public patient link to the clipboard", async () => {
    const user = userEvent.setup();
    setupQuery(buildSettings("pat1"), [buildPatient("pat1", "Alex")]);
    mockCopyText.mockResolvedValue(undefined);

    render(<ClientSettings />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Open public page" }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Copy public link" }));

    await waitFor(() => {
      expect(mockCopyText).toHaveBeenCalledWith("http://localhost/p/pat1");
    });
  });

  test("opens the public patient page in a new tab", async () => {
    const user = userEvent.setup();
    setupQuery(buildSettings("pat1"), [buildPatient("pat1", "Alex")]);

    render(<ClientSettings />);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Open public page" }),
      ).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Open public page" }));

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalledWith(
        "http://localhost/p/pat1",
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  test("creates a new patient", async () => {
    const user = userEvent.setup();
    setupQuery(buildSettings());
    (createPatient as jest.Mock).mockResolvedValue({
      success: true,
      patient: buildPatient("pat1", "Alex"),
    });

    render(<ClientSettings />);
    await user.click(screen.getByRole("button", { name: "New Patient" }));
    await user.type(screen.getByLabelText("Patient name"), "Alex");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(createPatient).toHaveBeenCalledWith("Alex");
    });
  });

  test("deletes all seizures for the current patient", async () => {
    const user = userEvent.setup();
    setupQuery(buildSettings("pat1"), [buildPatient("pat1", "Alex")]);
    (deleteAllSeizures as jest.Mock).mockResolvedValue({
      success: true,
      count: 5,
    });

    render(<ClientSettings />);
    await user.click(
      screen.getByRole("button", { name: "Delete All Records" }),
    );

    await waitFor(() => {
      expect(deleteAllSeizures).toHaveBeenCalledWith("pat1");
    });
  });

  test("uploads a CSV file for the current patient", async () => {
    const user = userEvent.setup();
    setupQuery(buildSettings("pat1"), [buildPatient("pat1", "Alex")]);
    (uploadSeizuresFromCSV as jest.Mock).mockResolvedValue({
      success: true,
      totalRows: 2,
      successCount: 2,
      failedRows: [],
    });

    render(<ClientSettings />);
    const csvText = "Time,Duration,Notes\n2024-02-10T08:00:00-08:00,5,Note";
    const file = new File([csvText], "seizures.csv", {
      type: "text/csv",
    }) as File & { text: jest.Mock };
    file.text = jest.fn().mockResolvedValue(csvText);
    const input = screen.getByLabelText("Upload CSV");
    await user.upload(input, file);

    await waitFor(() => {
      expect(uploadSeizuresFromCSV).toHaveBeenCalledWith("pat1", csvText);
    });
  });

  test("shows owner management when a patient is selected", () => {
    setupQuery(buildSettings("pat1"), [buildPatient("pat1", "Alex")]);

    render(<ClientSettings />);
    expect(screen.getByText("Patient Owners")).toBeInTheDocument();
  });

  test("shows quick button settings when a patient is selected", () => {
    setupQuery(buildSettings("pat1"), [
      { ...buildPatient("pat1", "Alex"), quickButtonSeconds: [3, 7, 12] },
    ]);

    render(<ClientSettings />);
    expect(screen.getByText("Quick seizure buttons")).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", {
        name: "Quick button 1 duration in seconds",
      }),
    ).toHaveValue(3);
  });

  test("saves updated quick button durations", async () => {
    const user = userEvent.setup();
    (updatePatientQuickButtons as jest.Mock).mockResolvedValue({
      success: true,
    });

    setupQuery(buildSettings("pat1"), [
      { ...buildPatient("pat1", "Alex"), quickButtonSeconds: [5, 10, 15] },
    ]);

    render(<ClientSettings />);
    const input = screen.getByRole("spinbutton", {
      name: "Quick button 2 duration in seconds",
    });
    await user.clear(input);
    await user.type(input, "20");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updatePatientQuickButtons).toHaveBeenCalledWith(
        "pat1",
        [5, 20, 15],
      );
    });
  });
});

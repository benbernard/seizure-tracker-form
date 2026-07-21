jest.mock("../../actions", () => ({
  getPatients: jest.fn(),
  updateCurrentPatient: jest.fn(),
}));

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: mockPush })),
}));

jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import { useQueryClient } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { getPatients, updateCurrentPatient } from "../../actions";
import PatientSelector from "../PatientSelector";

describe("PatientSelector", () => {
  test("loads and displays patients", async () => {
    (getPatients as jest.Mock).mockResolvedValue([
      {
        id: "pat1",
        name: "Alex",
        ownerId: "owner@example.com",
        allowedUserIds: [],
        createdAt: 1,
      },
      {
        id: "pat2",
        name: "Sam",
        ownerId: "owner@example.com",
        allowedUserIds: [],
        createdAt: 2,
      },
    ]);

    render(
      <PatientSelector
        settings={{ id: "u1", currentPatientId: "pat1", updatedAt: 1 }}
      />,
    );

    expect(screen.getByText("Loading patients...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    expect(screen.getByRole("combobox")).toHaveValue("pat1");
    expect(screen.getByText("Alex")).toBeInTheDocument();
    expect(screen.getByText("Sam")).toBeInTheDocument();
  });

  test("updates current patient on selection", async () => {
    const user = userEvent.setup();
    (getPatients as jest.Mock).mockResolvedValue([
      {
        id: "pat1",
        name: "Alex",
        ownerId: "owner@example.com",
        allowedUserIds: [],
        createdAt: 1,
      },
      {
        id: "pat2",
        name: "Sam",
        ownerId: "owner@example.com",
        allowedUserIds: [],
        createdAt: 2,
      },
    ]);
    (updateCurrentPatient as jest.Mock).mockResolvedValue(undefined);

    render(
      <PatientSelector
        settings={{ id: "u1", currentPatientId: "pat1", updatedAt: 1 }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByRole("combobox"), "pat2");

    await waitFor(() => {
      expect(updateCurrentPatient).toHaveBeenCalledWith("pat2");
      expect(mockPush).toHaveBeenCalledWith("/p/pat2/settings");
    });
  });

  test("shows empty state when no patients", async () => {
    (getPatients as jest.Mock).mockResolvedValue([]);

    render(
      <PatientSelector
        settings={{ id: "u1", currentPatientId: undefined, updatedAt: 1 }}
      />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("No patients yet. Create one to get started."),
      ).toBeInTheDocument();
    });
  });
});

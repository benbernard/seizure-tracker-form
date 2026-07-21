jest.mock("../../actions", () => ({
  addPatientOwner: jest.fn(),
  getPatientOwnerEmails: jest.fn(),
  removePatientOwner: jest.fn(),
}));

jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import {
  addPatientOwner,
  getPatientOwnerEmails,
  removePatientOwner,
} from "../../actions";
import { PatientOwnerManagement } from "../ClientSettings";

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderWithQuery(ui: ReactNode) {
  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

describe("PatientOwnerManagement", () => {
  const patients = [
    {
      id: "pat1",
      name: "Alex",
      ownerId: "u1",
      allowedUserIds: [],
      createdAt: 1,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("loads and displays owners", async () => {
    (getPatientOwnerEmails as jest.Mock).mockResolvedValue({
      owners: [
        {
          userId: "u1",
          email: "owner@example.com",
          isCurrentUser: true,
          isOwner: true,
        },
      ],
    });

    renderWithQuery(
      <PatientOwnerManagement
        patientId="pat1"
        patients={patients}
        onUpdate={jest.fn()}
      />,
    );

    expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  test("adds a new owner by email", async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    (getPatientOwnerEmails as jest.Mock).mockResolvedValue({
      owners: [
        {
          userId: "u1",
          email: "owner@example.com",
          isCurrentUser: true,
          isOwner: true,
        },
      ],
    });
    (addPatientOwner as jest.Mock).mockResolvedValue({ success: true });

    renderWithQuery(
      <PatientOwnerManagement
        patientId="pat1"
        patients={patients}
        onUpdate={onUpdate}
      />,
    );

    await waitFor(() => {
      expect(getPatientOwnerEmails).toHaveBeenCalledWith("pat1");
    });

    await user.type(
      screen.getByPlaceholderText("Email address to add"),
      "friend@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Add Owner" }));

    await waitFor(() => {
      expect(addPatientOwner).toHaveBeenCalledWith(
        "pat1",
        "friend@example.com",
      );
    });
    expect(onUpdate).toHaveBeenCalled();
  });

  test("shows existing additional owners and removes one", async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    (getPatientOwnerEmails as jest.Mock).mockResolvedValue({
      owners: [
        {
          userId: "u1",
          email: "owner@example.com",
          isCurrentUser: true,
          isOwner: true,
        },
        {
          userId: "u2",
          email: "friend@example.com",
          isCurrentUser: false,
          isOwner: false,
        },
      ],
    });
    (removePatientOwner as jest.Mock).mockResolvedValue({ success: true });

    renderWithQuery(
      <PatientOwnerManagement
        patientId="pat1"
        patients={patients}
        onUpdate={onUpdate}
      />,
    );

    expect(await screen.findByText("friend@example.com")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(removePatientOwner).toHaveBeenCalledWith("pat1", "u2");
    });
    expect(onUpdate).toHaveBeenCalled();
  });

  test("displays empty state when there are no additional owners", async () => {
    (getPatientOwnerEmails as jest.Mock).mockResolvedValue({
      owners: [
        {
          userId: "u1",
          email: "owner@example.com",
          isCurrentUser: true,
          isOwner: true,
        },
      ],
    });

    renderWithQuery(
      <PatientOwnerManagement
        patientId="pat1"
        patients={patients}
        onUpdate={jest.fn()}
      />,
    );

    expect(await screen.findByText("owner@example.com")).toBeInTheDocument();
    expect(screen.getByText("No additional owners.")).toBeInTheDocument();
  });
});

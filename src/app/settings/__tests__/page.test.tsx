jest.mock("@/lib/clerk-client", () => ({
  useAuth: jest.fn(),
  SignOutButton: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
}));
jest.mock("../ClientSettings", () => ({
  __esModule: true,
  default: function MockClientSettings() {
    return <div data-testid="client-settings">ClientSettings</div>;
  },
}));

import { useAuth } from "@/lib/clerk-client";
import { render, screen } from "@testing-library/react";
import { useRouter } from "next/navigation";
import SettingsPage from "../page";

const mockUseAuth = useAuth as jest.Mock;
const mockUseRouter = useRouter as jest.Mock;

describe("Settings page", () => {
  test("shows loading while auth state is loading", () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: false });

    render(<SettingsPage />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("redirects to sign-in when user is not signed in", () => {
    const push = jest.fn();
    mockUseRouter.mockReturnValue({ push });
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });

    render(<SettingsPage />);
    expect(push).toHaveBeenCalledWith("/sign-in?redirect_url=/settings");
  });

  test("renders client settings when signed in", () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });

    render(<SettingsPage />);
    expect(screen.getByTestId("client-settings")).toBeInTheDocument();
  });
});

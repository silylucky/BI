import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProfileEditDialog } from "./ProfileEditDialog";

const mockApiFetch = vi.fn();
const mockRefresh = vi.fn();

vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ refresh: mockRefresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));

const profile = {
  id: "u1",
  username: "admin",
  displayName: "Admin",
  email: "admin@vitalspan.local",
  roles: ["admin"],
};

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{ui}</QueryClientProvider>;
}

describe("ProfileEditDialog", () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({
      ...profile,
      displayName: "Admin Updated",
      email: "updated@vitalspan.local",
    });
    mockRefresh.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it("patches /me and closes on save", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      wrap(
        <ProfileEditDialog open profile={profile} onOpenChange={onOpenChange} focus="email" />,
      ),
    );

    const emailInput = screen.getByLabelText("电子邮箱");

    await user.clear(emailInput);
    await user.type(emailInput, "updated@vitalspan.local");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/me",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            displayName: "Admin",
            email: "updated@vitalspan.local",
          }),
        }),
      );
    });
    await waitFor(() => expect(mockRefresh).toHaveBeenCalled());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequireCapabilityName } from "@/components/auth/require-capability";
import { WORKSPACE_HOME_PATH } from "@/lib/workspace";

const mockUseAuth = vi.fn();

vi.mock("@/context/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderGuard(role: string) {
  mockUseAuth.mockReturnValue({
    user: { id: "1", username: role, roles: [role] },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  });

  return render(
    <MemoryRouter initialEntries={["/protected"]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <RequireCapabilityName capability="governance:*">
              <div>治理页</div>
            </RequireCapabilityName>
          }
        />
        <Route path={WORKSPACE_HOME_PATH} element={<div>工作台</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireCapabilityName", () => {
  afterEach(() => {
    cleanup();
    mockUseAuth.mockReset();
  });

  it("allows admin with governance capability", () => {
    renderGuard("admin");
    expect(screen.getByText("治理页")).toBeInTheDocument();
  });

  it("redirects analyst without governance capability", () => {
    renderGuard("analyst");
    expect(screen.queryByText("治理页")).not.toBeInTheDocument();
    expect(screen.getByText("工作台")).toBeInTheDocument();
  });
});

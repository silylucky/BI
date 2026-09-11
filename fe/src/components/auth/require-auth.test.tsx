import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RequireAuth } from "@/components/auth/require-auth";

const mockUseAuth = vi.fn();
const mockGetAuthToken = vi.fn<string | null, []>(() => "session-token");

vi.mock("@/context/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/lib/auth-token", () => ({
  getAuthToken: () => mockGetAuthToken(),
  clearAuthToken: vi.fn(),
  setAuthToken: vi.fn(),
}));

function renderRequireAuth(initialPath = "/admin") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<div>登录页</div>} />
        <Route path="/admin" element={<RequireAuth />}>
          <Route index element={<div>管理后台</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockGetAuthToken.mockReturnValue("session-token");
  });

  it("redirects to login when no token", () => {
    mockGetAuthToken.mockReturnValue(null);
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    renderRequireAuth();
    expect(screen.getByText("登录页")).toBeInTheDocument();
  });

  it("renders outlet while /me is still loading if local token exists", () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: true,
    });

    renderRequireAuth();
    expect(screen.getByText("管理后台")).toBeInTheDocument();
  });

  it("redirects when session invalidated", () => {
    mockGetAuthToken.mockReturnValue(null);
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
    });

    renderRequireAuth();
    expect(screen.getByText("登录页")).toBeInTheDocument();
  });
});

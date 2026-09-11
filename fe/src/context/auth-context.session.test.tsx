import { useEffect } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/context/auth-context";
import { getAuthToken, setAuthToken } from "@/lib/auth-token";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: vi.fn(),
    registerUnauthorizedHandler: vi.fn(() => () => {}),
  };
});

function Probe() {
  const { isAuthenticated, user, isLoading } = useAuth();
  return (
    <div>
      <span data-testid="auth-loading">{String(isLoading)}</span>
      <span data-testid="auth-authenticated">{String(isAuthenticated)}</span>
      <span data-testid="auth-user">{user?.username ?? ""}</span>
    </div>
  );
}

function RefreshOnMount() {
  const { refresh } = useAuth();
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return <Probe />;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("AuthProvider session resilience", () => {
  it("keeps token when /me fails with request timeout", async () => {
    setAuthToken("session-token");
    const { apiFetch } = await import("@/lib/api");
    vi.mocked(apiFetch).mockRejectedValue(
      new (await import("@/lib/api")).ApiRequestError("timeout", "REQUEST_TIMEOUT"),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <RefreshOnMount />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-loading")).toHaveTextContent("false");
    });
    expect(getAuthToken()).toBe("session-token");
    expect(screen.getByTestId("auth-authenticated")).toHaveTextContent("true");
    expect(screen.getByTestId("auth-user")).toHaveTextContent("");
  });

  it("clears token when /me returns UNAUTHORIZED", async () => {
    setAuthToken("stale-token");
    const { apiFetch } = await import("@/lib/api");
    vi.mocked(apiFetch).mockRejectedValue(
      new (await import("@/lib/api")).ApiRequestError("登录已过期，请重新登录", "UNAUTHORIZED"),
    );

    render(
      <MemoryRouter>
        <AuthProvider>
          <RefreshOnMount />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-loading")).toHaveTextContent("false");
    });
    expect(getAuthToken()).toBeNull();
    expect(screen.getByTestId("auth-authenticated")).toHaveTextContent("false");
  });
});

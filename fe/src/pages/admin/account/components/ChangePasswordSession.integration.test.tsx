import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "@/context/auth-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { clearAuthToken, setAuthToken } from "@/lib/auth-token";
import { resetUnauthorizedHandler } from "@/lib/api";
import { ChangePasswordSection } from "./ChangePasswordSection";
import { getPasswordInput } from "./changePasswordTestUtils";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("ChangePasswordSession integration", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    resetUnauthorizedHandler();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    setAuthToken("session-token");
  });

  afterEach(() => {
    cleanup();
    resetUnauthorizedHandler();
    clearAuthToken();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("preserves session on business 401 for wrong current password", async () => {
    const user = userEvent.setup();
    const logoutSpy = vi.fn();
    const { registerUnauthorizedHandler } = await import("@/lib/api");
    registerUnauthorizedHandler(logoutSpy);

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/v1/me")) {
        return jsonResponse({
          id: "user-1",
          username: "admin",
          displayName: "Admin",
          email: "admin@example.com",
          roles: ["admin"],
        });
      }
      if (url.endsWith("/api/v1/auth/change-password") && init?.method === "POST") {
        return jsonResponse(
          { code: "AUTH_INVALID_CURRENT_PASSWORD", message: "当前密码不正确", detail: null },
          401,
        );
      }
      return jsonResponse({ code: "NOT_FOUND", message: "Not found", detail: null }, 404);
    });

    render(
      <TooltipProvider delayDuration={0}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={["/admin/account/security"]}>
            <AuthProvider>
              <Routes>
                <Route path="/admin/account/security" element={<ChangePasswordSection />} />
                <Route path="/login" element={<div>login-page</div>} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </TooltipProvider>,
    );

    await waitFor(() => expect(getPasswordInput("currentPassword")).toBeInTheDocument());

    await user.type(getPasswordInput("currentPassword"), "wrongpass1");
    await user.type(getPasswordInput("newPassword"), "newpass123");
    await user.type(getPasswordInput("confirmPassword"), "newpass123");
    await user.click(screen.getByRole("button", { name: "更新密码" }));

    await waitFor(() =>
      expect(screen.getByText("当前密码不正确")).toBeInTheDocument(),
    );
    expect(localStorage.getItem("vitalspan:access_token")).toBe("session-token");
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(screen.queryByText("login-page")).not.toBeInTheDocument();
  });

  it("logs out and navigates to login after a successful password change", async () => {
    const user = userEvent.setup();

    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/api/v1/me")) {
        return jsonResponse({
          id: "user-1",
          username: "admin",
          displayName: "Admin",
          email: "admin@example.com",
          roles: ["admin"],
        });
      }
      if (url.endsWith("/api/v1/auth/change-password") && init?.method === "POST") {
        return new Response(null, { status: 204 });
      }
      return jsonResponse({ code: "NOT_FOUND", message: "Not found", detail: null }, 404);
    });

    render(
      <TooltipProvider delayDuration={0}>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter initialEntries={["/admin/account/security"]}>
            <AuthProvider>
              <Routes>
                <Route path="/admin/account/security" element={<ChangePasswordSection />} />
                <Route path="/login" element={<div>login-page</div>} />
              </Routes>
            </AuthProvider>
          </MemoryRouter>
        </QueryClientProvider>
      </TooltipProvider>,
    );

    await waitFor(() => expect(getPasswordInput("currentPassword")).toBeInTheDocument());

    await user.type(getPasswordInput("currentPassword"), "oldpass123");
    await user.type(getPasswordInput("newPassword"), "newpass123");
    await user.type(getPasswordInput("confirmPassword"), "newpass123");
    await user.click(screen.getByRole("button", { name: "更新密码" }));

    await waitFor(() => expect(screen.getByText("login-page")).toBeInTheDocument());
    expect(localStorage.getItem("vitalspan:access_token")).toBeNull();
  });
});

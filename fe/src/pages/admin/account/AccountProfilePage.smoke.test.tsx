import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AccountProfilePage } from "./AccountProfilePage";

const mockApiFetch = vi.fn();
const mockRefresh = vi.fn();

vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({ refresh: mockRefresh }),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <TooltipProvider delayDuration={0}>
      <QueryClientProvider client={qc}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>
    </TooltipProvider>
  );
}

describe("AccountProfilePage smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({
      id: "u1",
      username: "admin",
      displayName: "Admin",
      email: "admin@vitalspan.local",
      roles: ["admin"],
    });
  });
  afterEach(() => cleanup());

  it("renders profile hub from /me", async () => {
    render(wrap(<AccountProfilePage />));
    expect(await screen.findByText("用户资料")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("账户信息")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "修改电子邮箱" })).toBeInTheDocument();
    expect(screen.getAllByText("admin@vitalspan.local").length).toBeGreaterThan(0);
    expect(screen.getByText("登录账号", { selector: "dt" })).toBeInTheDocument();
    expect(screen.getAllByText("会话状态", { selector: "dt" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("已登录").length).toBeGreaterThan(0);
  });
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", username: "admin", roles: ["admin"] },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { TooltipProvider } from "@/components/ui/tooltip";
import { AuditLogPage } from "./AuditLogPage";

function renderAuditPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter>
          <AuditLogPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("AuditLogPage smoke", () => {
  afterEach(() => {
    cleanup();
    mockApiFetch.mockReset();
    vi.useRealTimers();
  });

  it("exposes date range filters", async () => {
    mockApiFetch.mockResolvedValue({ items: [], total: 0 });
    renderAuditPage();
    expect(await screen.findByLabelText("筛选起始日期")).toBeInTheDocument();
    expect(screen.getByLabelText("筛选结束日期")).toBeInTheDocument();
  });

  it("action filter debounces into audit events query", async () => {
    mockApiFetch.mockResolvedValue({ items: [], total: 0 });
    const user = userEvent.setup();
    renderAuditPage();
    await user.click(await screen.findByLabelText("筛选操作类型"));
    await user.click(await screen.findByRole("option", { name: "删除用户" }));
    await waitFor(
      () => {
        expect(
          mockApiFetch.mock.calls.some((c) => String(c[0]).includes("action=user.delete")),
        ).toBe(true);
      },
      { timeout: 2000 },
    );
  });

  it("renders readable audit rows", async () => {
    mockApiFetch.mockResolvedValue({
      items: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          actor_id: "00000000-0000-0000-0000-000000000002",
          actor_username: "admin",
          target_type: "user",
          target_id: "bae594c4-0000-4000-8000-000000000010",
          action: "user.roles.replace",
          detail: JSON.stringify({ role_ids: ["a87b9b99-c2ca-42f4-a82d-fb1b21f6968c"] }),
          trace_id: "trace-123",
          created_at: "2026-07-09T05:06:01.000Z",
        },
      ],
      total: 1,
    });

    renderAuditPage();
    expect(await screen.findByText("替换用户角色")).toBeInTheDocument();
    expect(screen.getByText("角色：1 个角色")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  it("shows pagination when total exceeds page size", async () => {
    mockApiFetch.mockResolvedValue({
      items: Array.from({ length: 20 }, (_, i) => ({
        id: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
        actor_id: "00000000-0000-0000-0000-000000000002",
        actor_username: "admin",
        target_type: "user",
        target_id: "bae594c4-0000-4000-8000-000000000010",
        action: "user.roles.replace",
        detail: "{}",
        trace_id: `trace-${i}`,
        created_at: "2026-07-09T05:06:01.000Z",
      })),
      total: 45,
    });

    renderAuditPage();
    await screen.findByRole("button", { name: "下一页" });
    expect(screen.getByLabelText("每页条数")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一页" })).toBeEnabled();
  });

  it("opens detail sheet", async () => {
    mockApiFetch.mockResolvedValue({
      items: [
        {
          id: "00000000-0000-0000-0000-000000000001",
          actor_id: "00000000-0000-0000-0000-000000000002",
          actor_username: "admin",
          target_type: "user",
          target_id: "bae594c4-0000-4000-8000-000000000010",
          action: "user.roles.replace",
          detail: JSON.stringify({ role_ids: ["a87b9b99-c2ca-42f4-a82d-fb1b21f6968c"] }),
          trace_id: "trace-123",
          created_at: "2026-07-09T05:06:01.000Z",
        },
      ],
      total: 1,
    });

    const user = userEvent.setup();
    renderAuditPage();
    await user.click(await screen.findByRole("button", { name: "查看详情" }));
    expect(await screen.findByText("审计事件详情")).toBeInTheDocument();
    expect(screen.getByText("trace-123")).toBeInTheDocument();
  });
});

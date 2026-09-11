import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReportSchedulesPage } from "./ReportSchedulesPage";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", username: "admin", roles: ["admin"], isRoot: true },
    isLoading: false,
    isAuthenticated: true,
    logout: vi.fn(),
    refresh: vi.fn(async () => {}),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter>
          <ReportSchedulesPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("ReportSchedulesPage smoke", () => {
  const scheduleId = "sched-1";
  const nodeId = "node-1";

  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("/schedules/delivery-health")) {
        return { status: "reachable", host: "localhost", port: 1025, error: null };
      }
      if (path.includes("/schedules/export-health")) {
        return { status: "available", error: null };
      }
      if (path.includes("/executions/recent-failures")) {
        return { items: [], total: 0 };
      }
      if (path.match(/\/schedules\/[^/]+\/executions$/) || path.includes("/retry")) {
        if (path.includes("/retry") && init?.method === "POST") {
          return { executionId: "ex-2", status: "pending" };
        }
        return {
          items: [
            {
              executionId: "ex-1",
              scheduleId,
              status: "semi_real_failed",
              artifactRef: "semi://x",
              executedAt: "2026-07-07T00:00:00Z",
              errorMessage: "邮件投递不可用",
            },
          ],
          total: 1,
        };
      }
      if (path.startsWith("/api/v1/reports/schedules")) {
        if (init?.method === "DELETE") return;
        return {
          items: [
            {
              id: scheduleId,
              catalogNodeId: nodeId,
              sourceType: "dashboard",
              sourceId: "d1",
              sourceLabel: "销售月报",
              cron: "0 8 * * *",
              timezone: "Asia/Shanghai",
              status: "scheduled",
              allowedActions: ["pause"],
              recipients: [{ type: "role", value: "admin" }],
              attachmentFormats: ["pdf"],
            },
          ],
          total: 1,
        };
      }
      if (path.startsWith("/api/v1/reports/catalog/nodes")) {
        return [
          {
            id: nodeId,
            name: "销售月报",
            parentId: null,
            nodeType: "template",
            templateKind: "pdf",
            templateKey: "sales",
            sortOrder: 0,
          },
        ];
      }
      return {};
    });
  });
  afterEach(() => cleanup());

  it("lists schedules with template name and frequency label", async () => {
    renderPage();
    expect(await screen.findByText("销售月报")).toBeInTheDocument();
    expect(screen.getByText("每天 08:00")).toBeInTheDocument();
    expect(screen.getAllByText("看板").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/角色:管理员/)).toBeInTheDocument();
  });

  it("shows create entry links prioritizing dashboard", async () => {
    renderPage();
    expect(await screen.findByRole("link", { name: /从看板\/大屏创建/ })).toHaveAttribute(
      "href",
      "/admin/dashboards?intent=schedule",
    );
    expect(screen.getByRole("link", { name: /从文档模板创建/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "看板/大屏" })).toBeInTheDocument();
  });

  it("honors tab=all query param", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter initialEntries={["/admin/reports/schedules?tab=all"]}>
            <ReportSchedulesPage />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await screen.findByText("销售月报");
    expect(screen.getByRole("button", { name: "全部" })).toHaveAttribute("aria-pressed", "true");
  });

  it("expands history and shows retry", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("销售月报");
    await user.click(screen.getByRole("button", { name: "销售月报" }));
    expect(await screen.findByText("邮件投递不可用", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("查看调度 from failures panel switches tab and expands row", async () => {
    const templateScheduleId = "sched-tpl";
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("/schedules/delivery-health")) {
        return { status: "reachable", host: "localhost", port: 1025, error: null };
      }
      if (path.includes("/schedules/export-health")) {
        return { status: "available", error: null };
      }
      if (path.includes("/executions/recent-failures")) {
        return {
          items: [
            {
              executionId: "ex-fail",
              scheduleId: templateScheduleId,
              status: "semi_real_failed",
              artifactRef: "semi://x",
              executedAt: "2026-07-07T00:00:00Z",
              errorMessage: "SMTP failed",
            },
          ],
          total: 1,
        };
      }
      if (path.match(/\/schedules\/[^/]+\/executions$/)) {
        return { items: [], total: 0 };
      }
      if (path.startsWith("/api/v1/reports/schedules")) {
        return {
          items: [
            {
              id: scheduleId,
              catalogNodeId: nodeId,
              sourceType: "dashboard",
              sourceId: "d1",
              sourceLabel: "销售月报",
              cron: "0 8 * * *",
              timezone: "Asia/Shanghai",
              status: "scheduled",
              allowedActions: ["pause"],
              recipients: [{ type: "role", value: "admin" }],
              attachmentFormats: ["pdf"],
            },
            {
              id: templateScheduleId,
              catalogNodeId: nodeId,
              sourceType: "template",
              sourceLabel: "模板月报",
              cron: "0 9 * * 1",
              timezone: "Asia/Shanghai",
              status: "scheduled",
              allowedActions: ["pause"],
              recipients: [{ type: "role", value: "admin" }],
              attachmentFormats: ["pdf"],
            },
          ],
          total: 2,
        };
      }
      if (path.startsWith("/api/v1/reports/catalog/nodes")) {
        return [
          {
            id: nodeId,
            name: "销售月报",
            parentId: null,
            nodeType: "template",
            templateKind: "pdf",
            templateKey: "sales",
            sortOrder: 0,
          },
        ];
      }
      return {};
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/近期失败/);
    await user.click(screen.getByTestId("schedule-recent-failures-toggle"));
    await user.click(screen.getByRole("button", { name: "查看调度" }));
    expect(await screen.findByText("模板月报")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "文档模板" })).toHaveAttribute("aria-pressed", "true");
  });

  it("dismiss removes failure row from recent failures panel", async () => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("/schedules/delivery-health")) {
        return { status: "reachable", host: "localhost", port: 1025, error: null };
      }
      if (path.includes("/schedules/export-health")) {
        return { status: "available", error: null };
      }
      if (path.includes("/executions/recent-failures/dismiss-all")) {
        return undefined;
      }
      if (path.includes("/executions/ex-fail/dismiss") && init?.method === "POST") {
        return undefined;
      }
      if (path.includes("/executions/recent-failures")) {
        return {
          items: [
            {
              executionId: "ex-fail",
              scheduleId,
              status: "semi_real_failed",
              artifactRef: "semi://x",
              executedAt: "2026-07-07T00:00:00Z",
              errorMessage: "SMTP failed",
            },
          ],
          total: 1,
        };
      }
      if (path.startsWith("/api/v1/reports/schedules")) {
        return {
          items: [
            {
              id: scheduleId,
              catalogNodeId: nodeId,
              sourceType: "dashboard",
              sourceId: "d1",
              sourceLabel: "销售月报",
              cron: "0 8 * * *",
              timezone: "Asia/Shanghai",
              status: "scheduled",
              allowedActions: ["pause"],
              recipients: [{ type: "role", value: "admin" }],
              attachmentFormats: ["pdf"],
            },
          ],
          total: 1,
        };
      }
      if (path.startsWith("/api/v1/reports/catalog/nodes")) {
        return [
          {
            id: nodeId,
            name: "销售月报",
            parentId: null,
            nodeType: "template",
            templateKind: "pdf",
            templateKey: "sales",
            sortOrder: 0,
          },
        ];
      }
      return {};
    });

    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/近期失败/);
    await user.click(screen.getByTestId("schedule-recent-failures-toggle"));
    expect(screen.getByRole("button", { name: "忽略" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "全部忽略" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "忽略" }));
    expect(mockApiFetch).toHaveBeenCalledWith(
      "/api/v1/reports/schedules/executions/ex-fail/dismiss",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("deletes a schedule from the list", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("销售月报");
    await user.click(screen.getByRole("button", { name: "调度操作" }));
    await user.click(screen.getByRole("menuitem", { name: "删除" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("删除这条定时报告？")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "删除" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        `/api/v1/reports/schedules/${scheduleId}`,
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });
});

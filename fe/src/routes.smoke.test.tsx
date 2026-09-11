import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const mockUseAuth = vi.fn(() => ({
  user: { id: "1", username: "admin", roles: ["admin"] as const },
  isLoading: false,
  isAuthenticated: true,
  logout: vi.fn(),
  refresh: vi.fn(async () => {}),
}));

vi.mock("@/context/auth-context", () => ({
  useAuth: () => mockUseAuth(),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/lib/auth-token", () => ({
  getAuthToken: () => "test-jwt-token",
  setAuthToken: vi.fn(),
  clearAuthToken: vi.fn(),
}));

const mockApiFetch = vi.fn();
const mockResolveDefaultDashboardPath = vi.fn(async (_roleCodes: string[]) => "/admin/dashboards");

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

vi.mock("@/lib/defaultViewResolve", () => ({
  resolveDefaultDashboardPath: (roleCodes: string[]) =>
    mockResolveDefaultDashboardPath(roleCodes),
  resolveDefaultLandingPath: (roleCodes: string[]) =>
    mockResolveDefaultDashboardPath(roleCodes),
}));

import { AppRoutes } from "./routes";

function setDesktopViewport() {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: 1400,
  });
  window.dispatchEvent(new Event("resize"));
}

function setMobileViewport(width = 375) {
  Object.defineProperty(window, "innerWidth", {
    writable: true,
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
}

function renderRoutes(initialEntries: string[]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={initialEntries}>
          <AppRoutes />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("AppRoutes smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockResolveDefaultDashboardPath.mockReset();
    mockResolveDefaultDashboardPath.mockResolvedValue("/admin/dashboards");
    mockUseAuth.mockReturnValue({
      user: { id: "1", username: "admin", roles: ["admin"] },
      isLoading: false,
      isAuthenticated: true,
      logout: vi.fn(),
      refresh: vi.fn(async () => {}),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders nested sync-jobs route through AdminLayout (T-FE-11, T-FE-17)", async () => {
    setDesktopViewport();
    mockApiFetch.mockResolvedValueOnce({ items: [] });
    renderRoutes(["/admin/ingestion/sync-jobs"]);
    expect(screen.getAllByRole("navigation").length).toBeGreaterThanOrEqual(1);
    const main = screen.getAllByRole("main")[0];
    expect(
      within(main).getByRole("heading", { level: 1, name: "同步任务" }),
    ).toBeInTheDocument();
  });

  it("shows loading skeleton in nested sync-jobs route (T-FE-12)", async () => {
    setDesktopViewport();
    mockApiFetch.mockReturnValue(new Promise(() => {}));
    renderRoutes(["/admin/ingestion/sync-jobs"]);
    const main = screen.getAllByRole("main")[0];
    await waitFor(() => {
      const skeletons = main.querySelectorAll(
        '[class*="skeleton"], [data-slot="skeleton"], [class*="animate-pulse"]',
      );
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders AdminLayout at /admin with VitalSpan logo (T-FE-01)", () => {
    renderRoutes(["/admin"]);
    expect(screen.getAllByText("VitalSpan").length).toBeGreaterThanOrEqual(1);
  });

  it("renders main content area at /admin (T-FE-03)", () => {
    renderRoutes(["/admin"]);
    expect(screen.getAllByRole("main").length).toBeGreaterThanOrEqual(1);
  });

  it("redirects /admin home to default dashboards list (T-FE-04)", async () => {
    mockApiFetch.mockResolvedValueOnce({ items: [] });
    renderRoutes(["/admin"]);
    expect(await screen.findByRole("heading", { name: "数据看板" })).toBeInTheDocument();
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("surfaceKind=dashboard"),
    );
  });

  it("redirects unknown paths to admin shell (T-FE-05)", () => {
    renderRoutes(["/unknown-route-xyz"]);
    expect(screen.getAllByText("VitalSpan").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("main").length).toBeGreaterThanOrEqual(1);
  });

  it("renders datasource nav link pointing to /admin/datasources (T-FE-08)", async () => {
    setDesktopViewport();
    const user = userEvent.setup();
    renderRoutes(["/admin"]);

    await user.click(screen.getByRole("button", { name: /数据连接/ }));
    const link = screen.getByRole("link", { name: "连接管理" });
    expect(link).toHaveAttribute("href", "/admin/datasources");
  });

  it("shows 同步任务 nav link under 数据连接 (T-FE-19)", async () => {
    setDesktopViewport();
    const user = userEvent.setup();
    renderRoutes(["/admin"]);
    await user.click(screen.getByRole("button", { name: /数据连接/ }));
    const link = screen.getByRole("link", { name: "同步任务" });
    expect(link).toHaveAttribute("href", "/admin/ingestion/sync-jobs");
  });

  it("redirects /admin index to dashboards list (T-FE-09)", async () => {
    setDesktopViewport();
    mockApiFetch.mockResolvedValueOnce({ items: [] });
    renderRoutes(["/admin"]);
    const main = screen.getAllByRole("main")[0];
    expect(
      await within(main).findByRole("heading", { level: 1, name: "数据看板" }),
    ).toBeInTheDocument();
  });

  it("renders sync-jobs history nested route (T-FE-ING-01)", async () => {
    setDesktopViewport();
    mockApiFetch.mockResolvedValueOnce({ items: [] });
    renderRoutes(["/admin/ingestion/sync-jobs/job-1/history"]);
    const main = screen.getAllByRole("main")[0];
    expect(within(main).getByRole("heading", { level: 1, name: "运行历史" })).toBeInTheDocument();
  });

  it("renders sync-jobs etl-rules nested route (T-FE-ING-02)", async () => {
    setDesktopViewport();
    mockApiFetch.mockResolvedValueOnce({ rules: [] });
    renderRoutes(["/admin/ingestion/sync-jobs/job-1/etl-rules"]);
    const main = screen.getAllByRole("main")[0];
    await waitFor(() => {
      expect(within(main).getByRole("button", { name: /保存规则/ })).toBeInTheDocument();
    });
  });

  it("renders sync-jobs edit nested route (T-FE-ING-03)", async () => {
    setDesktopViewport();
    mockApiFetch.mockResolvedValueOnce({
      name: "demo",
      source: {
        type: "mysql",
        host: "127.0.0.1",
        port: 3307,
        database: "sample_db",
        username: "sample",
        password: "***",
        table: "dirty_orders",
      },
      target_table: "orders_clean",
      schedule_cron: null,
    });
    renderRoutes(["/admin/ingestion/sync-jobs/job-1/edit"]);
    const main = screen.getAllByRole("main")[0];
    await waitFor(() => {
      expect(within(main).getByRole("heading", { level: 1, name: "编辑同步任务" })).toBeInTheDocument();
    });
  });

  it("renders admin shell at mobile 375px (T-FE-23)", () => {
    setMobileViewport(375);
    renderRoutes(["/admin"]);
    expect(screen.getAllByText("VitalSpan").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("main").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByRole("button", { name: "打开菜单" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("admin shell tab smoke at /admin (T-FE-27)", async () => {
    setDesktopViewport();
    const user = userEvent.setup();
    renderRoutes(["/admin"]);
    const menuBtn = screen.getAllByRole("button", { name: "打开菜单" })[0];
    const themeBtn = screen.getAllByRole("button", { name: "切换深浅色主题" })[0];
    let focusable = false;
    for (let i = 0; i < 40; i++) {
      await user.tab();
      if (
        document.activeElement === menuBtn ||
        document.activeElement === themeBtn
      ) {
        focusable = true;
        break;
      }
    }
    expect(focusable).toBe(true);
  });

  it("keeps admin shell for unknown /admin/* path (T-FE-28)", async () => {
    setDesktopViewport();
    mockApiFetch.mockResolvedValue({ items: [] });
    renderRoutes(["/admin/nonexistent-secret"]);
    expect(screen.getAllByText("VitalSpan").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("main").length).toBeGreaterThanOrEqual(1);
    expect(await screen.findByRole("heading", { name: "数据看板" })).toBeInTheDocument();
  });

  it("nested unknown ingestion path stays inside AdminLayout (T-FE-29)", () => {
    setDesktopViewport();
    renderRoutes(["/admin/ingestion/unknown"]);
    expect(screen.getAllByText("VitalSpan").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole("main").length).toBeGreaterThanOrEqual(1);
  });

  it("renders dashboards list route (T-DASH-R28-002-04)", async () => {
    mockApiFetch.mockResolvedValueOnce({ items: [] });
    renderRoutes(["/admin/dashboards"]);
    expect(await screen.findByRole("heading", { name: "数据看板" })).toBeInTheDocument();
  });

  it("renders login page with submit button (M-FE-1)", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      logout: vi.fn(),
      refresh: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseAuth>);
    renderRoutes(["/login"]);
    expect(screen.getByRole("button", { name: /登录/ })).toBeInTheDocument();
  });

  it("redirects legacy /admin/connectors to datasources list", async () => {
    mockApiFetch.mockResolvedValue({ items: [] });
    renderRoutes(["/admin/connectors"]);
    expect(await screen.findByRole("heading", { name: "数据源" })).toBeInTheDocument();
  });

  it("T-RT-GRANTS-01: /admin/system/grants route renders 资源授权 heading", async () => {
    setDesktopViewport();
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path.startsWith("/api/v1/roles")) return { items: [], total: 0 };
      if (path.startsWith("/api/v1/resource-grants")) return { items: [] };
      return {};
    });
    renderRoutes(["/admin/system/grants"]);
    expect(
      await screen.findByRole("heading", { level: 1, name: "资源授权" }),
    ).toBeInTheDocument();
  });

  it("M1 nav links have valid non-empty hrefs (T-RT-DL-01)", async () => {
    setDesktopViewport();
    mockApiFetch.mockResolvedValue({ items: [] });
    renderRoutes(["/admin/datasources"]);

    const dataConn = await screen.findByRole("link", { name: "连接管理" });
    expect(dataConn.getAttribute("href")).toBe("/admin/datasources");

    const dashLinks = screen.getAllByRole("link", { name: "仪表板" });
    expect(dashLinks[0].getAttribute("href")).toBe("/admin/dashboards");

    const allNavLinks = screen
      .getByRole("navigation", { name: "管理端导航" })
      .querySelectorAll("a[href]");
    for (const link of Array.from(allNavLinks)) {
      const href = link.getAttribute("href");
      expect(href).not.toBe("#");
      expect(href).not.toBe("");
    }
  });

  it("renders AI assistant for every authenticated role (T-RT-AGENT-01)", async () => {
    setDesktopViewport();
    mockApiFetch.mockImplementation(async (...args: unknown[]) => {
      const path = String(args[0] ?? "");
      if (path === "/api/v1/agent/health") {
        return { status: "ok", model: "deepseek-chat", modelConfigured: false, tools: [] };
      }
      return { items: [] };
    });
    mockUseAuth.mockReturnValue({
      user: { id: "viewer-1", username: "viewer", roles: ["viewer"] as const },
      isLoading: false,
      isAuthenticated: true,
      logout: vi.fn(),
      refresh: vi.fn(async () => {}),
    });

    renderRoutes(["/admin/agent"]);

    const main = screen.getAllByRole("main")[0];
    expect(await within(main).findByRole("heading", { level: 1, name: "AI 助手" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "AI 助手" })).toHaveAttribute("href", "/admin/agent");
  });

  it("T-NAV-01: dashboards and datasources routes both keep admin shell mounted", async () => {
    setDesktopViewport();
    mockApiFetch.mockResolvedValue({ items: [] });

    renderRoutes(["/admin/dashboards"]);
    expect(await screen.findByRole("heading", { name: "数据看板" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "管理端导航" })).toBeInTheDocument();

    cleanup();
    renderRoutes(["/admin/datasources"]);
    expect(await screen.findByRole("heading", { name: "数据源" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "管理端导航" })).toBeInTheDocument();
  });
});

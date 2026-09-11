import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import type { RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
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

vi.mock("@/lib/gov-nav", () => ({
  isGovNavEnabledFromEnv: () => true,
}));

import { AdminLayout } from "./AdminLayout";

function render(ui: React.ReactElement, options?: RenderOptions) {
  return rtlRender(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>, options);
}

describe("AdminLayout smoke", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    mockUseAuth.mockReset();
    mockUseAuth.mockImplementation(() => ({
      user: { id: "1", username: "admin", roles: ["admin"] as const },
      isLoading: false,
      isAuthenticated: true,
      logout: vi.fn(),
      refresh: vi.fn(async () => {}),
    }));
  });
  function setMobileViewport(width = 375) {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: width,
    });
    window.dispatchEvent(new Event("resize"));
  }

  function setDesktopViewport(width = 1600) {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: width,
    });
    window.dispatchEvent(new Event("resize"));
  }

  it("mounts sidebar navigation and main content (T-FE-06)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>child content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("navigation", { name: "管理端导航" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveTextContent("child content");
  });

  it("mounts theme toggle in header actions (T-FE-07)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getAllByRole("button", { name: "切换深浅色主题" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("T-FE-SMFB-04: admin workspace has no duplicate header 系统管理 link", () => {
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin/dashboards"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboards" element={<div>dashboards</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "系统管理" })).not.toBeInTheDocument();
  });

  it("T-FE-SMFB-05: viewer does not show header 系统管理 link", () => {
    mockUseAuth.mockImplementation(() => ({
      user: { id: "2", username: "viewer", roles: ["viewer"] as const },
      isLoading: false,
      isAuthenticated: true,
      logout: vi.fn(),
      refresh: vi.fn(async () => {}),
    }));
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin/dashboards"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboards" element={<div>dashboards</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "系统管理" })).not.toBeInTheDocument();
  });

  it("renders mobile menu button with accessible label (T-FE-10)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(
      screen.getAllByRole("button", { name: "打开菜单" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("toggles dark class on theme button click (T-FE-15)", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
    const toggle = screen.getAllByRole("button", { name: "切换深浅色主题" })[0];
    fireEvent.click(toggle);
    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });
  });

  it("main content area uses full-width contract (T-FE-16)", () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const main = screen.getAllByRole("main")[0];
    expect(main.className).toContain("max-w-none");
    expect(main.className).not.toContain("max-w-(--breakpoint-2xl)");
  });

  it("dataset edit route uses fill-height full-width main", () => {
    render(
      <MemoryRouter initialEntries={["/admin/datasets/ds-demo/edit"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="datasets/:id/edit" element={<div>dataset form</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const main = screen.getAllByRole("main")[0];
    expect(main.className).toContain("overflow-hidden");
    expect(main.className).toContain("max-w-none");
    expect(main.className).not.toContain("max-w-(--breakpoint-2xl)");
    expect(document.documentElement.classList.contains("admin-fill-lock")).toBe(true);
  });

  it("dashboard edit route uses fill-height main (no page scroll flicker)", () => {
    render(
      <MemoryRouter initialEntries={["/admin/dashboards/d1/edit"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboards/:id/edit" element={<div>edit canvas</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const main = screen.getAllByRole("main")[0];
    expect(main.className).toContain("overflow-hidden");
    expect(main.className).not.toContain("overflow-y-auto");
    expect(document.documentElement.classList.contains("admin-fill-lock")).toBe(true);
  });

  it("share route uses full-width fill-height main (bi-share-embed)", () => {
    render(
      <MemoryRouter initialEntries={["/admin/data-screens/ds1/share"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="data-screens/:id/share" element={<div>share page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const main = screen.getAllByRole("main")[0];
    expect(main.className).toContain("max-w-none");
    expect(main.className).not.toContain("max-w-(--breakpoint-2xl)");
    expect(main.className).toContain("overflow-hidden");
    expect(main.className).not.toContain("overflow-y-auto");
  });

  it("report center uses fill-height main (aligned with templates workbench)", () => {
    render(
      <MemoryRouter initialEntries={["/admin/reports/center"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="reports/center" element={<div>report center</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const main = screen.getAllByRole("main")[0];
    expect(main.className).toContain("max-w-none");
    expect(main.className).toContain("overflow-hidden");
    expect(main.className).toContain("p-1.5");
    expect(main.className).not.toContain("overflow-y-auto");
    expect(main.className).not.toContain("p-4");
  });

  it("report schedules uses fill-height main", () => {
    render(
      <MemoryRouter initialEntries={["/admin/reports/schedules"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="reports/schedules" element={<div>schedules</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const main = screen.getAllByRole("main")[0];
    expect(main.className).toContain("overflow-hidden");
    expect(main.className).toContain("p-1.5");
    expect(main.className).not.toContain("overflow-y-auto");
  });

  it("report templates workbench uses fill-height main (no scroll jump on node switch)", () => {
    render(
      <MemoryRouter initialEntries={["/admin/reports/templates/node-1"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="reports/templates/:nodeId?" element={<div>templates workbench</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const main = screen.getAllByRole("main")[0];
    expect(main.className).toContain("overflow-hidden");
    expect(main.className).not.toContain("overflow-y-auto");
    expect(document.documentElement.classList.contains("admin-fill-lock")).toBe(true);
  });

  it("account profile uses full-width main", () => {
    render(
      <MemoryRouter initialEntries={["/admin/account/profile"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="account/profile" element={<div>profile</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const main = screen.getAllByRole("main")[0];
    expect(main.className).toContain("max-w-none");
    expect(main.className).not.toContain("max-w-(--breakpoint-2xl)");
  });

  it("T-NAV-02: dashboard edit → list keeps AdminLayout mounted (useMatch hooks stable)", async () => {
    setDesktopViewport(1600);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin/dashboards/d1/edit"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboards/:id/edit" element={<div>edit canvas</div>} />
            <Route path="dashboards" element={<div>dashboard list</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const main = screen.getAllByRole("main")[0];
    expect(main.className).toContain("overflow-hidden");
    expect(screen.getByText("edit canvas")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "仪表板" }));

    expect(await screen.findByText("dashboard list")).toBeInTheDocument();
    expect(screen.queryByText("edit canvas")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "管理端导航" })).toBeInTheDocument();
  });

  it("shows mobile backdrop when menu opens at 375px (T-FE-20)", () => {
    setMobileViewport(375);
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const menuBtn = screen.getAllByRole("button", { name: "打开菜单" })[0];
    fireEvent.click(menuBtn);
    const backdrop = document.querySelector('[class*="bg-gray-900/50"]');
    expect(backdrop).not.toBeNull();
  });

  it("toggles desktop sidebar margin between 240px and 90px (T-FE-21)", () => {
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const menuBtn = screen.getAllByRole("button", { name: "打开菜单" })[0];
    const main = screen.getAllByRole("main")[0];
    const contentWrapper = main.parentElement;
    expect(contentWrapper?.className).toContain("md:ml-[240px]");

    fireEvent.click(menuBtn);
    expect(contentWrapper?.className).toContain("md:ml-[90px]");

    fireEvent.click(menuBtn);
    expect(contentWrapper?.className).toContain("md:ml-[240px]");
  });

  it("main and navigation token contract (T-FE-22)", () => {
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const main = screen.getAllByRole("main")[0];
    expect(main.className).toContain("max-w-none");
    expect(main.className).not.toContain("max-w-(--breakpoint-2xl)");
    expect(
      screen.getAllByRole("navigation", { name: "管理端导航" }).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("desktop tab focus order: menu button then theme toggle (T-FE-24)", async () => {
    setDesktopViewport(1600);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const menuBtn = screen.getAllByRole("button", { name: "打开菜单" })[0];
    const themeBtn = screen.getAllByRole("button", { name: "切换深浅色主题" })[0];

    for (let i = 0; i < 40; i++) {
      await user.tab();
      if (document.activeElement === menuBtn) break;
    }
    expect(document.activeElement).toBe(menuBtn);

    let reachedTheme = false;
    for (let i = 0; i < 15; i++) {
      await user.tab();
      if (document.activeElement === themeBtn) {
        reachedTheme = true;
        break;
      }
    }
    expect(reachedTheme).toBe(true);
  });

  it("mobile tab reaches menu button at 375px (T-FE-25)", async () => {
    setMobileViewport(375);
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const menuBtn = screen.getAllByRole("button", { name: "打开菜单" })[0];
    menuBtn.focus();
    expect(document.activeElement).toBe(menuBtn);
    expect(menuBtn).toHaveAccessibleName("打开菜单");
  });

  it("mobile menu open tab does not trap focus (T-FE-26)", async () => {
    setMobileViewport(375);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    const menuBtn = screen.getAllByRole("button", { name: "打开菜单" })[0];
    await user.click(menuBtn);
    await user.tab();
    await user.tab();
    expect(screen.getAllByRole("main").length).toBeGreaterThanOrEqual(1);
  });

  it("shows return to workspace in user menu on account pages (T-FE-32)", async () => {
    setDesktopViewport(1600);
    localStorage.clear();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin/dashboards"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboards" element={<div>workspace home</div>} />
            <Route path="account/profile" element={<div>profile page</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("workspace home")).toBeInTheDocument();

    const userMenu = screen.getAllByRole("button", { name: "用户菜单" })[0];
    await user.click(userMenu);
    expect(screen.queryByRole("menuitem", { name: "返回工作台" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "个人中心" }));
    expect(screen.getByText("profile page")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "账号导航" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "管理端导航" })).not.toBeInTheDocument();
    expect(screen.queryByText("数据连接")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "返回工作台" }).length).toBeGreaterThanOrEqual(1);

    await user.click(userMenu);
    expect(screen.getByRole("menuitem", { name: "返回工作台" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "返回工作台" }));
    expect(screen.getByText("workspace home")).toBeInTheDocument();
  });

  it("admin sidebar has 报表中心 group with 工作台 link (T-FE-SMFA-01)", () => {
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin/reports/center"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="reports/center" element={<div>center</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("报表中心")).toBeInTheDocument();
    const hubLink = screen.getByRole("link", { name: "工作台" });
    expect(hubLink).toHaveAttribute("href", "/admin/reports/center");
  });

  it("T-FE-SMFA-05: collapsed nav still shows 报表中心 group", () => {
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "报表中心" })).toBeInTheDocument();
  });

  it("admin sidebar 数据连接 links to datasources (T-FE-SMFA-02)", async () => {
    setDesktopViewport(1600);
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await user.hover(screen.getByRole("button", { name: "数据连接" }));
    expect(await screen.findByRole("link", { name: "连接管理" })).toHaveAttribute(
      "href",
      "/admin/datasources",
    );
    expect(screen.queryByRole("link", { name: "连接器类型" })).not.toBeInTheDocument();
  });

  it("admin sidebar has no 预览 badge after M13 GA (T-FE-SMFA-03)", () => {
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin/dashboards"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboards" element={<div>dashboards</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByText("预览")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /查询设计器/ })).toBeInTheDocument();
  });

  it("viewer role: sidebar has no 系统 or 数据 section headings (T-FE-SMFA-04)", () => {
    setDesktopViewport(1600);
    mockUseAuth.mockReturnValueOnce({
      user: { id: "2", username: "viewer", roles: ["viewer"] },
      isLoading: false,
      isAuthenticated: true,
      logout: vi.fn(),
      refresh: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseAuth>);

    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("heading", { name: "系统" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "数据" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "分析" })).toBeInTheDocument();
  });

  it("T-FE-SMFB-00: system admin home sidebar shows 配置向导", () => {
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin/system"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="system" element={<div>system home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "入门" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "配置向导" })).toHaveAttribute("href", "/admin/system");
    expect(screen.queryByRole("heading", { name: "数据" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "系统管理" })).not.toBeInTheDocument();
  });

  it("T-FE-SMFB-01: system admin sidebar has 资源授权 link", () => {
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin/system/roles"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="system/roles" element={<div>roles</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: "平台与组织" })).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "资源授权" });
    expect(link).toHaveAttribute("href", "/admin/system/grants");
  });

  it("T-FE-SMFB-01b: main workspace sidebar has no 系统 heading", () => {
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin/dashboards"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboards" element={<div>dashboards</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("heading", { name: "系统" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "后台管理" })).not.toBeInTheDocument();
  });

  it("T-FE-SMFB-02: viewer sidebar has no 资源授权 text", () => {
    mockUseAuth.mockReturnValueOnce({
      user: { id: "2", username: "viewer", roles: ["viewer"] },
      isLoading: false,
      isAuthenticated: true,
      logout: vi.fn(),
      refresh: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseAuth>);
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<div>home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText("资源授权")).not.toBeInTheDocument();
  });

  it("T-FE-SMFB-03: admin 报表中心侧栏含子导航", () => {
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin/reports/templates"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="reports/templates" element={<div>templates</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "工作台" })).toHaveAttribute(
      "href",
      "/admin/reports/center",
    );
    expect(screen.getByRole("link", { name: "文档模板" })).toHaveAttribute(
      "href",
      "/admin/reports/templates",
    );
  });

  it("T-NAV-FC-04: analyst sidebar has no 实体总览 or 连接管理", () => {
    mockUseAuth.mockReturnValueOnce({
      user: { id: "3", username: "analyst", roles: ["analyst"] },
      isLoading: false,
      isAuthenticated: true,
      logout: vi.fn(),
      refresh: vi.fn(async () => {}),
    } as unknown as ReturnType<typeof mockUseAuth>);
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin/dashboards"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboards" element={<div>d</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: "实体总览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "连接管理" })).not.toBeInTheDocument();
  });

  it("T-DESIGN-FC-01-smoke: admin sees 治理专用 badge on designer link", () => {
    setDesktopViewport(1600);
    render(
      <MemoryRouter initialEntries={["/admin/governance/tickets"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="governance/tickets" element={<div>t</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("治理专用")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /查询设计器/ })).toBeInTheDocument();
  });
});

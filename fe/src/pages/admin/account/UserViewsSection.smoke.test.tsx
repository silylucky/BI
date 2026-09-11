import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserViewsSection } from "./components/UserViewsSection";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

type ViewRow = { id: string; name: string; dashboardId: string; layout?: Record<string, unknown> };

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <TooltipProvider delayDuration={0}>
      <MemoryRouter>
        <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
      </MemoryRouter>
    </TooltipProvider>
  );
}

function mockViewsApi(views: ViewRow[]) {
  mockApiFetch.mockImplementation(async (url: string, options?: { method?: string; body?: string }) => {
    if (url.includes("/api/v1/dashboards?")) {
      return {
        items: [{ id: "dash-1", name: "销售看板" }],
        total: 1,
        limit: 100,
        offset: 0,
      };
    }
    if (url === "/api/v1/users/me/views" && !options?.method) {
      return { items: views };
    }
    if (url === "/api/v1/users/me/views" && options?.method === "POST") {
      const body = JSON.parse(options.body ?? "{}") as Omit<ViewRow, "id">;
      const created = { id: "view-new", ...body };
      views.push(created);
      return created;
    }
    if (url.startsWith("/api/v1/users/me/views/") && options?.method === "PUT") {
      const id = url.split("/").pop()!;
      const body = JSON.parse(options.body ?? "{}") as Omit<ViewRow, "id"> & { isDefault?: boolean };
      const index = views.findIndex((row) => row.id === id);
      if (index >= 0) {
        if (body.isDefault) {
          views.forEach((row) => {
            row.isDefault = row.id === id;
          });
        }
        views[index] = { id, ...views[index], ...body };
      }
      return views[index];
    }
    if (url.startsWith("/api/v1/users/me/views/") && options?.method === "DELETE") {
      const id = url.split("/").pop()!;
      const index = views.findIndex((row) => row.id === id);
      if (index >= 0) views.splice(index, 1);
      return null;
    }
    throw new Error(`unexpected fetch: ${url} ${options?.method ?? "GET"}`);
  });
}

describe("UserViewsSection smoke", () => {
  afterEach(() => cleanup());

  it("renders empty state", async () => {
    mockViewsApi([]);
    render(wrap(<UserViewsSection />));
    expect(
      await screen.findByText("尚未配置个人默认视图，将使用角色默认入口"),
    ).toBeInTheDocument();
  });

  it("renders dashboard name and deletes a view", async () => {
    const views: ViewRow[] = [
      { id: "view-1", name: "备份视图", dashboardId: "dash-1", layout: {} },
    ];
    mockViewsApi(views);
    const user = userEvent.setup();
    render(wrap(<UserViewsSection />));

    expect(await screen.findByText("销售看板")).toBeInTheDocument();
    expect(screen.getByText("备份视图")).toBeInTheDocument();

    const row = screen.getByText("备份视图").closest("tr");
    expect(row).not.toBeNull();
    await user.click(within(row!).getByRole("button", { name: "删除视图 备份视图" }));
    await user.click(screen.getByRole("button", { name: "删除" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/users/me/views/view-1",
        expect.objectContaining({ method: "DELETE" }),
      );
    });
    await waitFor(() => {
      expect(screen.getByText("尚未配置个人默认视图，将使用角色默认入口")).toBeInTheDocument();
    });
  });

  it("creates a view from the dialog", async () => {
    const views: ViewRow[] = [];
    mockViewsApi(views);
    const user = userEvent.setup();
    render(wrap(<UserViewsSection />));

    await user.click(await screen.findByRole("button", { name: "创建第一个视图" }));
    expect(screen.getByRole("heading", { name: "创建个人视图" })).toBeInTheDocument();

    await user.clear(screen.getByLabelText("名称"));
    await user.type(screen.getByLabelText("名称"), "我的总览");
    await user.click(screen.getByLabelText("选择仪表板"));
    await user.click(await screen.findByRole("option", { name: "销售看板" }));
    await user.click(screen.getByRole("button", { name: "创建" }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/users/me/views",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            name: "我的总览",
            dashboardId: "dash-1",
            layout: {},
          }),
        }),
      );
    });
    expect(await screen.findByText("我的总览")).toBeInTheDocument();
  });

  it("sets login entry without renaming the view", async () => {
    const views: ViewRow[] = [
      { id: "view-1", name: "销售总览", dashboardId: "dash-1", layout: {}, isDefault: true },
      { id: "view-2", name: "备份视图", dashboardId: "dash-1", layout: {} },
    ];
    mockViewsApi(views);
    const user = userEvent.setup();
    render(wrap(<UserViewsSection />));

    expect(await screen.findByText("备份视图")).toBeInTheDocument();
    expect(screen.getByText("销售总览")).toBeInTheDocument();

    await user.click(within(screen.getByText("备份视图").closest("tr")!).getByRole("button", {
      name: "设为登录入口",
    }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/users/me/views/view-2",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({
            name: "备份视图",
            dashboardId: "dash-1",
            layout: {},
            isDefault: true,
          }),
        }),
      );
    });
    expect(screen.getByText("备份视图")).toBeInTheDocument();
    expect(screen.queryByText("备份-")).not.toBeInTheDocument();
  });
});

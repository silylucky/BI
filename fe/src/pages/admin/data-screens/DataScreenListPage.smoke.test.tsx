import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataScreenListPage } from "./DataScreenListPage";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "1", username: "admin", roles: ["admin"], isRoot: true },
    isAuthenticated: true,
  }),
}));

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter>
          <DataScreenListPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("DataScreenListPage smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
  });
  afterEach(() => cleanup());

  it("renders title and empty state", async () => {
    mockApiFetch.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    renderPage();
    expect(await screen.findByText("数据大屏")).toBeInTheDocument();
    expect(await screen.findByText("暂无数据大屏")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /新建大屏/ }).length).toBeGreaterThan(0);
    });
    expect(mockApiFetch).toHaveBeenCalledWith(
      expect.stringContaining("surfaceKind=data-screen"),
    );
  });

  it("renders pagination summary without NaN when list has items", async () => {
    mockApiFetch.mockResolvedValue({
      items: [
        {
          id: "s1",
          name: "测试大屏",
          slug: "test-screen",
          updatedAt: "2026-07-20T10:00:00.000Z",
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
    renderPage();
    expect(await screen.findByText("测试大屏")).toBeInTheDocument();
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/显示\s+1.1/);
      expect(document.body.textContent).toMatch(/共\s*1\s*条/);
      expect(document.body.textContent).toMatch(/第\s*1\s*\/\s*1\s*页/);
      expect(document.body.textContent).not.toContain("NaN");
    });
  });

  it("renders batch actions toolbar for editors", async () => {
    mockApiFetch.mockResolvedValue({
      items: [
        {
          id: "s1",
          name: "测试大屏",
          slug: "test-screen",
          updatedAt: "2026-07-20T10:00:00.000Z",
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    });
    renderPage();
    expect(await screen.findByRole("button", { name: "批量操作" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "搜索大屏" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "卡片" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "列表" })).toBeInTheDocument();
  });
});

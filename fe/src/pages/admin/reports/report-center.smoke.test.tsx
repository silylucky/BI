import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ReportCenterPage } from "./ReportCenterPage";

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
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={["/admin/reports/center"]}>
          <ReportCenterPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("ReportCenterPage smoke", () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/v1/reports/standard/packs") {
        return {
          items: [{ packKey: "k1", displayName: "标准A", enabledThemes: ["lifecycle"] }],
          total: 1,
        };
      }
      if (path === "/api/v1/reports/center/preferences") {
        return { favorites: [], recent: [] };
      }
      if (path.startsWith("/api/v1/reports/schedules")) {
        return { items: [], total: 0 };
      }
      if (path === "/api/v1/reports/catalog/nodes") {
        return { items: [], total: 0 };
      }
      if (path === "/api/v1/reports/catalog/templates/readiness" && init?.method === "POST") {
        return { items: [] };
      }
      throw new Error(`unmocked ${path}`);
    });
  });

  it("shows hub entry cards for standard analysis", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: "标准分析" });
    await waitFor(() => {
      expect(link).toHaveAttribute("href", "/admin/reports/standard/results?pack=k1");
    });
  });

  it("standard entry links to workbench", async () => {
    renderPage();
    const link = await screen.findByRole("link", { name: "标准分析" });
    await waitFor(() => {
      expect(link).toHaveAttribute("href", "/admin/reports/standard/results?pack=k1");
    });
  });

  it("shows dashboard PDF schedule signpost on hub", async () => {
    renderPage();
    expect(await screen.findByRole("region", { name: "看板与大屏 PDF 定时说明" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "去看板创建" })).toHaveAttribute(
      "href",
      "/admin/dashboards?intent=schedule",
    );
    expect(screen.getByRole("link", { name: "管理看板调度" })).toHaveAttribute(
      "href",
      "/admin/reports/schedules?tab=dashboard",
    );
  });

  it("hides manage entry cards when standard packs empty", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path === "/api/v1/reports/standard/packs") return { items: [], total: 0 };
      if (path === "/api/v1/reports/center/preferences") return { favorites: [], recent: [] };
      if (path.startsWith("/api/v1/reports/schedules")) return { items: [], total: 0 };
      if (path === "/api/v1/reports/catalog/nodes") return { items: [], total: 0 };
      throw new Error(`unmocked ${path}`);
    });
    renderPage();
    expect(await screen.findByTestId("admin-page-header-frame")).toBeInTheDocument();
    expect(screen.queryByText("1 个分析包")).not.toBeInTheDocument();
  });
});

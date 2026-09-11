import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StandardAnalysisConfigPage } from "./StandardAnalysisConfigPage";
import { StandardAnalysisPage } from "./StandardAnalysisPage";
import { STANDARD_RESULTS_PATH, STANDARD_SETUP_PATH } from "./standardRoutes";

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

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path === "/api/v1/reports/standard/packs") {
      return {
        items: [
          {
            packKey: "s1",
            displayName: "sss1",
            datasetId: "std-pack-equipment-overview",
            boundConfigId: "00000000-0000-4000-8000-000000000099",
            dataSourceId: "00000000-0000-4000-8000-000000000001",
            fieldMapping: { status: "province", region: "city", createdAt: "amount" },
            enabledThemes: ["lifecycle", "distribution"],
            allowedRoles: ["analyst", "admin"],
            snapshotCronPreset: "daily",
          },
        ],
        total: 1,
      };
    }
    if (path.includes("/run")) {
      return {
        packKey: "s1",
        theme: "lifecycle",
        renderSpec: { sections: [{ kind: "table", columns: ["status", "cnt"], rows: [["active", 3]] }] },
        dataSourceId: "00000000-0000-4000-8000-000000000001",
        status: "ready",
      };
    }
    if (path.includes("/snapshots")) {
      return { items: [], total: 0 };
    }
    if (path.includes("/capabilities")) {
      return {
        packKey: "s1",
        themes: [
          { theme: "lifecycle", available: true },
          { theme: "distribution", available: true },
          { theme: "activity", available: false, reason: "缺少字段映射: created_at" },
          { theme: "trend", available: false, reason: "缺少字段映射: created_at" },
        ],
        columns: ["province", "city", "amount"],
      };
    }
    if (path.startsWith("/api/v1/datasets/query-configs/")) {
      return { columns: [{ name: "province" }, { name: "city" }, { name: "amount" }] };
    }
    if (path.includes("/api/v1/reports/schedules")) {
      return { items: [], total: 0 };
    }
    throw new Error(`unmocked ${path}`);
  }),
}));

function renderRoutes(initialPath: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path={STANDARD_RESULTS_PATH} element={<StandardAnalysisPage />} />
            <Route path={STANDARD_SETUP_PATH} element={<StandardAnalysisConfigPage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("standard analysis route navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("navigates from setup page to results page via back button", async () => {
    const user = userEvent.setup();
    renderRoutes(`${STANDARD_SETUP_PATH}?pack=s1`);

    expect(
      await screen.findByText("管理分析包：绑定数据集、映射字段、周期快照与可选定时投递。"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "返回查看结果" }));

    await waitFor(() => {
      expect(
        screen.getByText("查看分析结果并与上期快照对比；管理员可点击右上角「管理分析包」配置数据集与快照。"),
      ).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "保存" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "管理分析包" })).toBeInTheDocument();
  });
});

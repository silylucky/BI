import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StandardAnalysisPage } from "./StandardAnalysisPage";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path === "/api/v1/reports/standard/packs") {
      return {
        items: [
          {
            packKey: "equipment-overview",
            displayName: "设备标准分析",
            datasetId: "std-pack-equipment-overview",
            boundConfigId: "00000000-0000-4000-8000-000000000099",
            dataSourceId: "00000000-0000-4000-8000-000000000001",
            fieldMapping: { status: "status", region: "region", createdAt: "created_at" },
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
        packKey: "equipment-overview",
        theme: "lifecycle",
        renderSpec: {
          sections: [
            {
              kind: "table",
              columns: [{ name: "status" }, { name: "cnt" }],
              rows: [["active", 3]],
            },
          ],
        },
        dataSourceId: "00000000-0000-4000-8000-000000000001",
        status: "ready",
      };
    }
    if (path.includes("/snapshots")) {
      return { items: [], total: 0 };
    }
    if (path.includes("/api/v1/reports/schedules")) {
      return { items: [], total: 0 };
    }
    throw new Error(`unmocked ${path}`);
  }),
}));
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
        <MemoryRouter>
          <StandardAnalysisPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("StandardAnalysisPage smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows pack list and run result", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("active").length).toBeGreaterThan(0);
      expect(screen.getByText("状态")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: "周期对比" })).toBeInTheDocument();
  });
});

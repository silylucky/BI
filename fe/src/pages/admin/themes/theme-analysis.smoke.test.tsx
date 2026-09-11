import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockApiFetch = vi.fn();
const toastSuccess = vi.fn();

vi.mock("sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args), error: vi.fn() },
}));

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

vi.mock("@/assets/geo/china-provinces.json", () => ({
  default: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { name: "北京市", adcode: 110000, level: "province" },
        geometry: { type: "Polygon", coordinates: [] },
      },
      {
        type: "Feature",
        properties: { name: "广东省", adcode: 440000, level: "province" },
        geometry: { type: "Polygon", coordinates: [] },
      },
    ],
  },
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

import { ThemeAnalysisPage } from "./ThemeAnalysisPage";

const DASH_ID = "00000000-0000-4000-8000-000000000099";

function renderPage(dashboardId = DASH_ID) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/admin/themes/${dashboardId}`]}>
        <Routes>
          <Route path="/admin/themes/:dashboardId" element={<ThemeAnalysisPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function defaultMock(path: string, init?: RequestInit) {
  if (path === "/api/v1/dashboards") {
    return { items: [{ id: DASH_ID, name: "测试看板" }] };
  }
  if (path.includes("theme-analysis") && (!init?.method || init.method === "GET")) {
    if (path.includes("chart-bindings")) {
      return { bindings: [{ widgetId: "w1", dimensionId: "region" }], linkedWidgetCount: 1 };
    }
    throw Object.assign(new Error("not found"), { status: 404, code: "CONFIG_NOT_FOUND" });
  }
  if (path.includes("execute-plan")) {
    return { planVersion: "theme-plan-v1", compareWindow: null, steps: [] };
  }
  if (path.includes("theme-analysis/query")) {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (body.dimensionId === "region" && body.filters?.region) {
      return { columns: ["region", "cnt"], rows: [[body.filters.region, 5]] };
    }
    if (body.dimensionId === "region") {
      return {
        columns: ["region", "cnt"],
        rows: [
          ["北京", 12],
          ["广东", 8],
        ],
      };
    }
    return { columns: ["region", "cnt"], rows: [["east", 2]] };
  }
  return {};
}

describe("ThemeAnalysisPage smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => defaultMock(path, init));
    toastSuccess.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("analysis tab prompts configure when no config", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "分析" }));
    expect(await screen.findByText("请先配置")).toBeInTheDocument();
  });

  it("save config shows success toast", async () => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("theme-analysis") && init?.method === "PUT") {
        return {
          entityType: "equipment",
          timeGranularity: "day",
          refType: "dashboard",
          refId: DASH_ID,
          dimensions: [{ dimensionId: "region", label: "区域" }],
        };
      }
      return defaultMock(path, init);
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "保存" }));
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith("主题配置已保存");
    });
  });

  it("dimension pill triggers drill query", async () => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("theme-analysis") && (!init?.method || init.method === "GET")) {
        if (path.includes("chart-bindings")) {
          return { bindings: [{ widgetId: "w1", dimensionId: "region" }], linkedWidgetCount: 1 };
        }
        return {
          entityType: "equipment",
          timeGranularity: "day",
          refType: "dashboard",
          refId: DASH_ID,
          dimensions: [{ dimensionId: "region", label: "区域" }],
        };
      }
      return defaultMock(path, init);
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "分析" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "区域" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "区域" }));
    expect(await screen.findByText("北京")).toBeInTheDocument();
  });

  it("geo map panel renders with region distribution data", async () => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("theme-analysis") && (!init?.method || init.method === "GET")) {
        if (path.includes("chart-bindings")) {
          return { bindings: [{ widgetId: "w1", dimensionId: "region" }], linkedWidgetCount: 1 };
        }
        return {
          entityType: "equipment",
          timeGranularity: "day",
          refType: "dashboard",
          refId: DASH_ID,
          dimensions: [{ dimensionId: "region", label: "区域" }],
        };
      }
      return defaultMock(path, init);
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "分析" }));
    expect(await screen.findByText("GIS 分布")).toBeInTheDocument();
    expect(await screen.findByTestId("d3-map-chart")).toBeInTheDocument();
  });

  it("viewer sees read-only message on config tab", async () => {
    vi.resetModules();
    vi.doMock("@/context/auth-context", () => ({
      useAuth: () => ({
        user: { id: "v1", username: "viewer", roles: ["viewer"] },
        isLoading: false,
        isAuthenticated: true,
        logout: vi.fn(),
        refresh: vi.fn(async () => {}),
      }),
      AuthProvider: ({ children }: { children: React.ReactNode }) => children,
    }));
    const { ThemeAnalysisPage: ViewerPage } = await import("./ThemeAnalysisPage");
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[`/admin/themes/${DASH_ID}`]}>
          <Routes>
            <Route path="/admin/themes/:dashboardId" element={<ViewerPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("只读权限，无法修改主题配置")).toBeInTheDocument();
  });
});

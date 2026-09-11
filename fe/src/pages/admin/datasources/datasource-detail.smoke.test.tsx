import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

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

import { DatasourceDetailPage } from "./DatasourceDetailPage";

function renderDetail(id = "ds-1") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter initialEntries={[`/admin/datasources/${id}`]}>
          <Routes>
            <Route path="/admin/datasources/:id" element={<DatasourceDetailPage />} />
          </Routes>
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("datasource detail schema browser", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
  });

  it("T-DS-004-01: renders 元数据浏览 card and expands schema", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.endsWith("/schemas")) return { items: [{ name: "public" }] };
      if (path.includes("/tables")) return { items: [{ name: "orders", type: "table" }] };
      if (path.includes("/columns")) return { items: [{ name: "id", dataType: "integer", nullable: false }] };
      return {
        id: "ds-1",
        name: "分析库",
        code: "analytics",
        type: "postgresql",
        host: "h",
        port: 5432,
        database: "d",
        username: "u",
      };
    });
    renderDetail();
    expect(await screen.findByRole("link", { name: "返回列表" })).toHaveAttribute(
      "href",
      "/admin/datasources",
    );
    expect(await screen.findByText("Schema / 表")).toBeInTheDocument();
    await waitFor(() =>
      expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/datasources/ds-1/tables?schema=public"),
    );
    expect(await screen.findByText("orders")).toBeInTheDocument();
    expect(await screen.findByText("public.orders")).toBeInTheDocument();
  });

  it("T-DS-004-02: METADATA_CONNECTION_FAILED shows Chinese error", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.endsWith("/schemas")) {
        throw Object.assign(new Error("fail"), { code: "METADATA_CONNECTION_FAILED" });
      }
      return {
        id: "ds-1",
        name: "X",
        code: "x",
        type: "postgresql",
        host: "h",
        port: 1,
        database: "d",
        username: "u",
      };
    });
    renderDetail();
    expect(await screen.findByText(/无法连接数据源/)).toBeInTheDocument();
  });

  it("T-DS-DEMO-01: official demo datasource hides edit action and shows lock hint", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.endsWith("/schemas")) return { items: [{ name: "sample_db" }] };
      return {
        id: "ds-demo",
        name: "示例数据",
        code: "demo",
        type: "mysql",
        host: "127.0.0.1",
        port: 3307,
        database: "sample_db",
        username: "sample",
        isDemoPackage: true,
      };
    });
    renderDetail("ds-demo");
    expect(await screen.findByText("官方示例数据")).toBeInTheDocument();
    expect(screen.queryByLabelText("编辑")).not.toBeInTheDocument();
    expect(await screen.findByText(/不可修改或删除/)).toBeInTheDocument();
  });

  it("T-DS-004-04: rest_api detail shows Base URL labels not host:port", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.endsWith("/schemas")) return { items: [{ name: "api" }] };
      return {
        id: "ds-rest",
        name: "样例 REST API",
        code: "sample_rest_api",
        type: "rest_api",
        host: "http://127.0.0.1:8000",
        port: 8000,
        database: "/sample-api/health",
        username: "none",
      };
    });
    renderDetail("ds-rest");
    expect(await screen.findByText("Base URL")).toBeInTheDocument();
    expect(await screen.findByText("http://127.0.0.1:8000")).toBeInTheDocument();
    expect(screen.getByText("健康检查路径")).toBeInTheDocument();
    expect(screen.getByText("/sample-api/health")).toBeInTheDocument();
    expect(screen.getByText("认证")).toBeInTheDocument();
    expect(screen.getByText("无")).toBeInTheDocument();
  });

  it("T-DS-004-03: successful test connection refetches schemas", async () => {
    let schemaCalls = 0;
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.endsWith("/schemas")) {
        schemaCalls += 1;
        if (schemaCalls === 1) {
          throw Object.assign(new Error("fail"), { code: "METADATA_CONNECTION_FAILED" });
        }
        return { items: [{ name: "sample_db" }] };
      }
      if (path.endsWith("/test") && init?.method === "POST") {
        return { ok: true, latencyMs: 12, message: "Connection successful" };
      }
      if (path.includes("/tables")) return { items: [{ name: "orders", type: "table" }] };
      if (path.includes("/columns")) return { items: [{ name: "id", dataType: "integer", nullable: false }] };
      return {
        id: "ds-1",
        name: "样例 MySQL",
        code: "demo-mysql",
        type: "mysql",
        host: "127.0.0.1",
        port: 3307,
        database: "sample_db",
        username: "sample",
      };
    });
    const user = userEvent.setup();
    renderDetail();
    expect(await screen.findByText(/无法连接数据源/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "测试连接" }));
    await waitFor(() => expect(schemaCalls).toBeGreaterThanOrEqual(2));
    expect(await screen.findByText("orders")).toBeInTheDocument();
  });
});

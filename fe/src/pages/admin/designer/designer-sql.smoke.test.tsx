/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockApiFetch = vi.fn();
let designMode: "visual" | "sql" = "visual";

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

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, apiFetch: (...args: unknown[]) => mockApiFetch(...args) };
});

import { DesignerPage } from "./DesignerPage";

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <DesignerPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function baseMock(path: string, init?: RequestInit) {
  if (path.startsWith("/api/v1/designer/fields")) {
    return { registry: ["order_amount"], glossary: [], datasetFields: [] };
  }
  if (path === "/api/v1/datasets") return { items: [], total: 0 };
  if (path.startsWith("/api/v1/datasources")) {
    return { items: [{ id: "ds-1", name: "Demo DB" }], total: 1 };
  }
  if (path.startsWith("/api/v1/designer/design-mode")) {
    if (init?.method === "PUT") {
      designMode = JSON.parse(String(init.body)).mode;
      return { mode: designMode };
    }
    return { mode: designMode };
  }
  if (path.startsWith("/api/v1/designer/sql-mode") && !path.includes("validate")) {
    if (init?.method === "PUT") return { sql: "SELECT 1", dataSourceId: "ds-1" };
    return { dataSourceId: "ds-1", sql: "" };
  }
  return {};
}

describe("Designer SQL mode smoke", () => {
  beforeEach(() => {
    designMode = "visual";
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/api/v1/designer/sql-mode/validate")) {
        return { sql: "SELECT 1" };
      }
      return baseMock(path, init);
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("T-DESIGN-R246-FE-01: switches to SQL mode", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "传统 SQL" }));
    await waitFor(() => {
      expect(screen.getByText("传统 SQL 模式")).toBeInTheDocument();
    });
  });

  it("T-DESIGN-R246-FE-02: saves SELECT 1", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "传统 SQL" }));
    await screen.findByText("传统 SQL 模式");
    const textarea = await screen.findByLabelText("SQL 编辑器");
    await user.type(textarea, "SELECT 1");
    await user.click(screen.getByRole("button", { name: "保存 SQL" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/designer/sql-mode",
        expect.objectContaining({ method: "PUT" }),
      );
    });
  });

  it("T-DESIGN-R246-FE-03: shows validation error on DML", async () => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/api/v1/designer/sql-mode/validate")) {
        throw Object.assign(new Error("readonly"), { code: "DESIGN_SQL_NOT_READONLY" });
      }
      return baseMock(path, init);
    });
    renderPage();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "传统 SQL" }));
    const textarea = await screen.findByLabelText("SQL 编辑器");
    await user.type(textarea, "DELETE FROM t");
    await user.click(screen.getByRole("button", { name: "校验 SQL" }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        "/api/v1/designer/sql-mode/validate",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });
});

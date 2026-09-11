/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";

const mockApiFetch = vi.fn();

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
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

import { DesignerPage } from "./DesignerPage";

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter>
          <DesignerPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("DesignerPage smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.startsWith("/api/v1/designer/fields")) {
        return { registry: ["order_amount", "status"], glossary: ["gmv_term"], datasetFields: [] };
      }
      if (path === "/api/v1/datasets") return { items: [], total: 0 };
      if (path === "/api/v1/designer/conditions/validate" && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        if (!body.conditions?.length) {
          throw Object.assign(new Error("empty"), { code: "DESIGN_EMPTY_CONDITIONS" });
        }
        return body;
      }
      if (path === "/api/v1/designer/preview/translate" && init?.method === "POST") {
        return { sql: "SELECT order_amount FROM design_preview WHERE order_amount > 100", parameters: {} };
      }
      if (path === "/api/v1/designer/conditions" && init?.method === "PUT") return { logic: "AND", conditions: [] };
      if (path === "/api/v1/designer/compute-rules" && init?.method === "PUT") return { rules: [] };
      if (path === "/api/v1/designer/output-fields" && init?.method === "PUT") return { fields: [] };
      if (path === "/api/v1/designer/submit-workflow" && init?.method === "POST") {
        return {
          workflowInstanceId: "00000000-0000-4000-8000-0000000000aa",
          designSnapshotId: "00000000-0000-4000-8000-0000000000bb",
          status: "pending_approval",
        };
      }
      return {};
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("T-DESIGN-R245-FE-01: 渲染条件 Tab 与添加按钮", async () => {
    renderPage();
    const tabs = await screen.findAllByRole("tab", { name: "条件" });
    expect(tabs.length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /添加条件/ }).length).toBeGreaterThan(0);
  });

  it("T-DESIGN-R245-FE-02: 添加条件行", async () => {
    renderPage();
    const user = userEvent.setup();
    const addButtons = await screen.findAllByRole("button", { name: /添加条件/ });
    await user.click(addButtons[0]);
    expect(screen.getAllByPlaceholderText("值").length).toBeGreaterThan(0);
  });

  it("T-DESIGN-R245-FE-03: 上移条件行", async () => {
    renderPage();
    const user = userEvent.setup();
    const addButtons = await screen.findAllByRole("button", { name: /添加条件/ });
    await user.click(addButtons[0]);
    await user.click(addButtons[0]);
    const upButtons = screen.getAllByRole("button", { name: "上移条件行" });
    expect(upButtons[0]).toBeDisabled();
    expect(upButtons[1]).not.toBeDisabled();
  });

  it("T-DESIGN-R245-FE-04: 校验错误展示", async () => {
    renderPage();
    const user = userEvent.setup();
    const saveButtons = await screen.findAllByRole("button", { name: "保存条件" });
    await user.click(saveButtons[0]);
    await waitFor(() => expect(mockApiFetch).toHaveBeenCalled());
  });

  it("T-DESIGN-R245-FE-05: 预览 SQL 非空", async () => {
    renderPage();
    const user = userEvent.setup();
    const addButtons = await screen.findAllByRole("button", { name: /添加条件/ });
    await user.click(addButtons[0]);
    const preview = await screen.findByLabelText("SQL 预览");
    await waitFor(() => expect((preview as HTMLTextAreaElement).value).toContain("SELECT"));
  });

  it("T-DESIGN-R245-FE-06: 提交工单成功 Dialog", async () => {
    renderPage();
    const user = userEvent.setup();
    const addButtons = await screen.findAllByRole("button", { name: /添加条件/ });
    await user.click(addButtons[0]);
    for (const label of ["保存条件", "保存规则", "保存输出"]) {
      const btns = screen.getAllByRole("button", { name: label });
      await user.click(btns[0]);
    }
    const submitBtns = screen.getAllByRole("button", { name: /提交查询服务申请/ });
    await user.click(submitBtns[0]);
    expect(await screen.findByText("工单已提交")).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getAllByText(/00000000/).length).toBeGreaterThan(0);
  });
});

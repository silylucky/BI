/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  return { ...actual, apiFetch: (...args: unknown[]) => mockApiFetch(...args) };
});

import { GovernancePublishPage } from "./GovernancePublishPage";
import { GovernanceWorkflowPage } from "./GovernanceWorkflowPage";

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Governance batch2 smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/workflow/templates")) {
        return { items: [{ id: "standard_query_release", name: "标准", nodes: [] }] };
      }
      if (path.includes("/workflow/instances") && !path.includes("includeDesignSnapshot")) {
        return {
          items: [{ id: "inst-1", templateId: "t", refId: "ref", status: "designing", allowedActions: [] }],
          total: 1,
        };
      }
      if (path.includes("includeDesignSnapshot")) {
        return {
          id: "inst-1",
          status: "designing",
          allowedActions: [],
          designSnapshot: { conditions: { logic: "AND" }, computeRules: {}, outputFields: {} },
        };
      }
      if (path.includes("/catalog/entries")) {
        return {
          items: [
            {
              id: "entry-1",
              name: "Query",
              httpMethod: "POST",
              path: "/api/v1/services/q",
              status: "published",
            },
          ],
          total: 1,
        };
      }
      if (path.includes("/openapi")) {
        return { openapi: "3.1.0", paths: {} };
      }
      return {};
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("T-GOV-R246-FE-01: instances tab lists workflow instances", async () => {
    wrap(<GovernanceWorkflowPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "工单实例" }));
    expect(await screen.findByText("设计中")).toBeInTheDocument();
  });

  it("T-GOV-R246-FE-02: snapshot panels read-only", async () => {
    wrap(<GovernanceWorkflowPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: "工单实例" }));
    expect(await screen.findByLabelText("条件快照")).toHaveAttribute("readonly");
  });

  it("T-GOV-R246-FE-03: publish page shows entries", async () => {
    wrap(<GovernancePublishPage />);
    expect(await screen.findByText("published")).toBeInTheDocument();
  });

  it("T-GOV-R246-FE-04: openapi sheet shows JSON", async () => {
    wrap(<GovernancePublishPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: /OpenAPI/ }));
    await waitFor(() => {
      expect(screen.getByLabelText("OpenAPI JSON")).toBeInTheDocument();
    });
  });
});

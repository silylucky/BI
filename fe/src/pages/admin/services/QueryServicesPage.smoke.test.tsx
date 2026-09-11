import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  return { ...actual, apiFetch: (...args: unknown[]) => mockApiFetch(...args) };
});

import { QueryServicesPage } from "./QueryServicesPage";

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <MemoryRouter>{ui}</MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("QueryServicesPage smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path.includes("/api/v1/services?")) {
        return {
          items: [
            {
              id: "svc-1",
              name: "Demo Query",
              httpMethod: "POST",
              path: "/api/v1/demo;requires=region",
              status: "published",
              version: "v1",
            },
          ],
          total: 1,
        };
      }
      if (path.includes("/openapi")) {
        return { openapi: "3.1.0", info: { title: "Demo Query" }, paths: {} };
      }
      if (path.includes("/execute") && init?.method === "POST") {
        return {
          columns: ["region", "value"],
          rows: [["华东", 100]],
          rowCount: 1,
          truncated: false,
        };
      }
      return {};
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists published services", async () => {
    wrap(<QueryServicesPage />);
    expect(await screen.findByText("Demo Query")).toBeInTheDocument();
  });

  it("opens trial sheet, accepts params, and shows result table", async () => {
    wrap(<QueryServicesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "试执行" }));
    expect(await screen.findByLabelText("region")).toBeInTheDocument();
    await user.type(screen.getByLabelText("region"), "华东");
    await user.click(screen.getByRole("button", { name: "执行" }));
    await waitFor(() => {
      expect(screen.getByText("返回 1 行")).toBeInTheDocument();
      expect(screen.getByText("华东")).toBeInTheDocument();
    });
  });

  it("opens openapi tab from row action", async () => {
    wrap(<QueryServicesPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "OpenAPI" }));
    await waitFor(() => {
      expect(screen.getByLabelText("OpenAPI JSON")).toBeInTheDocument();
    });
  });
});

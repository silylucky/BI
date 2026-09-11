import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoleDefaultViewCard } from "./RoleDefaultViewCard";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe("RoleDefaultViewCard smoke", () => {
  beforeEach(() => {
    mockApiFetch.mockImplementation(async (url: string) => {
      if (url.includes("/api/v1/dashboards?")) {
        return {
          items: [{ id: "dash-1", name: "销售看板" }],
          total: 1,
          limit: 100,
          offset: 0,
        };
      }
      if (url.includes("/api/v1/roles/admin/default-views")) {
        return { dashboardId: "dash-1", reportTemplateNodeId: null };
      }
      if (url.includes("/api/v1/roles/viewer/default-views")) {
        return { dashboardId: null, reportTemplateNodeId: null };
      }
      throw new Error(`unexpected url: ${url}`);
    });
  });
  afterEach(() => cleanup());

  it("uses primary role code for default-views API when viewer is listed first", async () => {
    render(wrap(<RoleDefaultViewCard roles={["viewer", "admin"]} />));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/roles/admin/default-views"),
      );
    });
    expect(await screen.findByText("销售看板")).toBeInTheDocument();
    expect(screen.getByText(/按平台角色「管理员」/)).toBeInTheDocument();
  });
});

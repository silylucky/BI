import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { VizComponentsHubPage } from "./VizComponentsHubPage";

vi.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { username: "admin", roles: ["admin"], permissions: [] },
  }),
}));

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/v1/viz-components") && init?.method === "POST") {
      return {
        items: [
          {
            id: "c1",
            componentKey: "vc-test",
            name: "测试图表",
            description: null,
            categoryKey: "general",
            widgetType: "chart",
            surfaceKinds: ["dashboard"],
            status: "published",
            payloadJson: {
              chartConfig: {
                chartId: "c1",
                chartType: "bar",
                dimensions: [{ field: "region" }],
                metrics: [{ field: "amount" }],
                dataSourceId: "00000000-0000-4000-8000-000000000001",
              },
            },
            thumbnailRef: null,
            tags: [],
            visibility: "org",
            ownerUserId: null,
            orgScope: null,
            contentRevision: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
          },
        ],
      };
    }
    if (url.startsWith("/api/v1/viz-components")) {
      return {
        items: [
          {
            id: "c1",
            componentKey: "vc-test",
            name: "测试图表",
            description: null,
            categoryKey: "general",
            widgetType: "chart",
            surfaceKinds: ["dashboard"],
            status: "published",
            thumbnailRef: null,
            tags: [],
            visibility: "org",
            contentRevision: 1,
            referenceCount: 0,
            updatedAt: new Date().toISOString(),
            publishedAt: new Date().toISOString(),
          },
        ],
        total: 1,
        limit: 100,
        offset: 0,
      };
    }
    throw new Error(`unexpected ${url}`);
  }),
}));

function renderHub() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <MemoryRouter>
          <VizComponentsHubPage />
        </MemoryRouter>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("VizComponentsHubPage", () => {
  it("renders component cards without crashing", async () => {
    renderHub();
    await waitFor(() => {
      expect(screen.getByText("测试图表")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /编辑/ })).toBeInTheDocument();
    expect(screen.getByText(/每页/)).toBeInTheDocument();
  });
});

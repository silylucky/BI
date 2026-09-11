import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CustomVizEditRail } from "./CustomVizEditRail";
import type { LayoutWidget } from "./layoutUtils";

const mockApiFetch = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

const widget: LayoutWidget & {
  customVizConfig: NonNullable<LayoutWidget["customVizConfig"]>;
} = {
  id: "w-cv-1",
  type: "customViz",
  title: "演示排名条",
  order: 0,
  colSpan: 6,
  rowSpan: 4,
  customVizConfig: {
    artifactId: "550e8400-e29b-41d4-a716-446655440000",
    dataBinding: { status: "manual" },
  },
};

describe("CustomVizEditRail", () => {
  afterEach(() => {
    cleanup();
    mockApiFetch.mockReset();
  });

  it("mounts data/style/advanced tabs and dataset panel", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/datasets")) return { items: [] };
      if (path.includes("/ai-viz/artifacts/")) {
        return {
          artifactId: widget.customVizConfig.artifactId,
          manifest: {
            displayName: "演示排名条",
            fieldSlots: {
              dimensions: { min: 1, max: 1, label: "类别" },
              metrics: { min: 1, max: 1, label: "数值" },
            },
            styleSchema: {
              type: "object",
              properties: { accentColor: { type: "string", format: "color" } },
            },
          },
          status: "active",
          contentHash: "abc",
        };
      }
      if (path.includes("/datasources")) return { items: [] };
      return { columns: [], rows: [] };
    });

    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter>
            <CustomVizEditRail widget={widget} onChange={vi.fn()} />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("tab", { name: "数据" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "样式" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "高级" })).toBeInTheDocument();
    expect(screen.getByText("数据集")).toBeInTheDocument();
    expect(screen.getByTestId("custom-viz-data-slots")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新组件数据" })).toBeInTheDocument();
  });
});

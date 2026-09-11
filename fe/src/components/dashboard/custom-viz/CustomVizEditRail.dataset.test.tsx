import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CustomVizEditRail } from "./CustomVizEditRail";
import type { LayoutWidget } from "../layoutUtils";

const mockApiFetch = vi.fn();
const mockFetchDatasetQueryConfig = vi.fn();

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  };
});

vi.mock("@/lib/datasetChartBinding", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/datasetChartBinding")>();
  return {
    ...actual,
    resolveDatasetChartBinding: (...args: unknown[]) => mockFetchDatasetQueryConfig(...args),
    fetchDatasetQueryConfig: (...args: unknown[]) => mockFetchDatasetQueryConfig(...args),
  };
});

const widget: LayoutWidget & {
  customVizConfig: NonNullable<LayoutWidget["customVizConfig"]>;
} = {
  id: "w-cv-1",
  type: "customViz",
  title: "实时告警滚动",
  order: 0,
  colSpan: 6,
  rowSpan: 4,
  customVizConfig: {
    artifactId: "550e8400-e29b-41d4-a716-446655440000",
    dataBinding: { status: "manual" },
  },
};


describe("CustomVizEditRail dataset binding", () => {
  afterEach(() => {
    mockApiFetch.mockReset();
    mockFetchDatasetQueryConfig.mockReset();
  });

  it("keeps selected dataset visible when parent props lag behind onChange", async () => {
    mockApiFetch.mockImplementation(async (path: string) => {
      if (path.includes("/datasets")) {
        return {
          items: [
            {
              datasetId: "ds-alerts",
              displayName: "告警明细",
              boundConfigId: "cfg-alerts",
            },
          ],
        };
      }
      if (path.includes("/ai-viz/artifacts/")) {
        return {
          artifactId: widget.customVizConfig.artifactId,
          manifest: {
            displayName: "实时告警滚动条",
            fieldSlots: {
              dimensions: { min: 1, max: 1, label: "告警内容" },
              metrics: { min: 1, max: 1, label: "严重等级" },
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
      return {};
    });
    mockFetchDatasetQueryConfig.mockResolvedValue({
      configId: "cfg-alerts",
      dataSourceId: "dsrc-1",
      columns: ["message", "severity"],
    });

    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = (
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter>
            <CustomVizEditRail widget={widget} onChange={onChange} />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>
    );
    const { rerender } = render(view);
    const user = userEvent.setup();

    await screen.findByRole("button", { name: "选择数据集" });
    await user.click(screen.getByRole("button", { name: "选择数据集" }));
    await user.click(await screen.findByText("告警明细"));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "选择数据集" })).toHaveTextContent("告警明细");
    });

    rerender(view);

    expect(screen.getByRole("button", { name: "选择数据集" })).toHaveTextContent("告警明细");

    rerender(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <MemoryRouter>
            <CustomVizEditRail widget={widget} onChange={onChange} />
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    expect(screen.getByRole("button", { name: "选择数据集" })).toHaveTextContent("告警明细");
    await waitFor(() => {
      expect(screen.getAllByText("message").length).toBeGreaterThan(0);
      expect(screen.getAllByText("severity").length).toBeGreaterThan(0);
    });
  });
});

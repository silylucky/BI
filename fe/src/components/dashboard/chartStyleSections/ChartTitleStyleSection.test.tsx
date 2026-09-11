import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartInspectorProvider } from "../ChartInspectorProvider";
import type { LayoutWidget } from "../layoutUtils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ChartTitleStyleSection } from "./ChartCommonStyleSections";

const widget: LayoutWidget = {
  id: "w1",
  type: "chart",
  title: "销售趋势",
  order: 1,
  colSpan: 6,
  rowSpan: 4,
  chartConfig: {
    chartType: "bar",
    styleVariant: "default",
    mode: "sql",
    dataSourceId: "00000000-0000-4000-8000-000000000001",
    sql: "SELECT 1",
    dimensions: [{ field: "region" }],
    metrics: [{ field: "amount" }],
  },
};

afterEach(cleanup);

function renderTitleSection(
  ui: React.ReactElement,
  options?: { dashboardStyle?: Parameters<typeof ChartInspectorProvider>[0]["dashboardStyle"] },
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <ChartInspectorProvider
          widget={widget}
          onChange={vi.fn()}
          dashboardStyle={options?.dashboardStyle}
        >
          {ui}
        </ChartInspectorProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("ChartTitleStyleSection", () => {
  it("switch reflects global titleStyle.show when chart has no override", () => {
    renderTitleSection(<ChartTitleStyleSection />, {
      dashboardStyle: { titleStyle: { show: false } },
    });

    expect(screen.getByRole("switch", { name: "显示标题" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("patches per-chart title.show when toggled", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider delayDuration={0}>
          <ChartInspectorProvider widget={widget} onChange={onChange} dashboardStyle={{}}>
            <ChartTitleStyleSection />
          </ChartInspectorProvider>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("switch", { name: "显示标题" }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nativeBody: expect.objectContaining({
          deStyle: expect.objectContaining({
            title: expect.objectContaining({ show: false }),
          }),
        }),
      }),
    );
  });
});

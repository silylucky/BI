import { type ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartInspectorProvider } from "../ChartInspectorProvider";
import type { LayoutWidget } from "../layoutUtils";
import {
  ChartCirclePackingShapeSection,
  ChartSankeyShapeSection,
  ChartTreemapShapeSection,
  ChartWordCloudShapeSection,
} from "./ChartTypeStyleSections";

function chartWidget(chartType: string): LayoutWidget {
  return {
    id: `w-${chartType}`,
    type: "chart",
    title: "样式测试",
    order: 1,
    colSpan: 6,
    rowSpan: 4,
    chartConfig: {
      chartType,
      styleVariant: "default",
      mode: "sql",
      dataSourceId: "00000000-0000-4000-8000-000000000001",
      sql: "SELECT 1",
      dimensions: [{ field: "category" }],
      metrics: [{ field: "amount" }],
    },
  };
}

function renderShapeSection(ui: ReactElement, widget: LayoutWidget, onChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onChange,
    ...render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={widget} onChange={onChange}>
          {ui}
        </ChartInspectorProvider>
      </QueryClientProvider>,
    ),
  };
}

async function expandSection(title: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: title }));
}

afterEach(cleanup);

describe("ChartTypeStyleSections UI wiring", () => {
  it("treemap inner padding slider patches deStyle.treemap", async () => {
    const onChange = vi.fn();
    renderShapeSection(<ChartTreemapShapeSection />, chartWidget("treemap"), onChange);
    await expandSection(/矩形树图样式/i);

    const slider = await screen.findByRole("slider", { name: "内间距" });
    fireEvent.change(slider, { target: { value: "8" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            deStyle: expect.objectContaining({
              treemap: expect.objectContaining({ paddingInner: 8 }),
            }),
          }),
        }),
      );
    });
  });

  it("sankey node width slider patches deStyle.sankey", async () => {
    const onChange = vi.fn();
    renderShapeSection(<ChartSankeyShapeSection />, chartWidget("sankey"), onChange);
    await expandSection(/桑基样式/i);

    const slider = await screen.findByRole("slider", { name: "节点宽度" });
    fireEvent.change(slider, { target: { value: "20" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            deStyle: expect.objectContaining({
              sankey: expect.objectContaining({ nodeWidth: 20 }),
            }),
          }),
        }),
      );
    });
  });

  it("word cloud min font slider patches deStyle.wordCloud", async () => {
    const onChange = vi.fn();
    renderShapeSection(<ChartWordCloudShapeSection />, chartWidget("word-cloud"), onChange);
    await expandSection(/词云样式/i);

    const slider = await screen.findByRole("slider", { name: "最小字号" });
    fireEvent.change(slider, { target: { value: "14" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            deStyle: expect.objectContaining({
              wordCloud: expect.objectContaining({ fontSizeMin: 14 }),
            }),
          }),
        }),
      );
    });
  });

  it("circle packing layout padding slider patches deStyle.circlePacking", async () => {
    const onChange = vi.fn();
    renderShapeSection(
      <ChartCirclePackingShapeSection />,
      chartWidget("circle-packing"),
      onChange,
    );
    await expandSection(/圆形填充样式/i);

    const slider = await screen.findByRole("slider", { name: "布局间距" });
    fireEvent.change(slider, { target: { value: "6" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            deStyle: expect.objectContaining({
              circlePacking: expect.objectContaining({ layoutPadding: 6 }),
            }),
          }),
        }),
      );
    });
  });
});

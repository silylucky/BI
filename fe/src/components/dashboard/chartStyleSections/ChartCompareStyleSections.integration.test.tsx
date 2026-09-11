import { type ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChartInspectorProvider } from "../ChartInspectorProvider";
import type { LayoutWidget } from "../layoutUtils";
import {
  ChartBulletShapeSection,
  ChartProgressBarShapeSection,
  ChartQuadrantShapeSection,
  ChartStockLineShapeSection,
} from "./ChartCompareStyleSections";

function widgetFor(chartType: string): LayoutWidget {
  return {
    id: `w-${chartType}`,
    type: "chart",
    title: "对比样式",
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

function renderSection(ui: ReactElement, chartType: string, onChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    onChange,
    ...render(
      <QueryClientProvider client={qc}>
        <ChartInspectorProvider widget={widgetFor(chartType)} onChange={onChange}>
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

describe("ChartCompareStyleSections UI wiring", () => {
  it("quadrant line width slider patches deStyle.quadrant", async () => {
    const onChange = vi.fn();
    renderSection(<ChartQuadrantShapeSection />, "quadrant", onChange);
    await expandSection(/象限样式/i);

    const slider = await screen.findByRole("slider", { name: "线宽" });
    fireEvent.change(slider, { target: { value: "3" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            deStyle: expect.objectContaining({
              quadrant: expect.objectContaining({ lineWidth: 3 }),
            }),
          }),
        }),
      );
    });
  });

  it("progress bar track opacity slider patches deStyle.progressBar", async () => {
    const onChange = vi.fn();
    renderSection(<ChartProgressBarShapeSection />, "progress-bar", onChange);
    await expandSection(/进度条样式/i);

    const slider = await screen.findByRole("slider", { name: "轨道透明度" });
    fireEvent.change(slider, { target: { value: "0.55" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            deStyle: expect.objectContaining({
              progressBar: expect.objectContaining({ trackOpacity: 0.55 }),
            }),
          }),
        }),
      );
    });
  });

  it("bullet target line width slider patches deStyle.bullet", async () => {
    const onChange = vi.fn();
    renderSection(<ChartBulletShapeSection />, "bullet-graph", onChange);
    await expandSection(/子弹图样式/i);

    const slider = await screen.findByRole("slider", { name: "目标线宽度" });
    fireEvent.change(slider, { target: { value: "4" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            deStyle: expect.objectContaining({
              bullet: expect.objectContaining({ targetLineWidth: 4 }),
            }),
          }),
        }),
      );
    });
  });

  it("stock line body width ratio slider patches deStyle.stockLine", async () => {
    const onChange = vi.fn();
    renderSection(<ChartStockLineShapeSection />, "stock-line", onChange);
    await expandSection(/K 线样式/i);

    const slider = await screen.findByRole("slider", { name: "实体宽度比" });
    fireEvent.change(slider, { target: { value: "0.7" } });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          nativeBody: expect.objectContaining({
            deStyle: expect.objectContaining({
              stockLine: expect.objectContaining({ bodyWidthRatio: 0.7 }),
            }),
          }),
        }),
      );
    });
  });
});

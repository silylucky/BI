import { useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { ChartInspectorProvider } from "./ChartInspectorProvider";
import { ChartStylePanel } from "./ChartStylePanel";
import type { LayoutWidget } from "./layoutUtils";
import { readChartDeStyle } from "@/lib/chartDeStyle";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    apiFetch: vi.fn().mockResolvedValue({ items: [] }),
  };
});

vi.mock("@/lib/chartRegistry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chartRegistry")>();
  return {
    ...actual,
    fetchChartTypeCatalog: vi.fn().mockResolvedValue([
      {
        type: "bar",
        displayName: "柱状图",
        category: "basic",
        renderer: "antv",
        styleVariants: ["default", "stacked"],
        fieldRule: {},
      },
    ]),
  };
});

vi.mock("@/lib/datasetChartBinding", () => ({
  resolveDatasetChartBinding: vi.fn().mockImplementation(
    () =>
      new Promise((resolve) => {
        setTimeout(() => resolve({ dataSourceId: "ds-bound" }), 50);
      }),
  ),
}));

const sqlWidget: LayoutWidget = {
  id: "w-sql",
  type: "chart",
  title: "SQL 图",
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

const datasetWidget: LayoutWidget = {
  ...sqlWidget,
  id: "w-ds",
  chartConfig: {
    chartType: "bar",
    styleVariant: "default",
    mode: "dataset",
    datasetId: "ds-1",
    dimensions: [{ field: "region" }],
    metrics: [{ field: "amount" }],
  },
};

function PaletteHarness({ initialWidget }: { initialWidget: LayoutWidget }) {
  const [widget, setWidget] = useState(initialWidget);
  const qc = useMemo(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    [],
  );

  return (
    <QueryClientProvider client={qc}>
      <ChartInspectorProvider
        widget={widget}
        onChange={(chartConfig) => setWidget((prev) => ({ ...prev, chartConfig }))}
      >
        <ChartStylePanel />
      </ChartInspectorProvider>
    </QueryClientProvider>
  );
}

afterEach(cleanup);

describe("ChartInspectorProvider palette persistence", () => {
  it("re-renders current display after selecting a preset in dense inline menu", async () => {
    const user = userEvent.setup();
    render(<PaletteHarness initialWidget={sqlWidget} />);

    await user.click(screen.getByRole("button", { name: "配色方案" }));
    await user.click(screen.getByRole("option", { name: /清透/ }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "配色方案" })).toHaveTextContent("清透");
    });
    expect(screen.queryByTestId("chart-palette-inline-menu-panel")).not.toBeInTheDocument();
  });

  it("keeps paletteId after delayed dataset binding sync completes", async () => {
    vi.mocked(apiFetch).mockImplementation((url: string) => {
      if (url.includes("/datasets")) {
        return Promise.resolve({
          items: [{ datasetId: "ds-1", displayName: "销售", boundConfigId: "cfg-1" }],
        });
      }
      return Promise.resolve({ items: [] });
    });

    const user = userEvent.setup();
    render(<PaletteHarness initialWidget={datasetWidget} />);

    await user.click(screen.getByRole("button", { name: "配色方案" }));
    await user.click(screen.getByRole("option", { name: /浅韵/ }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "配色方案" })).toHaveTextContent("浅韵");
    });

    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: "配色方案" })).toHaveTextContent("浅韵");
      },
      { timeout: 300 },
    );
    expect(screen.queryByTestId("chart-palette-inline-menu-panel")).not.toBeInTheDocument();
  });
});

function PaletteProbe() {
  const [widget, setWidget] = useState(sqlWidget);
  const latestRef = useMemo(() => ({ current: sqlWidget as LayoutWidget }), []);

  return (
    <ChartInspectorProvider
      widget={widget}
      onChange={(chartConfig) => {
        setWidget((prev) => {
          const next = { ...prev, chartConfig };
          latestRef.current = next;
          return next;
        });
      }}
    >
      <ChartStylePanel />
      <span data-testid="palette-id-probe">
        {readChartDeStyle(widget.chartConfig!).paletteId ?? ""}
      </span>
    </ChartInspectorProvider>
  );
}

describe("readChartDeStyle after palette patch", () => {
  it("stores paletteId on nativeBody.deStyle", async () => {
    const user = userEvent.setup();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={qc}>
        <PaletteProbe />
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole("button", { name: "配色方案" }));
    await user.click(screen.getByRole("option", { name: /政企/ }));
    await waitFor(() => {
      expect(screen.getByTestId("palette-id-probe")).toHaveTextContent("enterprise");
    });
  });
});

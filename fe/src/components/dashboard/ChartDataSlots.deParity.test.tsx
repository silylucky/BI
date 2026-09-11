import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "@/components/charts/engine/plugins/index";
import { BUILTIN_PLUGIN_DEFS } from "@/components/charts/engine/plugins/metadata";
import { ChartDataSlots } from "./ChartDataSlots";
import { chartDataSlotBlueprint } from "./chartFieldSlots";

const ACTIVE_TYPES = BUILTIN_PLUGIN_DEFS.filter((d) => !d.deprecated).map((d) => d.type);

const inspectorState = {
  chartType: "line" as string,
};

vi.mock("./chartInspectorContext", () => ({
  useChartInspector: () => ({
    cfg: { chartType: inspectorState.chartType, dimensions: [], metrics: [], axes: {} },
    onChange: vi.fn(),
    columns: ["sale_date", "region", "amount"],
    columnsLoading: false,
    columnsReady: true,
    activeSlot: null,
    setActiveSlot: vi.fn(),
    assignField: vi.fn(),
    fieldAssignError: null,
    clearFieldAssignError: vi.fn(),
  }),
}));

describe("ChartDataSlots DE parity UI", () => {
  it.each(ACTIVE_TYPES.map((t) => [t] as const))(
    "T-INSP-UI %s: renders DE slot labels in data tab",
    (chartType) => {
      inspectorState.chartType = chartType;
      render(<ChartDataSlots hideMapHint />);
      const root = screen.getByTestId(`chart-data-slots-${chartType}`);
      const labels = chartDataSlotBlueprint(chartType).map((s) => s.label);
      for (const label of labels) {
        expect(within(root).getByText(label, { exact: true })).toBeInTheDocument();
      }
      cleanup();
    },
  );
});

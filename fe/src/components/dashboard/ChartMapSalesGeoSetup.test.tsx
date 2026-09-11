import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChartMapSalesGeoSetup } from "./ChartMapSalesGeoSetup";
import { DEMO_SALES_GEO_DATASET_ID } from "@/lib/mapChartSalesGeo";
import { fieldAtSlot } from "@/lib/resolveChartEncoding";

const onChange = vi.fn();

vi.mock("./chartInspectorContext", () => ({
  useChartInspector: () => ({
    cfg: { chartType: "map", dimensions: [], metrics: [], axes: { yAxis: [{ field: "amount" }] } },
    onChange,
    datasourceItems: [{ id: "ds-sample", name: "sample-mysql", code: "sample-mysql-3307" }],
    datasourcesEmpty: false,
  }),
}));

describe("ChartMapSalesGeoSetup", () => {
  it("applies sales geo config on click", async () => {
    const user = userEvent.setup();
    render(<ChartMapSalesGeoSetup />);
    await user.click(screen.getByRole("button", { name: /接入 sample_db · v_sales_geo/ }));
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.datasetId).toBe(DEMO_SALES_GEO_DATASET_ID);
    expect(next.dataSourceId).toBe("ds-sample");
    expect(fieldAtSlot(next, { axisId: "xAxis", index: 0 })).toBe("province");
    expect(fieldAtSlot(next, { axisId: "yAxis", index: 0 })).toBe("amount");
    expect(fieldAtSlot(next, { axisId: "drill", index: 0 })).toBe("city");
    expect(fieldAtSlot(next, { axisId: "drill", index: 1 })).toBe("district");
  });
});

import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInspectorColumns } from "@/hooks/useInspectorColumns";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";

const fetchDatasetQueryConfigMock = vi.fn();

vi.mock("@/lib/datasetChartBinding", () => ({
  fetchDatasetQueryConfig: (...args: unknown[]) => fetchDatasetQueryConfigMock(...args),
}));

describe("useInspectorColumns", () => {
  beforeEach(() => {
    fetchDatasetQueryConfigMock.mockReset();
  });

  it("loads columns from dataset_query config without dataset execute", async () => {
    fetchDatasetQueryConfigMock.mockResolvedValue({
      configId: "cfg-1",
      columns: ["region_name", "amount", "sale_date"],
    });

    const cfg = {
      ...defaultChartConfig("line"),
      mode: "dataset" as const,
      configId: "cfg-1",
    };

    const { result } = renderHook(() => useInspectorColumns(cfg));

    await waitFor(() => {
      expect(result.current.ready).toBe(true);
      expect(result.current.columns).toEqual(["region_name", "amount", "sale_date"]);
    });

    expect(fetchDatasetQueryConfigMock).toHaveBeenCalledWith("cfg-1");
  });

  it("clears columns when configId is missing", async () => {
    const cfg = {
      ...defaultChartConfig("line"),
      mode: "dataset" as const,
      configId: undefined,
    };

    const { result } = renderHook(() => useInspectorColumns(cfg));

    await waitFor(() => {
      expect(result.current.ready).toBe(false);
      expect(result.current.columns).toEqual([]);
    });

    expect(fetchDatasetQueryConfigMock).not.toHaveBeenCalled();
  });
});

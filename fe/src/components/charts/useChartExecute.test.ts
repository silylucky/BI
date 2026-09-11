import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { chartExecuteBindingKey, chartExecuteRequestKey } from "@/lib/chartExecuteProbe";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import { patchChartDeStyle } from "@/lib/chartDeStyle";
import { useChartExecute } from "./useChartExecute";

const { fetchChartExecuteResult } = vi.hoisted(() => ({
  fetchChartExecuteResult: vi.fn(async () => ({
    columns: ["a"],
    rows: [[1] as (string | number | boolean | null)[]],
  })),
}));

vi.mock("@/lib/chartExecuteProbe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/chartExecuteProbe")>();
  return {
    ...actual,
    fetchChartExecuteResult,
    fetchChartExecuteResultShared: (
      config: Parameters<typeof actual.fetchChartExecuteResultShared>[0],
      options?: Parameters<typeof actual.fetchChartExecuteResultShared>[1],
    ) => fetchChartExecuteResult(config, options),
  };
});

beforeEach(() => {
  fetchChartExecuteResult.mockClear();
});

describe("chartExecuteBindingKey", () => {
  it("is stable across object identity changes with the same payload", () => {
    const base = {
      ...defaultChartConfig("line"),
      dataSourceId: "ds-1",
      mode: "sql" as const,
      sql: "SELECT 1",
    };
    const filters = { region: "east" };
    expect(chartExecuteBindingKey({ ...base }, { ...filters })).toBe(
      chartExecuteBindingKey({ ...base }, { ...filters }),
    );
    expect(chartExecuteRequestKey({ ...base }, { ...filters })).toBe(
      chartExecuteBindingKey({ ...base }, { ...filters }),
    );
  });

  it("ignores deStyle presentation patches for dataset binding", () => {
    const base = {
      ...defaultChartConfig("table"),
      mode: "dataset" as const,
      dataSourceId: "ds-1",
      configId: "cfg-1",
    };
    const styled = patchChartDeStyle(base, { legend: { show: true, position: "top" } });
    expect(chartExecuteBindingKey(base)).toBe(chartExecuteBindingKey(styled));
  });
});

describe("useChartExecute", () => {
  it("does not refetch when parent passes new object references with the same query", async () => {
    const base = {
      ...defaultChartConfig("line"),
      chartId: "w1",
      dataSourceId: "ds-1",
      mode: "dataset" as const,
      configId: "cfg-1",
    };
    const filterParameters = { region: "east" };

    const { rerender } = renderHook(
      ({ config, filterParameters: filters }) => useChartExecute(config, { filterParameters: filters }),
      {
        initialProps: {
          config: { ...base },
          filterParameters: { ...filterParameters },
        },
      },
    );

    await waitFor(() => expect(fetchChartExecuteResult).toHaveBeenCalledTimes(1));

    rerender({
      config: { ...base },
      filterParameters: { ...filterParameters },
    });

    await waitFor(() => expect(fetchChartExecuteResult).toHaveBeenCalledTimes(1));
  });

  it("does not refetch when only deStyle presentation changes", async () => {
    const base = {
      ...defaultChartConfig("table"),
      chartId: "w-table",
      dataSourceId: "ds-1",
      mode: "dataset" as const,
      configId: "cfg-1",
    };

    const { rerender } = renderHook(({ config }) => useChartExecute(config), {
      initialProps: { config: base },
    });

    await waitFor(() => expect(fetchChartExecuteResult).toHaveBeenCalledTimes(1));

    rerender({
      config: patchChartDeStyle(base, { legend: { show: false } }),
    });

    await waitFor(() => expect(fetchChartExecuteResult).toHaveBeenCalledTimes(1));
  });

  it("does not call execute when chart binding is not ready", async () => {
    const config = {
      ...defaultChartConfig("line"),
      mode: "dataset" as const,
      dataSourceId: "",
      configId: "",
    };

    const { result } = renderHook(() => useChartExecute(config));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchChartExecuteResult).not.toHaveBeenCalled();
    expect(result.current.error).toBe("请绑定数据集");
  });

  it("refetches when result limit changes", async () => {
    const base = {
      ...defaultChartConfig("bar"),
      chartId: "w-bar",
      dataSourceId: "ds-1",
      mode: "dataset" as const,
      configId: "cfg-1",
    };

    const { rerender } = renderHook(
      ({ limit }) => useChartExecute(base, { limit }),
      { initialProps: { limit: 1000 } },
    );

    await waitFor(() => expect(fetchChartExecuteResult).toHaveBeenCalledTimes(1));
    expect(fetchChartExecuteResult.mock.calls[0][1]).toMatchObject({ limit: 1000 });

    rerender({ limit: 11 });

    await waitFor(() => expect(fetchChartExecuteResult).toHaveBeenCalledTimes(2));
    expect(fetchChartExecuteResult.mock.calls[1][1]).toMatchObject({ limit: 11 });
  });
});

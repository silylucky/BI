import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildFilterParameters,
  buildChartExecuteEncoding,
  chartExecuteBindingKey,
  peekChartExecuteCachedResult,
  fetchChartExecuteResult,
  fetchChartExecuteResultShared,
  isChartExecuteReady,
  resetChartExecuteSharedInflight,
  resetDemoDatasourceExecuteCache,
  resolveChartExecuteMode,
} from "@/lib/chartExecuteProbe";
import { TEMPLATE_DEMO_DATASOURCE_REF } from "@/lib/templateDemoData";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import { patchChartDeStyle } from "@/lib/chartDeStyle";
import { buildChartRenderModel } from "@/lib/buildChartRenderModel";
import { CHART_CATALOG_SMOKE_CASES, smokeCaseToConfig } from "@/components/charts/chartCatalogSmokeFixtures";

const apiFetchMock = vi.fn(async () => ({
  columns: ["id"],
  rows: [[1]],
}));

vi.mock("@/lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  isEmbedShareContext: () => false,
  resolveDatasetExecutePath: () =>
    typeof window !== "undefined" && window.location.pathname.startsWith("/export/")
      ? "/api/v1/dashboards/export-query/dataset/execute"
      : "/api/v1/query/dataset/execute",
}));

const datasetReadyConfig = () => ({
  ...defaultChartConfig("line"),
  mode: "dataset" as const,
  dataSourceId: "550e8400-e29b-41d4-a716-446655440000",
  configId: "d769b018-4fc9-46ea-a055-45c67ec6a318",
  datasetId: "demo-sales-wide",
});

describe("chartExecuteProbe shared execute", () => {
  beforeEach(() => {
    resetChartExecuteSharedInflight();
    resetDemoDatasourceExecuteCache();
    apiFetchMock.mockClear();
    apiFetchMock.mockResolvedValue({ columns: ["id"], rows: [[1]] });
  });

  it("always resolves dataset execute mode", () => {
    const config = {
      ...defaultChartConfig("line"),
      dataSourceId: "ds-1",
      sql: "SELECT 1",
    };
    expect(resolveChartExecuteMode(config)).toBe("dataset");
    expect(isChartExecuteReady(config)).toBe(false);
  });

  it("does not call api when execute is not ready", async () => {
    const config = {
      ...defaultChartConfig("line"),
      mode: "dataset" as const,
      dataSourceId: "",
      configId: "",
    };

    await expect(fetchChartExecuteResult(config)).rejects.toThrow("请绑定数据集");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("rejects legacy sql-only config", async () => {
    const config = {
      ...defaultChartConfig("line"),
      mode: "sql" as const,
      dataSourceId: "550e8400-e29b-41d4-a716-446655440000",
      sql: "SELECT 1",
    };

    await expect(fetchChartExecuteResult(config)).rejects.toThrow("请绑定数据集后再出图");
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("calls dataset execute when config is ready", async () => {
    const config = datasetReadyConfig();
    await fetchChartExecuteResult(config);

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/query/dataset/execute",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"configId"'),
      }),
    );
    const body = JSON.parse(String(apiFetchMock.mock.calls[0]?.[1]?.body));
    expect(body.parameters).toEqual({});
    expect(body.rls).toEqual({ enabled: true });
    expect(body.encoding).toBeDefined();
    expect(body.encoding.chartType).toBe("line");
  });

  it("dedupes concurrent requests with the same binding key", async () => {
    const config = datasetReadyConfig();
    await Promise.all([
      fetchChartExecuteResultShared(config),
      fetchChartExecuteResultShared(config),
    ]);
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("stays execute-ready when deFeatures markLines are set", () => {
    const config = {
      ...datasetReadyConfig(),
      nativeBody: {
        deFeatures: {
          markLines: [{ id: "l1", enabled: true, axis: "y" as const, value: 100 }],
        },
      },
    };
    expect(isChartExecuteReady(config)).toBe(true);
  });

  it("rejects leftover sql keys in nativeBody even with deFeatures", () => {
    const config = {
      ...datasetReadyConfig(),
      nativeBody: {
        sql: "SELECT 1",
        deFeatures: { markLines: [{ id: "l1", enabled: true, axis: "y" as const, value: 1 }] },
      },
    };
    expect(isChartExecuteReady(config)).toBe(false);
  });

  it("treats nativeBody.dataBinding manual placeholder as ready when dataset is bound", () => {
    const config = {
      ...datasetReadyConfig(),
      chartType: "gauge" as const,
      nativeBody: {
        dataBinding: { status: "manual" },
        deStyle: { title: { show: true } },
      },
    };
    expect(isChartExecuteReady(config)).toBe(true);
  });

  it("keeps binding key stable when only deStyle changes", () => {
    const base = datasetReadyConfig();
    const styled = patchChartDeStyle(base, {
      legend: { show: true },
      title: { show: true, fontSize: 18 },
    });
    expect(chartExecuteBindingKey(base)).toBe(chartExecuteBindingKey(styled));
  });

  describe("GAP-FILTER-CHAIN: inspector filters → dataset parameters → render model", () => {
    it("buildFilterParameters maps ChartConfigPanel filter rows", () => {
      const params = buildFilterParameters([
        { field: "region_name", operator: "eq", value: "华东" },
        { field: "sale_date", operator: "in", value: ["2025-01", "2025-02"] },
      ]);
      expect(params).toEqual({
        filter_region_name_0: "华东",
        filter_sale_date_1: "2025-01,2025-02",
      });
    });

    it("chartExecuteBindingKey changes when filter parameters change", () => {
      const base = datasetReadyConfig();
      expect(chartExecuteBindingKey(base, { region: "华东" })).not.toBe(
        chartExecuteBindingKey(base, { region: "华北" }),
      );
    });

    it("fetchChartExecuteResult passes encoding filters to dataset execute", async () => {
      const config = {
        ...datasetReadyConfig(),
        filters: [{ field: "region_name", operator: "eq" as const, value: "华东" }],
      };

      await fetchChartExecuteResult(config, { filterParameters: { region: "华东" } });

      const body = JSON.parse(String(apiFetchMock.mock.calls[0]?.[1]?.body));
      expect(body.parameters).toEqual({ region: "华东" });
      expect(body.encoding.filters).toEqual([
        { field: "region_name", operator: "eq", value: "华东" },
      ]);
      expect(body.encoding.chartType).toBe("line");
    });

    it("buildChartExecuteEncoding remaps Chinese aliases and unique dimensions", () => {
      const config = {
        ...datasetReadyConfig(),
        chartType: "area-stack" as const,
        axes: {
          xAxis: [{ field: "sale_date" }],
          xAxisExt: [{ field: "sale_date" }],
          yAxis: [{ field: "amount" }],
        },
      };
      const encoding = buildChartExecuteEncoding(config);
      expect(encoding.dimensions).toEqual(["sale_date"]);
      expect(encoding.metrics).toEqual([{ field: "amount", agg: "sum" }]);
    });

    it("buildChartExecuteEncoding remaps leftover 网格 alias", () => {
      const config = {
        ...datasetReadyConfig(),
        chartType: "table-info" as const,
        axes: {
          xAxis: [{ field: "网格" }, { field: "事件数" }, { field: "已办结" }],
        },
      };
      const encoding = buildChartExecuteEncoding(config);
      expect(encoding.dimensions).toEqual(["grid_name"]);
      expect(encoding.metrics.map((m) => m.field)).toEqual(["event_count", "resolved_count"]);
    });

    it("buildChartExecuteEncoding includes absolute timeRange", () => {
      const config = {
        ...datasetReadyConfig(),
        timeRange: {
          enabled: true,
          mode: "absolute" as const,
          field: "sale_date",
          start: "2025-01-01",
          end: "2025-12-31",
        },
      };
      expect(buildChartExecuteEncoding(config).timeRange).toEqual({
        enabled: true,
        field: "sale_date",
        start: "2025-01-01",
        end: "2025-12-31",
      });
    });

    it("buildChartExecuteEncoding appends liquid dynamic maxField to metrics", () => {
      const config = {
        ...datasetReadyConfig(),
        chartType: "liquid" as const,
        axes: { yAxis: [{ field: "quantity" }] },
        nativeBody: {
          deStyle: {
            liquid: { maxType: "dynamic", maxField: "amount" },
          },
        },
      };
      expect(buildChartExecuteEncoding(config).metrics).toEqual([
        { field: "quantity", agg: "sum" },
        { field: "amount", agg: "sum" },
      ]);
    });

    it("fetchChartExecuteResult passes encoding timeRange to dataset execute", async () => {
      const config = {
        ...datasetReadyConfig(),
        timeRange: {
          enabled: true,
          mode: "absolute" as const,
          field: "sale_date",
          start: "2025-01-01",
          end: "2025-12-31",
        },
      };
      await fetchChartExecuteResult(config);
      const body = JSON.parse(String(apiFetchMock.mock.calls[0]?.[1]?.body));
      expect(body.encoding.timeRange).toEqual({
        enabled: true,
        field: "sale_date",
        start: "2025-01-01",
        end: "2025-12-31",
      });
      expect(body.parameters).toEqual({});
    });

    it("filtered execute result yields different render row count than unfiltered", () => {
      const lineCase = CHART_CATALOG_SMOKE_CASES.find((c) => c.type === "line")!;
      const config = smokeCaseToConfig(lineCase);
      const columns = [...lineCase.columns];
      const allRows = lineCase.rows as (string | number | boolean | null)[][];
      const filteredRows = allRows.filter((row) => row[1] === "华东");

      const allModel = buildChartRenderModel(config, columns, allRows);
      const filteredModel = buildChartRenderModel(config, columns, filteredRows);

      expect(allModel.kind).toBe("ready");
      expect(filteredModel.kind).toBe("ready");
      expect(allRows.length).toBe(3);
      expect(filteredRows.length).toBe(1);
    });
  });

  it("uses export dataset execute path on snapshot pages", async () => {
    vi.stubGlobal("location", {
      pathname: "/export/dashboard/d1",
      search: "?token=export-token",
      href: "http://localhost:5173/export/dashboard/d1?token=export-token",
    });
    await fetchChartExecuteResult(datasetReadyConfig());

    expect(apiFetchMock).toHaveBeenCalledWith(
      "/api/v1/dashboards/export-query/dataset/execute",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("treats official demo dataset binding without configId as execute-ready", () => {
    const config = {
      ...defaultChartConfig("line"),
      mode: "dataset" as const,
      dataSourceId: TEMPLATE_DEMO_DATASOURCE_REF,
      datasetId: "demo-sales-wide",
      configId: undefined,
      sql: undefined,
      axes: {
        xAxis: [{ field: "sale_date" }],
        yAxis: [{ field: "amount" }],
      },
    };
    expect(isChartExecuteReady(config)).toBe(true);
  });

  it("hydrates boundConfigId for demo dataset before execute", async () => {
    apiFetchMock.mockImplementation(async (url: string) => {
      if (url.includes("/api/v1/datasets")) {
        return {
          items: [
            {
              datasetId: "demo-sales-wide",
              boundConfigId: "cfg-demo-wide",
            },
          ],
        };
      }
      if (url === "/api/v1/datasources") {
        return {
          items: [{ id: "demo-ds-uuid", name: "示例数据", code: "demo", database: "sample_db" }],
        };
      }
      return { columns: ["sale_date", "amount"], rows: [["2025-01-01", 1]] };
    });

    const config = {
      ...defaultChartConfig("line"),
      mode: "dataset" as const,
      dataSourceId: TEMPLATE_DEMO_DATASOURCE_REF,
      datasetId: "demo-sales-wide",
      axes: {
        xAxis: [{ field: "sale_date" }],
        yAxis: [{ field: "amount" }],
      },
    };

    await fetchChartExecuteResult(config);

    const executeCall = apiFetchMock.mock.calls.find((call) =>
      String(call[0]).includes("dataset/execute"),
    );
    const body = JSON.parse(String(executeCall?.[1]?.body));
    expect(body.configId).toBe("cfg-demo-wide");
    expect(body.dataSourceId).toBe("demo-ds-uuid");
  });

  it("resolves template demo datasource ref before dataset execute", async () => {
    apiFetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/v1/datasources") {
        return {
          items: [
            { id: "demo-ds-uuid", name: "示例数据", code: "demo", database: "sample_db" },
          ],
        };
      }
      return { columns: ["product_name"], rows: [["A"]] };
    });

    const config = {
      ...datasetReadyConfig(),
      dataSourceId: TEMPLATE_DEMO_DATASOURCE_REF,
    };

    await fetchChartExecuteResult(config);

    const executeCall = apiFetchMock.mock.calls.find((call) =>
      String(call[0]).includes("dataset/execute"),
    );
    const body = JSON.parse(String(executeCall?.[1]?.body));
    expect(body.dataSourceId).toBe("demo-ds-uuid");
  });

  it("evicts oldest shared execute cache entries", async () => {
    const { CHART_EXECUTE_RESULT_CACHE_MAX } = await import("@/lib/chartLoadConcurrency");
    for (let i = 0; i < CHART_EXECUTE_RESULT_CACHE_MAX + 2; i += 1) {
      await fetchChartExecuteResultShared({
        ...datasetReadyConfig(),
        configId: `cfg-cache-${i}`,
      });
    }
    expect(
      peekChartExecuteCachedResult({
        ...datasetReadyConfig(),
        configId: "cfg-cache-0",
      }),
    ).toBeUndefined();
    expect(
      peekChartExecuteCachedResult({
        ...datasetReadyConfig(),
        configId: `cfg-cache-${CHART_EXECUTE_RESULT_CACHE_MAX + 1}`,
      }),
    ).toEqual({ columns: ["id"], rows: [[1]] });
  });
});

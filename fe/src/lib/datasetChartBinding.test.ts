import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  buildDatasetQueryPayload,
  saveAndBindDatasetQueryConfig,
  resolveDatasetChartBinding,
} from "./datasetChartBinding";
import { parseQualifiedTable } from "./datasetTableUtils";

const mockApiFetch = vi.fn();
const mockResetCache = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));
vi.mock("@/lib/chartExecuteProbe", () => ({
  resetChartExecuteSharedInflight: () => mockResetCache(),
}));

describe("parseQualifiedTable", () => {
  it("splits schema.table", () => {
    expect(parseQualifiedTable("sample_db.sales")).toEqual({
      schema: "sample_db",
      table: "sales",
    });
  });

  it("handles bare table name", () => {
    expect(parseQualifiedTable("orders")).toEqual({ schema: "", table: "orders" });
  });
});

describe("buildDatasetQueryPayload", () => {
  it("builds dataset_query payload", () => {
    const payload = buildDatasetQueryPayload({
      dataSourceId: "ds-1",
      connectorType: "mysql",
      schema: "demo",
      table: "orders",
      columns: ["id", "amount"],
    });
    expect(payload.dataSourceId).toBe("ds-1");
    expect(payload.columns).toEqual(["id", "amount"]);
    expect(payload.conditions.logic).toBe("AND");
  });

  it("includes columnKinds filtered to selected columns", () => {
    const payload = buildDatasetQueryPayload({
      dataSourceId: "ds-1",
      connectorType: "mysql",
      schema: "demo",
      table: "orders",
      columns: ["id", "amount"],
      columnKinds: { id: "dimension", amount: "metric", extra: "dimension" },
    });
    expect(payload.columnKinds).toEqual({ id: "dimension", amount: "metric" });
  });
});

describe("resolveDatasetChartBinding", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("reads dataSourceId from config payload", async () => {
    mockApiFetch.mockResolvedValue({
      id: "cfg-1",
      revision: 2,
      configType: "dataset_query",
      payload: { dataSourceId: "ds-mysql" },
    });
    const binding = await resolveDatasetChartBinding("cfg-1");
    expect(binding).toEqual({
      configId: "cfg-1",
      revision: 2,
      dataSourceId: "ds-mysql",
      columns: [],
      columnKinds: undefined,
      schema: undefined,
      table: undefined,
    });
    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/query/configs/cfg-1");
  });
});

describe("saveAndBindDatasetQueryConfig", () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockResetCache.mockClear();
    vi.stubGlobal("crypto", { randomUUID: () => "00000000-0000-4000-8000-000000000001" });
  });

  it("PUT config then POST bind for first bind", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ id: "cfg-new", revision: 1 })
      .mockResolvedValueOnce({ boundConfigId: "cfg-new" });

    const result = await saveAndBindDatasetQueryConfig({
      datasetId: "ds-demo",
      dataSourceId: "ds-1",
      connectorType: "mysql",
      tableName: "public.orders",
      columns: ["id"],
    });

    expect(result).toEqual({ configId: "cfg-new", revision: 1 });
    expect(mockResetCache).toHaveBeenCalled();
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      1,
      "/api/v1/query/configs",
      expect.objectContaining({ method: "PUT" }),
    );
    expect(mockApiFetch).toHaveBeenNthCalledWith(
      2,
      "/api/v1/datasets/ds-demo/bind-query-config",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("reuses ref on re-bind and skips POST when config id unchanged", async () => {
    mockApiFetch
      .mockResolvedValueOnce({
        id: "cfg-bound",
        revision: 1,
        configType: "dataset_query",
        refType: "dataset",
        refId: "11111111-1111-4111-8111-111111111111",
        payload: {},
      })
      .mockResolvedValueOnce({ id: "cfg-bound", revision: 2 });

    const result = await saveAndBindDatasetQueryConfig({
      datasetId: "orders_clean_3",
      boundConfigId: "cfg-bound",
      dataSourceId: "ds-analytics",
      connectorType: "postgresql",
      tableName: "public.orders_clean_3",
      columns: ["id", "amount"],
    });

    expect(result).toEqual({ configId: "cfg-bound", revision: 2 });
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    expect(mockResetCache).toHaveBeenCalled();
  });
});

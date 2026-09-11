import { describe, expect, it } from "vitest";
import {
  isManagedAnalyticsDatasource,
  isSyncFetchImplemented,
  isSyncSourceCapable,
} from "./datasourceRoles";

describe("datasourceRoles sync capabilities", () => {
  it("sync fetch implemented covers mysql/pg families and native file sources", () => {
    expect(isSyncFetchImplemented("mysql")).toBe(true);
    expect(isSyncFetchImplemented("kingbase")).toBe(true);
    expect(isSyncFetchImplemented("csv")).toBe(true);
  });

  it("sync fetch not implemented for metadata-only and pending sql dialects", () => {
    expect(isSyncFetchImplemented("clickhouse")).toBe(true);
    expect(isSyncFetchImplemented("hive")).toBe(true);
    expect(isSyncFetchImplemented("influxdb")).toBe(true);
  });

  it("sync source capable is superset of sync fetch implemented", () => {
    for (const type of ["mysql", "csv", "clickhouse"] as const) {
      if (isSyncFetchImplemented(type)) {
        expect(isSyncSourceCapable(type)).toBe(true);
      }
    }
  });

  it("treats code=analytics and 5433/analytics PG as managed analytics", () => {
    expect(isManagedAnalyticsDatasource({ code: "analytics" })).toBe(true);
    expect(
      isManagedAnalyticsDatasource({
        type: "postgresql",
        port: 5433,
        database: "analytics",
      }),
    ).toBe(true);
    expect(isManagedAnalyticsDatasource({ code: "demo", type: "mysql" })).toBe(false);
  });
});

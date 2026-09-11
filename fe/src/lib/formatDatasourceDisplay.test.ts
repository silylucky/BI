import { describe, expect, it } from "vitest";
import { formatDatasourceEndpoint, formatSyncDatasourceDisplay, formatSyncDatasourceStructured } from "./formatDatasourceDisplay";

describe("formatDatasourceDisplay", () => {
  it("formats full postgres analytics connection from datasource fields", () => {
    expect(
      formatDatasourceEndpoint({
        name: "test1",
        code: "analyticsq1",
        type: "postgresql",
        host: "127.0.0.1",
        port: 5433,
        database: "analytics",
      }),
    ).toBe("postgresql · 127.0.0.1:5433/analytics · code analyticsq1");
  });

  it("omits missing optional segments", () => {
    expect(formatDatasourceEndpoint({ type: "mysql", database: "sample_db" })).toBe(
      "mysql · sample_db",
    );
  });

  it("returns dash when nothing is available", () => {
    expect(formatDatasourceEndpoint({})).toBe("—");
  });

  it("builds sync datasource display with name and endpoint", () => {
    expect(
      formatSyncDatasourceDisplay({
        name: "托管分析库",
        code: "analytics",
        type: "postgresql",
        host: "localhost",
        port: 5433,
        database: "analytics",
      }),
    ).toEqual({
      name: "托管分析库",
      endpoint: "postgresql · localhost:5433/analytics · code analytics",
      structured: {
        name: "托管分析库",
        type: "postgresql",
        connectionLine: "localhost:5433 / analytics",
        code: "analytics",
      },
    });
  });

  it("structures sync datasource fields for stacked readout", () => {
    expect(
      formatSyncDatasourceStructured({
        name: "test1",
        code: "analyticsq1",
        type: "postgresql",
        host: "127.0.0.1",
        port: 5433,
        database: "analytics",
      }),
    ).toEqual({
      name: "test1",
      type: "postgresql",
      connectionLine: "127.0.0.1:5433 / analytics",
      code: "analyticsq1",
    });
  });
});

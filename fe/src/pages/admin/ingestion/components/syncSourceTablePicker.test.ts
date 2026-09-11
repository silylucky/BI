import { describe, expect, it } from "vitest";
import { resolveSyncSourceSchema, supportsSyncSourceTablePicker } from "./syncSourceTablePicker";

describe("syncSourceTablePicker", () => {
  it("supports mysql metadata picker", () => {
    expect(supportsSyncSourceTablePicker("mysql")).toBe(true);
  });

  it("rest_api stays manual input", () => {
    expect(supportsSyncSourceTablePicker("rest_api")).toBe(false);
  });

  it("prefers connection database as schema for mysql", () => {
    expect(resolveSyncSourceSchema(["information_schema", "sample_db"], "sample_db", "mysql")).toBe(
      "sample_db",
    );
  });

  it("prefers public schema for timescaledb when database is not a schema", () => {
    expect(
      resolveSyncSourceSchema(
        ["_timescaledb_cache", "public", "timescaledb_information"],
        "ops_tsdb",
        "timescaledb",
      ),
    ).toBe("public");
  });
});

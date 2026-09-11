import { describe, expect, it } from "vitest";
import { normalizeConnectorTypeItem } from "./connector-taxonomy";

describe("normalizeConnectorTypeItem sync flags", () => {
  it("parses syncCapable and syncFetchImplemented from API", () => {
    const item = normalizeConnectorTypeItem({
      type: "clickhouse",
      displayName: "ClickHouse",
      category: "olap",
      queryCapable: true,
      queryMode: "sql",
      syncCapable: true,
      syncFetchImplemented: false,
    });
    expect(item.syncCapable).toBe(true);
    expect(item.syncFetchImplemented).toBe(false);
  });

  it("defaults sync flags when omitted", () => {
    const item = normalizeConnectorTypeItem({
      type: "hive",
      category: "lake",
      queryCapable: false,
    });
    expect(item.syncCapable).toBe(false);
    expect(item.syncFetchImplemented).toBe(false);
  });
});

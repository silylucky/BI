import { describe, expect, it } from "vitest";
import {
  baseTargetTableFromSource,
  findJobsSharingTargetTable,
  suggestSyncTargetTable,
} from "./suggestSyncTargetTable";

describe("suggestSyncTargetTable", () => {
  it("maps dirty_orders to orders_clean", () => {
    expect(baseTargetTableFromSource("dirty_orders")).toBe("orders_clean");
    expect(suggestSyncTargetTable("dirty_orders", [])).toBe("orders_clean");
  });

  it("appends suffix when base name taken", () => {
    expect(suggestSyncTargetTable("dirty_orders", ["orders_clean"])).toBe("orders_clean_2");
    expect(suggestSyncTargetTable("dirty_orders", ["orders_clean", "orders_clean_2"])).toBe(
      "orders_clean_3",
    );
  });

  it("derives generic source tables", () => {
    expect(baseTargetTableFromSource("sales")).toBe("sales_clean");
    expect(suggestSyncTargetTable("My Table", [])).toBe("my_table_clean");
  });

  it("findJobsSharingTargetTable excludes self on edit", () => {
    const jobs = [
      { id: "a", name: "同步1", target_table: "orders_clean" },
      { id: "b", name: "同步2", target_table: "orders_clean" },
      { id: "c", name: "其他", target_table: "sales_clean" },
    ];
    expect(findJobsSharingTargetTable(jobs, "orders_clean")).toHaveLength(2);
    expect(findJobsSharingTargetTable(jobs, "orders_clean", "a")).toEqual([
      { id: "b", name: "同步2", target_table: "orders_clean" },
    ]);
  });
});

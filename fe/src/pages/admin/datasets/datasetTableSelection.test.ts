import { describe, expect, it } from "vitest";
import {
  getPrimaryTable,
  loadPrimaryOnly,
  normalizeTablesSingle,
  setPrimaryTable,
} from "./datasetTableSelection";

describe("datasetTableSelection", () => {
  it("getPrimaryTable returns first table or null", () => {
    expect(getPrimaryTable([])).toBeNull();
    expect(getPrimaryTable([{ name: "public.orders" }])).toEqual({ name: "public.orders" });
    expect(getPrimaryTable([{ name: "a" }, { name: "b" }])).toEqual({ name: "a" });
  });

  it("setPrimaryTable always returns single-element array", () => {
    expect(setPrimaryTable("public.orders")).toEqual([{ name: "public.orders" }]);
    expect(setPrimaryTable("  public.items  ")).toEqual([{ name: "public.items" }]);
    expect(setPrimaryTable("")).toEqual([]);
    expect(setPrimaryTable("   ")).toEqual([]);
  });

  it("loadPrimaryOnly keeps only tables[0]", () => {
    expect(loadPrimaryOnly([])).toEqual([]);
    expect(loadPrimaryOnly([{ name: "public.orders", alias: "o" }])).toEqual([
      { name: "public.orders", alias: "o" },
    ]);
    expect(
      loadPrimaryOnly([
        { name: "public.orders" },
        { name: "public.order_items" },
      ]),
    ).toEqual([{ name: "public.orders", alias: null }]);
  });

  it("normalizeTablesSingle is alias of loadPrimaryOnly", () => {
    const tables = [{ name: "a" }, { name: "b" }];
    expect(normalizeTablesSingle(tables)).toEqual(loadPrimaryOnly(tables));
  });
});

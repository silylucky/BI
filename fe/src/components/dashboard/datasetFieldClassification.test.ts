import { describe, expect, it } from "vitest";
import { classifyDatasetField, groupDatasetFields } from "./datasetFieldClassification";

describe("datasetFieldClassification", () => {
  it("groups common field names into dimensions and metrics", () => {
    const grouped = groupDatasetFields(["sale_date", "region", "amount", "记录数"]);
    expect(grouped.dimensions).toEqual(["sale_date", "region"]);
    expect(grouped.metrics).toEqual(["amount", "记录数"]);
  });

  it("treats id-like fields as dimensions", () => {
    expect(classifyDatasetField("id")).toBe("dimension");
    expect(classifyDatasetField("order_id")).toBe("dimension");
    expect(classifyDatasetField("customer_id")).toBe("dimension");
    expect(classifyDatasetField("region_id")).toBe("dimension");
  });

  it("classifies sales sample fields like DataEase", () => {
    const grouped = groupDatasetFields([
      "sale_date",
      "channel",
      "id",
      "region_id",
      "product_id",
      "customer_id",
      "quantity",
      "amount",
    ]);
    expect(grouped.dimensions).toEqual([
      "sale_date",
      "channel",
      "id",
      "region_id",
      "product_id",
      "customer_id",
    ]);
    expect(grouped.metrics).toEqual(["quantity", "amount"]);
  });

  it("suggestDatasetBindColumns prefers classified fields", async () => {
    const { suggestDatasetBindColumns } = await import("./datasetFieldClassification");
    expect(
      suggestDatasetBindColumns(["id", "region", "amount", "updated_at", "internal_note"]).sort(),
    ).toEqual(["amount", "id", "internal_note", "region", "updated_at"]);
  });
});

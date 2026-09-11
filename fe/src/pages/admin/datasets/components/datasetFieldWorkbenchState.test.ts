import { describe, expect, it } from "vitest";
import {
  autoIdentifyDraft,
  seedBindDraftFromColumns,
  toggleColumnInDraft,
  toggleFieldKind,
} from "./datasetFieldWorkbenchState";

describe("datasetFieldWorkbenchState", () => {
  it("toggleColumnInDraft removes column without resetting others", () => {
    const draft = seedBindDraftFromColumns(["id", "amount", "region"], null);
    const next = toggleColumnInDraft(draft, "amount", false);
    expect(next.selectedColumns).toEqual(expect.arrayContaining(["id", "region"]));
    expect(next.selectedColumns).not.toContain("amount");
  });

  it("toggleFieldKind switches dimension to metric", () => {
    const draft = autoIdentifyDraft(["order_date", "order_amount"]);
    const switched = toggleFieldKind(draft, "order_date");
    expect(switched.columnKinds.order_date).toBe("metric");
  });
});

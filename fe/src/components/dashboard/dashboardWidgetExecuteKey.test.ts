import { describe, expect, it } from "vitest";
import { buildWidgetExecuteKey, widgetFilterExecuteRevision } from "./dashboardWidgetExecuteKey";

describe("dashboardWidgetExecuteKey", () => {
  it("buildWidgetExecuteKey only includes provided filter params", () => {
    const a = buildWidgetExecuteKey({ region: "east" }, 0);
    const b = buildWidgetExecuteKey({ region: "west" }, 0);
    expect(a).not.toBe(b);
    expect(buildWidgetExecuteKey(undefined, 1)).toContain('"r":1');
  });

  it("widgetFilterExecuteRevision scopes filters per widget", () => {
    const linkage = {
      filters: [{ filterId: "region", dimensionRef: "region" }],
      linkageRules: [
        { sourceFilterId: "region", targetWidgetIds: ["w1", "w2"], parameterKey: "region" },
      ],
    };
    const values = { region: "east" };
    const w1 = widgetFilterExecuteRevision("w1", linkage, values);
    const w3 = widgetFilterExecuteRevision("w3", linkage, values);
    expect(w1).not.toBe(w3);
  });
});

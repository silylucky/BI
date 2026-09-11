import { describe, expect, it } from "vitest";
import { resolveDashboardLayoutJson } from "./resolveDashboardLayoutJson";

describe("resolveDashboardLayoutJson", () => {
  const layout = { version: 1 as const, widgets: [], globalFilters: [] };

  it("reads layoutJson", () => {
    expect(resolveDashboardLayoutJson({ layoutJson: layout })).toEqual(layout);
  });

  it("falls back to layout_json", () => {
    expect(resolveDashboardLayoutJson({ layout_json: layout })).toEqual(layout);
  });

  it("throws when layout missing", () => {
    expect(() => resolveDashboardLayoutJson({})).toThrow(/看板布局数据格式异常/);
  });
});

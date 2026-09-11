import { describe, expect, it } from "vitest";
import {
  defaultStylePropertyLabel,
  humanizeStylePropertyKey,
  resolveCustomVizStyleEnumLabel,
  resolveCustomVizStylePropertyLabel,
} from "./customVizManifestLabels";

describe("customVizManifestLabels", () => {
  it("uses platform Chinese when manifest title is missing", () => {
    expect(resolveCustomVizStylePropertyLabel("lineWidth")).toBe("线宽");
    expect(resolveCustomVizStylePropertyLabel("showDots")).toBe("显示数据点");
    expect(resolveCustomVizStylePropertyLabel("curveType")).toBe("曲线类型");
  });

  it("prefers manifest Chinese title over platform default", () => {
    expect(resolveCustomVizStylePropertyLabel("lineWidth", "自定义线宽")).toBe("自定义线宽");
  });

  it("replaces English identifier title with platform Chinese", () => {
    expect(resolveCustomVizStylePropertyLabel("lineWidth", "lineWidth")).toBe("线宽");
  });

  it("humanizes unknown camelCase keys", () => {
    expect(humanizeStylePropertyKey("customBorderWidth")).toBe("custom边框宽度");
    expect(defaultStylePropertyLabel("showLegend")).toBe("显示图例");
  });

  it("translates common enum values", () => {
    expect(resolveCustomVizStyleEnumLabel("smooth", undefined, 0, "curveType")).toBe("平滑曲线");
    expect(resolveCustomVizStyleEnumLabel("linear", undefined, 0, "curveType")).toBe("直线");
    expect(resolveCustomVizStyleEnumLabel("compact", ["紧凑模式"], 0)).toBe("紧凑模式");
  });
});

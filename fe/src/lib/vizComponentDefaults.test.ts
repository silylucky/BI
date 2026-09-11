import { describe, expect, it } from "vitest";
import { defaultVizComponentName, defaultVizComponentPayload } from "./vizComponentDefaults";

describe("defaultVizComponentPayload", () => {
  it("creates bar chart payload by default", () => {
    const payload = defaultVizComponentPayload("chart");
    expect(payload.chartConfig?.chartType).toBe("bar");
    expect(payload.chartConfig?.chartId).toBeTruthy();
  });

  it("creates chart payload for selected type", () => {
    const payload = defaultVizComponentPayload("chart", { chartType: "line" });
    expect(payload.chartConfig?.chartType).toBe("line");
  });

  it("creates filter payload with filterId", () => {
    const payload = defaultVizComponentPayload("filter");
    expect(payload.filterConfig?.filterId).toBeTruthy();
  });

  it("seeds customViz resultLimit from chart display defaults", () => {
    const payload = defaultVizComponentPayload("customViz", {
      customViz: { artifactId: "art-1" },
    });
    expect(payload.customVizConfig?.artifactId).toBe("art-1");
    expect(payload.customVizConfig?.dataBinding?.resultLimit).toBe("20");
  });

  it("names widgets by type", () => {
    expect(defaultVizComponentName("text")).toBe("未命名富文本");
  });

  it("does not throw when crypto.randomUUID is unavailable", () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, "randomUUID", {
      configurable: true,
      value: () => {
        throw new TypeError("crypto.randomUUID is not a function");
      },
    });
    try {
      const payload = defaultVizComponentPayload("chart", { chartType: "pivot" });
      expect(payload.chartConfig?.chartType).toBe("pivot");
      expect(payload.chartConfig?.chartId).toBeTruthy();
    } finally {
      Object.defineProperty(globalThis.crypto, "randomUUID", {
        configurable: true,
        value: original,
      });
    }
  });
});

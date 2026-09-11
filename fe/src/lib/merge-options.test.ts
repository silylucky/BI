import { describe, expect, it } from "vitest";
import { deepMergeOptions } from "./merge-options";

describe("deepMergeOptions", () => {
  it("skips undefined overrides so base nested config is preserved", () => {
    const base = {
      markers: { size: 0, hover: { size: 6 } },
      legend: { show: true },
    };
    const merged = deepMergeOptions(base, { markers: undefined, legend: undefined });
    expect(merged).toEqual(base);
  });

  it("deep merges partial nested overrides", () => {
    const base = { markers: { size: 0, hover: { size: 6 } } };
    const merged = deepMergeOptions(base, { markers: { size: 3 } });
    expect(merged).toEqual({ markers: { size: 3, hover: { size: 6 } } });
  });
});

import { describe, expect, it } from "vitest";
import { readPinnedStandardKeys, sortStandardByPin, togglePinnedStandardKey } from "./reportCenterPrefs";

describe("reportCenterPrefs", () => {
  it("toggles pinned standard keys", () => {
    localStorage.clear();
    expect(togglePinnedStandardKey("k1")).toEqual(["k1"]);
    expect(togglePinnedStandardKey("k1")).toEqual([]);
  });

  it("sorts pinned standard packs first", () => {
    const items = [
      { packKey: "a", displayName: "A" },
      { packKey: "b", displayName: "B" },
    ];
    expect(sortStandardByPin(items, ["b"]).map((item) => item.packKey)).toEqual(["b", "a"]);
  });

  it("reads pinned keys from storage", () => {
    localStorage.setItem("vitalspan.reportCenter.pinnedStandard", JSON.stringify(["x"]));
    expect(readPinnedStandardKeys()).toEqual(["x"]);
  });
});

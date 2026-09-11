import { describe, expect, it } from "vitest";
import { markLineGuidesEqual } from "./markLineGuidesEqual";

describe("markLineGuidesEqual", () => {
  it("returns true for identical guide sets", () => {
    const guides = [
      { id: "v-left" as const, position: 100 },
      { id: "h-top" as const, position: 80 },
    ];
    expect(markLineGuidesEqual(guides, [...guides])).toBe(true);
  });

  it("returns false when guide position changes", () => {
    expect(
      markLineGuidesEqual(
        [{ id: "v-left", position: 100 }],
        [{ id: "v-left", position: 101 }],
      ),
    ).toBe(false);
  });
});

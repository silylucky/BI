import { describe, expect, it } from "vitest";
import { normalizeHexColor, resolvePickerHex } from "./color-utils";

describe("resolvePickerHex", () => {
  it("keeps last valid hex when input is incomplete", () => {
    expect(resolvePickerHex("#43", "#112233")).toBe("#112233");
    expect(resolvePickerHex("not-a-color", "#aabbcc")).toBe("#aabbcc");
  });

  it("returns normalized hex when input is valid", () => {
    expect(resolvePickerHex("#43B379", "#ffffff")).toBe("#43b379");
    expect(normalizeHexColor("#abc")).toBe("#aabbcc");
  });
});

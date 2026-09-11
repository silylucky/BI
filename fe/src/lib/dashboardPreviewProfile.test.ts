import { describe, expect, it } from "vitest";
import {
  CARD_PREVIEW_QUERY_LIMIT,
  isCardPreviewProfile,
  resolveCardPreviewQueryLimit,
} from "./dashboardPreviewProfile";

describe("dashboardPreviewProfile", () => {
  it("identifies card profile", () => {
    expect(isCardPreviewProfile("card")).toBe(true);
    expect(isCardPreviewProfile("default")).toBe(false);
    expect(isCardPreviewProfile(undefined)).toBe(false);
  });

  it("caps query limit for card previews", () => {
    expect(resolveCardPreviewQueryLimit(200)).toBe(CARD_PREVIEW_QUERY_LIMIT);
    expect(resolveCardPreviewQueryLimit(20)).toBe(20);
  });
});

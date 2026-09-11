import { describe, expect, it } from "vitest";

import {
  HUB_CARD_ASPECT_RATIO,
  HUB_CARD_SCREEN_ASPECT_RATIO,
  hubCardPreviewFrameStyle,
} from "./hubCardUi";

describe("hubCardPreviewFrameStyle", () => {
  it("uses the 1920x1080 ratio for data screens so fit scaling leaves no letterbox", () => {
    expect(hubCardPreviewFrameStyle("data-screen").aspectRatio).toBe(HUB_CARD_SCREEN_ASPECT_RATIO);
  });

  it("keeps the 16/10 hub ratio for dashboards and unspecified surfaces", () => {
    expect(hubCardPreviewFrameStyle("dashboard").aspectRatio).toBe(HUB_CARD_ASPECT_RATIO);
    expect(hubCardPreviewFrameStyle().aspectRatio).toBe(HUB_CARD_ASPECT_RATIO);
  });
});

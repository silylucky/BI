import { describe, expect, it } from "vitest";
import { fitPreviewSize } from "./WidgetDialogShell";

describe("fitPreviewSize", () => {
  it("keeps 1280x720 when within bounds", () => {
    expect(fitPreviewSize({ width: 1280, height: 720 }, { maxWidth: 1280, maxHeight: 720 })).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it("scales down 1920x1080 to fit bounds", () => {
    const size = fitPreviewSize(
      { width: 1920, height: 1080 },
      { maxWidth: 1280, maxHeight: 720 },
    );
    expect(size.width).toBeLessThanOrEqual(1280);
    expect(size.height).toBeLessThanOrEqual(720);
    expect(size.width / size.height).toBeCloseTo(16 / 9, 2);
  });
});

import { describe, expect, it } from "vitest";
import {
  isDataImageUrl,
  isHttpImageUrl,
  isImageSourceValue,
  readImageFileAsDataUrl,
} from "./imageSourceUtils";

describe("imageSourceUtils", () => {
  it("detects http and data image urls", () => {
    expect(isHttpImageUrl("https://cdn.example/a.png")).toBe(true);
    expect(isDataImageUrl("data:image/png;base64,abc")).toBe(true);
    expect(isImageSourceValue("data:image/png;base64,abc")).toBe(true);
    expect(isImageSourceValue("/template-assets/packs/de-dashboard-v1/backgrounds/gov-grid.svg")).toBe(
      true,
    );
    expect(isHttpImageUrl("data:image/png;base64,abc")).toBe(false);
  });

  it("reads image file as data url", async () => {
    const file = new File(["x"], "demo.png", { type: "image/png" });
    const dataUrl = await readImageFileAsDataUrl(file);
    expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("rejects non-image files", async () => {
    const file = new File(["x"], "demo.txt", { type: "text/plain" });
    await expect(readImageFileAsDataUrl(file)).rejects.toThrow(/图片文件/);
  });
});

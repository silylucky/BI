import { describe, expect, it } from "vitest";
import { formatWidgetBackgroundImageCss } from "./imageSourceUtils";

describe("formatWidgetBackgroundImageCss", () => {
  it("wraps bare urls in quoted url()", () => {
    expect(formatWidgetBackgroundImageCss("https://example.com/a.png")).toBe(
      'url("https://example.com/a.png")',
    );
  });

  it("preserves existing url() values", () => {
    expect(formatWidgetBackgroundImageCss('url("https://example.com/a.png")')).toBe(
      'url("https://example.com/a.png")',
    );
  });

  it("quotes data urls for css safety", () => {
    expect(formatWidgetBackgroundImageCss("data:image/svg+xml;base64,PHN2Zy8+")).toContain(
      'url("data:image/svg+xml;base64,PHN2Zy8+")',
    );
  });
});

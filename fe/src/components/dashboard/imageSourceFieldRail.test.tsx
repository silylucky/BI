import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImagePreviewCard } from "./imageSourceFieldRail";

describe("ImagePreviewCard", () => {
  it("renders img src for immediate data URL preview updates", () => {
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const { rerender } = render(
      <ImagePreviewCard previewUrl={dataUrl} onReplace={() => undefined} />,
    );
    const img = screen.getByRole("img", { name: "图片预览" }) as HTMLImageElement;
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBe(dataUrl);

    const nextUrl = "data:image/png;base64,QUJD";
    rerender(<ImagePreviewCard previewUrl={nextUrl} onReplace={() => undefined} />);
    expect(screen.getByRole("img", { name: "图片预览" }).getAttribute("src")).toBe(nextUrl);
  });
});

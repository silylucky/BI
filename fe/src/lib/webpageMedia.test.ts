import { describe, expect, it } from "vitest";
import { isWebpageMediaUrl } from "./webpageMedia";

describe("webpageMedia", () => {
  it("accepts http and https urls", () => {
    expect(isWebpageMediaUrl("https://example.com")).toBe(true);
    expect(isWebpageMediaUrl("http://localhost:3000")).toBe(true);
  });

  it("rejects empty and invalid urls", () => {
    expect(isWebpageMediaUrl("")).toBe(false);
    expect(isWebpageMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isWebpageMediaUrl("not-a-url")).toBe(false);
  });
});

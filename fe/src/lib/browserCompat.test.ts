import { describe, expect, it, vi } from "vitest";
import { checkBrowserCompat } from "./browserCompat";

describe("browserCompat", () => {
  it("marks IE UA unsupported", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (compatible; MSIE 10.0)" });
    expect(checkBrowserCompat().supported).toBe(false);
  });

  it("marks modern UA supported", () => {
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0",
    });
    expect(checkBrowserCompat().supported).toBe(true);
  });
});

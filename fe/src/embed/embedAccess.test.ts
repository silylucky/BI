import { afterEach, describe, expect, it, vi } from "vitest";
import { isEmbedPageAuthorized, resolveEmbedAllowedOrigins } from "./embedAccess";

describe("embedAccess", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("allows public share without origin whitelist", () => {
    const params = new URLSearchParams("token=abc&shareMode=public");
    expect(isEmbedPageAuthorized(params, "http://localhost:5174", true)).toBe(true);
  });

  it("allows embed iframe when token is present", () => {
    vi.stubGlobal("window", {
      ...window,
      self: {},
      top: window,
      location: { ...window.location, origin: "http://localhost:5174" },
    });
    const params = new URLSearchParams("token=abc");
    expect(isEmbedPageAuthorized(params, "http://localhost:5174", true)).toBe(true);
  });

  it("denies when no token and origin not in allowedOrigins query", () => {
    vi.stubGlobal("location", { ...window.location, origin: "https://evil.com" });
    const params = new URLSearchParams("allowedOrigins=https://portal.example.com");
    expect(isEmbedPageAuthorized(params, "https://evil.com", false)).toBe(false);
  });

  it("defaults allowed origins to current origin", () => {
    vi.stubGlobal("location", { ...window.location, origin: "http://localhost:5174" });
    expect(resolveEmbedAllowedOrigins(new URLSearchParams())).toEqual(["http://localhost:5174"]);
  });
});

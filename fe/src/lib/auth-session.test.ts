import { describe, expect, it } from "vitest";
import { ApiRequestError } from "@/lib/api";
import { shouldClearAuthSession } from "@/lib/auth-session";

describe("shouldClearAuthSession", () => {
  it("clears on UNAUTHORIZED and token revoked codes", () => {
    expect(shouldClearAuthSession(new ApiRequestError("expired", "UNAUTHORIZED"))).toBe(true);
    expect(shouldClearAuthSession(new ApiRequestError("revoked", "TOKEN_REVOKED"))).toBe(true);
    expect(shouldClearAuthSession(new ApiRequestError("disabled", "AUTH_USER_DISABLED"))).toBe(true);
  });

  it("keeps session on transient failures", () => {
    expect(shouldClearAuthSession(new ApiRequestError("timeout", "REQUEST_TIMEOUT"))).toBe(false);
    expect(shouldClearAuthSession(new ApiRequestError("unavailable", "AUTH_CONTEXT_UNAVAILABLE"))).toBe(
      false,
    );
    expect(shouldClearAuthSession(new TypeError("Failed to fetch"))).toBe(false);
  });
});

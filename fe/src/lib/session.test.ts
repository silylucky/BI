import { describe, expect, it } from "vitest";
import { primaryRoleCode, primaryRoleLabel } from "@/lib/session";

describe("primaryRoleCode", () => {
  it("prefers admin over analyst and viewer", () => {
    expect(primaryRoleCode(["viewer", "admin", "analyst"])).toBe("admin");
  });

  it("prefers analyst over viewer", () => {
    expect(primaryRoleCode(["viewer", "analyst"])).toBe("analyst");
  });

  it("falls back to first custom role when no builtin match", () => {
    expect(primaryRoleCode(["custom-role"])).toBe("custom-role");
  });

  it("defaults to viewer when roles empty", () => {
    expect(primaryRoleCode([])).toBe("viewer");
  });
});

describe("primaryRoleLabel", () => {
  it("labels highest-priority builtin role", () => {
    expect(primaryRoleLabel(["viewer", "admin"])).toBe("管理员");
  });
});

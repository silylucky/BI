import { describe, expect, it } from "vitest";
import { isNavPathActive, navPathMatches, resolveActiveNavPath } from "./nav-active";

const REPORT_SUB_PATHS = [
  "/admin/reports/center",
  "/admin/reports",
  "/admin/reports/templates",
  "/admin/reports/schedules",
];

const SYSTEM_ADMIN_NAV_PATHS = [
  "/admin/system",
  "/admin/system/orgs",
  "/admin/system/users",
  "/admin/system/roles",
  "/admin/system/grants",
  "/admin/system/platform-connect",
  "/admin/system/rls",
  "/admin/system/audit",
];

describe("nav-active", () => {
  it("matches exact path and descendants", () => {
    expect(navPathMatches("/admin/reports", "/admin/reports")).toBe(true);
    expect(navPathMatches("/admin/reports/foo", "/admin/reports")).toBe(true);
    expect(navPathMatches("/admin/reports-center", "/admin/reports")).toBe(false);
  });

  it("resolves longest prefix among sibling report paths", () => {
    expect(resolveActiveNavPath("/admin/reports/center", REPORT_SUB_PATHS)).toBe(
      "/admin/reports/center",
    );
    expect(resolveActiveNavPath("/admin/reports", REPORT_SUB_PATHS)).toBe("/admin/reports");
    expect(resolveActiveNavPath("/admin/reports/templates/new", REPORT_SUB_PATHS)).toBe(
      "/admin/reports/templates",
    );
  });

  it("does not mark 预制报表 active when on 全部报表", () => {
    expect(
      isNavPathActive("/admin/reports/center", "/admin/reports/center", REPORT_SUB_PATHS),
    ).toBe(true);
    expect(isNavPathActive("/admin/reports/center", "/admin/reports", REPORT_SUB_PATHS)).toBe(
      false,
    );
  });

  it("does not mark 配置向导 active when on 角色管理", () => {
    expect(
      isNavPathActive("/admin/system/roles", "/admin/system/roles", SYSTEM_ADMIN_NAV_PATHS),
    ).toBe(true);
    expect(
      isNavPathActive("/admin/system/roles", "/admin/system", SYSTEM_ADMIN_NAV_PATHS),
    ).toBe(false);
  });

  it("marks 配置向导 active only on system home", () => {
    expect(isNavPathActive("/admin/system", "/admin/system", SYSTEM_ADMIN_NAV_PATHS)).toBe(true);
    expect(isNavPathActive("/admin/system/orgs", "/admin/system/orgs", SYSTEM_ADMIN_NAV_PATHS)).toBe(
      true,
    );
    expect(isNavPathActive("/admin/system/orgs", "/admin/system", SYSTEM_ADMIN_NAV_PATHS)).toBe(
      false,
    );
  });
});

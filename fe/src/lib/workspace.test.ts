import { describe, expect, it } from "vitest";
import {
  ACCOUNT_LANDING_PATH,
  ACCOUNT_PREFERENCES_PATH,
  ACCOUNT_PROFILE_PATH,
  ACCOUNT_SECURITY_PATH,
  ACCOUNT_SETTINGS_PATH,
  ACCOUNT_THEME_PATH,
  isAccountManagementPath,
  isWorkspacePath,
  resolveWorkspaceReturnPath,
  WORKSPACE_HOME_PATH,
} from "./workspace";

describe("workspace", () => {
  it("recognizes dashboard list and view paths as workspace", () => {
    expect(isWorkspacePath(WORKSPACE_HOME_PATH)).toBe(true);
    expect(isWorkspacePath("/admin/dashboards/demo-id")).toBe(true);
    expect(isWorkspacePath("/admin/dashboards/demo-id/edit")).toBe(false);
    expect(isWorkspacePath("/admin/ingestion/sync-jobs")).toBe(false);
  });

  it("recognizes account management paths", () => {
    expect(isAccountManagementPath(ACCOUNT_PROFILE_PATH)).toBe(true);
    expect(isAccountManagementPath(ACCOUNT_THEME_PATH)).toBe(true);
    expect(isAccountManagementPath(ACCOUNT_LANDING_PATH)).toBe(true);
    expect(isAccountManagementPath(ACCOUNT_PREFERENCES_PATH)).toBe(true);
    expect(isAccountManagementPath(ACCOUNT_SECURITY_PATH)).toBe(true);
    expect(isAccountManagementPath(ACCOUNT_SETTINGS_PATH)).toBe(true);
    expect(isAccountManagementPath("/admin")).toBe(false);
  });

  it("falls back to workspace home for invalid return paths", () => {
    expect(resolveWorkspaceReturnPath("/admin/dashboards/demo-id")).toBe(
      "/admin/dashboards/demo-id",
    );
    expect(resolveWorkspaceReturnPath("/admin")).toBe(WORKSPACE_HOME_PATH);
    expect(resolveWorkspaceReturnPath(null)).toBe(WORKSPACE_HOME_PATH);
  });
});

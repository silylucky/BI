import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApiFetch = vi.fn();
vi.mock("@/lib/api", () => ({ apiFetch: (...args: unknown[]) => mockApiFetch(...args) }));

import { resolveDefaultDashboardPath, resolveDefaultLandingPath, resolveDefaultReportTemplateNodeId } from "./defaultViewResolve";

function mockDashboardExists(id: string) {
  mockApiFetch.mockResolvedValueOnce({ id });
}

describe("resolveDefaultDashboardPath", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("returns first role dashboard path", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        dashboardId: "d-1",
        reportTemplateNodeId: null,
        maxWidgetCount: 24,
        inheritFromRoleId: null,
      });
    mockDashboardExists("d-1");
    const path = await resolveDefaultDashboardPath(["viewer", "admin"]);
    expect(path).toBe("/admin/dashboards/d-1");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/users/me/views");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/roles/viewer/default-views");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/dashboards/d-1");
  });

  it("follows inheritFromRoleId chain", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        dashboardId: null,
        inheritFromRoleId: "analyst",
        maxWidgetCount: 24,
      })
      .mockResolvedValueOnce({
        dashboardId: "d-2",
        inheritFromRoleId: null,
        maxWidgetCount: 24,
      });
    mockDashboardExists("d-2");
    const path = await resolveDefaultDashboardPath(["viewer"]);
    expect(path).toBe("/admin/dashboards/d-2");
  });

  it("returns null when no defaults", async () => {
    mockApiFetch.mockResolvedValueOnce({ items: [] }).mockResolvedValue({
      dashboardId: null,
      inheritFromRoleId: null,
      maxWidgetCount: 24,
    });
    expect(await resolveDefaultDashboardPath(["viewer"])).toBeNull();
  });

  it("prefers user override over role default", async () => {
    mockApiFetch.mockResolvedValueOnce({
      items: [{ id: "v1", name: "我的看板", dashboardId: "d-override" }],
    });
    mockDashboardExists("d-override");
    const path = await resolveDefaultDashboardPath(["viewer"]);
    expect(path).toBe("/admin/dashboards/d-override");
    expect(mockApiFetch).toHaveBeenCalledWith("/api/v1/users/me/views");
    expect(mockApiFetch).not.toHaveBeenCalledWith("/api/v1/roles/viewer/default-views");
  });

  it("prefers isDefault flag over legacy name and other items", async () => {
    mockApiFetch.mockResolvedValueOnce({
      items: [
        { name: "默认", dashboardId: "d-legacy", isDefault: false },
        { name: "我的总览", dashboardId: "d-flagged", isDefault: true },
      ],
    });
    mockDashboardExists("d-flagged");
    expect(await resolveDefaultDashboardPath(["viewer"])).toBe("/admin/dashboards/d-flagged");
  });

  it("prefers override named 默认 over other items when no isDefault flag", async () => {
    mockApiFetch.mockResolvedValueOnce({
      items: [
        { name: "其他", dashboardId: "d-other" },
        { name: "默认", dashboardId: "d-default-name" },
      ],
    });
    mockDashboardExists("d-default-name");
    expect(await resolveDefaultDashboardPath(["viewer"])).toBe("/admin/dashboards/d-default-name");
  });

  it("falls back to role chain when me/views empty", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        dashboardId: "d-role",
        inheritFromRoleId: null,
        maxWidgetCount: 24,
      });
    mockDashboardExists("d-role");
    expect(await resolveDefaultDashboardPath(["viewer"])).toBe("/admin/dashboards/d-role");
  });

  it("skips stale dashboard ids from user override", async () => {
    const notFound = Object.assign(new Error("Dashboard not found"), { code: "DASH_NOT_FOUND" });
    mockApiFetch
      .mockResolvedValueOnce({
        items: [{ name: "默认", dashboardId: "d-missing" }],
      })
      .mockRejectedValueOnce(notFound)
      .mockResolvedValueOnce({
        dashboardId: "d-role",
        inheritFromRoleId: null,
        maxWidgetCount: 24,
      });
    mockDashboardExists("d-role");
    expect(await resolveDefaultDashboardPath(["viewer"])).toBe("/admin/dashboards/d-role");
  });

  it("skips role on 403 and tries next roleCode", async () => {
    const err403 = Object.assign(new Error("forbidden"), { code: "VIEW_DEFAULT_FORBIDDEN" });
    mockApiFetch
      .mockResolvedValueOnce({ items: [] })
      .mockRejectedValueOnce(err403)
      .mockResolvedValueOnce({
        dashboardId: "d-admin",
        inheritFromRoleId: null,
        maxWidgetCount: 24,
      });
    mockDashboardExists("d-admin");
    expect(await resolveDefaultDashboardPath(["viewer", "admin"])).toBe("/admin/dashboards/d-admin");
  });

  it("returns null on inherit cycle and tries next role", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        dashboardId: null,
        inheritFromRoleId: "viewer",
        maxWidgetCount: 24,
      })
      .mockResolvedValueOnce({
        dashboardId: "d-2",
        inheritFromRoleId: null,
        maxWidgetCount: 24,
      });
    mockDashboardExists("d-2");
    expect(await resolveDefaultDashboardPath(["viewer", "analyst"])).toBe("/admin/dashboards/d-2");
  });

  it("stops inherit recursion beyond depth 8", async () => {
    mockApiFetch.mockResolvedValueOnce({ items: [] });
    for (let i = 0; i < 10; i += 1) {
      mockApiFetch.mockResolvedValueOnce({
        dashboardId: null,
        inheritFromRoleId: `role-${i + 1}`,
        maxWidgetCount: 24,
      });
    }
    expect(await resolveDefaultDashboardPath(["role-0"])).toBeNull();
  });

  it("continues to role chain when me/views fetch fails", async () => {
    mockApiFetch
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({
        dashboardId: "d-fallback",
        inheritFromRoleId: null,
        maxWidgetCount: 24,
      });
    mockDashboardExists("d-fallback");
    expect(await resolveDefaultDashboardPath(["viewer"])).toBe("/admin/dashboards/d-fallback");
  });
});

describe("resolveDefaultLandingPath report template fallback", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("falls back to report template when no dashboard", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        dashboardId: null,
        reportTemplateNodeId: "tpl-node-1",
        inheritFromRoleId: null,
      });
    expect(await resolveDefaultLandingPath(["viewer"])).toBe(
      "/admin/reports/view/tpl-node-1",
    );
  });

  it("prefers dashboard over report template on same role", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        dashboardId: "d-1",
        reportTemplateNodeId: "tpl-node-1",
        inheritFromRoleId: null,
      });
    mockDashboardExists("d-1");
    expect(await resolveDefaultLandingPath(["viewer"])).toBe("/admin/dashboards/d-1");
  });

  it("inherits report template from parent role", async () => {
    mockApiFetch
      .mockResolvedValueOnce({ items: [] })
      .mockResolvedValueOnce({
        dashboardId: null,
        reportTemplateNodeId: null,
        inheritFromRoleId: "analyst",
      })
      .mockResolvedValueOnce({
        dashboardId: null,
        reportTemplateNodeId: "tpl-inherited",
        inheritFromRoleId: null,
      });
    expect(await resolveDefaultLandingPath(["viewer"])).toBe(
      "/admin/reports/view/tpl-inherited",
    );
  });
});

describe("resolveDefaultReportTemplateNodeId", () => {
  beforeEach(() => mockApiFetch.mockReset());

  it("returns first role report template node id", async () => {
    mockApiFetch.mockResolvedValueOnce({
      dashboardId: null,
      reportTemplateNodeId: "tpl-99",
      inheritFromRoleId: null,
    });
    expect(await resolveDefaultReportTemplateNodeId(["viewer"])).toBe("tpl-99");
  });
});

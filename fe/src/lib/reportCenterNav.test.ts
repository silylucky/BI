import { describe, expect, it } from "vitest";
import {
  canRetryReportSchedules,
  isReportCenterNavActive,
  localizeCenterResourceType,
  resolveCenterRecentHref,
  resolveReportCenterSubNavPath,
} from "./reportCenterNav";

describe("reportCenterNav", () => {
  it("localizes resource types", () => {
    expect(localizeCenterResourceType("template")).toBe("文档模板");
    expect(localizeCenterResourceType("standard")).toBe("标准分析");
  });

  it("resolves recent view hrefs", () => {
    expect(resolveCenterRecentHref({ resourceType: "template", resourceId: "tpl-1" })).toBe(
      "/admin/reports/templates?node=tpl-1",
    );
    expect(resolveCenterRecentHref({ resourceType: "standard", resourceId: "k1" })).toBe(
      "/admin/reports/standard/results?pack=k1",
    );
    expect(resolveCenterRecentHref({ resourceType: "schedule", resourceId: "s1" })).toBe(
      "/admin/reports/schedules?tab=all&expand=s1",
    );
  });

  it("gates schedule retry by capability", () => {
    expect(canRetryReportSchedules(["report:read"])).toBe(false);
    expect(canRetryReportSchedules(["report:manage"])).toBe(true);
    expect(canRetryReportSchedules(["dashboard:schedule"])).toBe(true);
    expect(canRetryReportSchedules(["report:*"])).toBe(true);
    expect(canRetryReportSchedules(["*"])).toBe(true);
  });

  it("resolves report sub-nav active path", () => {
    expect(resolveReportCenterSubNavPath("/admin/reports/center")).toBe("/admin/reports/center");
    expect(resolveReportCenterSubNavPath("/admin/reports/standard/results")).toBe(
      "/admin/reports/standard/results",
    );
    expect(resolveReportCenterSubNavPath("/admin/reports/templates/foo")).toBe(
      "/admin/reports/templates",
    );
    expect(resolveReportCenterSubNavPath("/admin/reports/view/tpl-1")).toBe(
      "/admin/reports/templates",
    );
    expect(resolveReportCenterSubNavPath("/admin/reports/schedules")).toBe(
      "/admin/reports/schedules",
    );
    expect(resolveReportCenterSubNavPath("/admin/reports/standard/setup")).toBe(
      "/admin/reports/standard/results",
    );
  });

  it("highlights report center nav for all report routes", () => {
    expect(isReportCenterNavActive("/admin/reports/center")).toBe(true);
    expect(isReportCenterNavActive("/admin/reports/standard/results")).toBe(true);
    expect(isReportCenterNavActive("/admin/reports/standard/setup")).toBe(true);
    expect(isReportCenterNavActive("/admin/reports/templates")).toBe(true);
    expect(isReportCenterNavActive("/admin/reports/dashboards")).toBe(false);
  });
});

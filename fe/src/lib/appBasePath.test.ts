import { describe, expect, it } from "vitest";
import {
  getAppBasePath,
  isExportSnapshotPath,
  matchExportDashboardId,
  resolvePublicAssetUrl,
  stripAppBase,
} from "./appBasePath";

describe("appBasePath", () => {
  it("stripAppBase handles root base", () => {
    expect(stripAppBase("/export/dashboard/d1")).toBe("/export/dashboard/d1");
    expect(isExportSnapshotPath("/export/dashboard/d1")).toBe(true);
    expect(matchExportDashboardId("/export/data-screen/d2")).toBe("d2");
  });

  it("getAppBasePath returns empty for default vite base", () => {
    expect(getAppBasePath()).toBe("");
  });

  it("resolvePublicAssetUrl is idempotent for default base", () => {
    const raw = "/template-assets/packs/gov-enterprise-v1/panels/panel-de-frame-cyan.svg";
    expect(resolvePublicAssetUrl(raw)).toBe(raw);
    expect(resolvePublicAssetUrl(raw)).toBe(resolvePublicAssetUrl(raw));
  });
});

import { describe, expect, it } from "vitest";
import {
  buildVizLayoutEnvelope,
  filterTemplatesForHub,
  type DashboardTemplateListItem,
} from "./dashboardTemplates";
import type { DashboardLayoutV1 } from "@/components/dashboard/layoutUtils";

function mockTemplate(
  overrides: Partial<DashboardTemplateListItem> & Pick<DashboardTemplateListItem, "templateKey" | "name">,
): DashboardTemplateListItem {
  return {
    id: "tpl-mock",
    description: null,
    categoryKey: "general",
    surfaceKind: "dashboard",
    status: "published",
    thumbnailRef: null,
    visibility: "builtin",
    ownerUserId: null,
    contentRevision: 1,
    updatedAt: new Date().toISOString(),
    publishedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("filterTemplatesForHub", () => {
  it("returns all templates when no hidden keys are configured", () => {
    const items = [
      mockTemplate({ templateKey: "builtin-gov-industrial-park", name: "工业园区数据监控中心", surfaceKind: "data-screen" }),
      mockTemplate({ templateKey: "builtin-gov-efficiency", name: "政务效能分析看板" }),
    ];
    expect(filterTemplatesForHub(items)).toEqual(items);
  });

  it("hides archived templates from the hub gallery", () => {
    const items = [
      mockTemplate({ templateKey: "builtin-gov-efficiency", name: "政务效能分析看板" }),
      mockTemplate({
        templateKey: "builtin-gov-investment",
        name: "招商引资分析",
        status: "archived",
      }),
    ];
    expect(filterTemplatesForHub(items)).toEqual([items[0]]);
  });
});

describe("buildVizLayoutEnvelope", () => {
  it("wraps dashboard layout in viz-layout envelope", () => {
    const layout: DashboardLayoutV1 = {
      version: 1,
      widgets: [],
      globalFilters: [],
    };
    const envelope = buildVizLayoutEnvelope(layout, "双栏 KPI", "dashboard");
    expect(envelope.templateVersion).toBe(1);
    expect(envelope.kind).toBe("viz-layout");
    expect(envelope.surfaceKind).toBe("dashboard");
    expect(envelope.name).toBe("双栏 KPI");
    expect(envelope.layout).toEqual(layout);
  });
});

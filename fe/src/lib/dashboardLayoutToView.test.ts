import { describe, expect, it } from "vitest";

import { dashboardLayoutToView } from "./dashboardLayoutToView";

describe("dashboardLayoutToView", () => {
  it("maps a v1 dashboard without changing its grid geometry", () => {
    const layout = { version: 1 as const, widgets: [], globalFilters: [] };
    const doc = dashboardLayoutToView({
      dashboardId: "00000000-0000-4000-8000-000000000001",
      name: "Sales",
      layoutJson: layout,
    });
    expect(doc.protocolVersion).toBe(1);
    expect(doc.dashboardId).toBe("00000000-0000-4000-8000-000000000001");
    expect(doc.name).toBe("Sales");
    expect(doc.layout).toEqual(layout);
  });

  it("maps a v2 dashboard without downgrading its pixel geometry", () => {
    const layout = {
      version: 2 as const,
      canvas: { width: 1440 as const, height: 900 },
      widgets: [
        {
          id: "pixel-widget",
          type: "text" as const,
          title: "Pixel",
          order: 0,
          x: 120,
          y: 80,
          width: 480,
          height: 320,
        },
      ],
      globalFilters: [],
    };

    const doc = dashboardLayoutToView({
      dashboardId: "00000000-0000-4000-8000-000000000002",
      name: "Pixel dashboard",
      layoutJson: layout,
    });

    expect(doc.protocolVersion).toBe(1);
    expect(doc.layout).toEqual(layout);
    expect(doc.layout.version).toBe(2);
    expect(doc.layout.widgets[0]).toMatchObject({
      x: 120,
      y: 80,
      width: 480,
      height: 320,
    });
    expect(doc.layout.widgets[0]).not.toHaveProperty("colSpan");
  });
});

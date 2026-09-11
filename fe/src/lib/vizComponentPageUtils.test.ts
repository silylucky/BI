import { describe, expect, it } from "vitest";
import { componentDetailToLayoutWidget } from "./vizComponentPageUtils";
import type { VizComponentDetail } from "./vizComponents";

describe("componentDetailToLayoutWidget customViz", () => {
  it("maps customViz payload to layout widget", () => {
    const detail = {
      id: "11111111-1111-4111-8111-111111111111",
      componentKey: "cv-1",
      name: "AI 排名条",
      description: null,
      categoryKey: "general",
      widgetType: "customViz",
      surfaceKinds: ["dashboard"],
      status: "published",
      payloadJson: {
        customVizConfig: {
          artifactId: "22222222-2222-4222-8222-222222222222",
          dataBinding: { status: "manual" },
        },
      },
      thumbnailRef: null,
      tags: [],
      visibility: "org",
      contentRevision: 1,
      updatedAt: "2026-08-13T00:00:00Z",
      publishedAt: "2026-08-13T00:00:00Z",
      ownerUserId: null,
      orgScope: null,
      createdAt: "2026-08-13T00:00:00Z",
    } satisfies VizComponentDetail;

    const widget = componentDetailToLayoutWidget(detail);
    expect(widget.type).toBe("customViz");
    expect(widget.customVizConfig?.artifactId).toBe("22222222-2222-4222-8222-222222222222");
    expect(widget.componentRef?.componentId).toBe(detail.id);
  });
});

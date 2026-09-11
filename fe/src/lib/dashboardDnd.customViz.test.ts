import { describe, expect, it } from "vitest";
import {
  DASHBOARD_CUSTOM_VIZ_DND_TYPE,
  readCustomVizFromDragEvent,
  readPaletteDragPayload,
} from "./dashboardDnd";

describe("dashboardDnd customViz", () => {
  it("reads custom viz payload from drag event", () => {
    const payload = {
      type: "customViz" as const,
      artifactId: "art-1",
      displayName: "排名条",
    };
    const event = {
      dataTransfer: {
        getData(type: string) {
          return type === DASHBOARD_CUSTOM_VIZ_DND_TYPE ? JSON.stringify(payload) : "";
        },
      },
    };
    expect(readCustomVizFromDragEvent(event)).toEqual(payload);
    expect(readPaletteDragPayload(event)).toEqual(payload);
  });
});

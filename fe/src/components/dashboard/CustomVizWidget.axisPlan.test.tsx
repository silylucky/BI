import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { CustomVizWidget } from "./CustomVizWidget";
import { CUSTOM_VIZ_PAYLOAD_CLASS } from "./custom-viz/customVizPayload";
import { thinCategoryTickIndices } from "./custom-viz/customVizLayoutHelpers";

const { ARTIFACT_ID, CATEGORY_COUNT, ROWS, sizeStore, axisHtml } = vi.hoisted(() => {
  const artifactId = "550e8400-e29b-41d4-a716-446655440000";
  const categoryCount = 40;
  const rows = Array.from({ length: categoryCount }, (_, index) => [`cat-${index}`, index]);
  const html = `<!DOCTYPE html><html><body><div id="tick-count">0</div><script>(function(){
    var host=document.currentScript.parentElement;
    var mark=host.querySelector('#tick-count');
    host.vsCv.mount(function(p){
      var n=(p.axisPlan&&p.axisPlan.categoryTickIndices)?p.axisPlan.categoryTickIndices.length:0;
      mark.textContent=String(n);
    });
  })();</script></body></html>`;
  return {
    ARTIFACT_ID: artifactId,
    CATEGORY_COUNT: categoryCount,
    ROWS: rows,
    sizeStore: { width: 320, height: 200 },
    axisHtml: html,
  };
});

vi.mock("@/lib/api", () => ({
  fetchWithTimeout: vi.fn(async () => ({
    ok: true,
    text: async () => axisHtml,
  })),
  getAuthHeaders: () => ({}),
  apiFetch: vi.fn(async () => ({
    artifactId: ARTIFACT_ID,
    manifest: { defaultStyle: {} },
    status: "active",
    contentHash: "axis-plan",
  })),
}));

vi.mock("@/components/charts/useChartExecute", () => ({
  useChartExecute: () => ({
    columns: ["category", "value"],
    rows: ROWS,
    loading: false,
    error: null,
    slowHint: false,
  }),
}));

vi.mock("@/lib/appBasePath", () => ({
  resolveApiBaseUrl: () => "http://localhost:8000",
}));

vi.mock("@/hooks/useElementSize", () => ({
  useElementSize: () => ({
    ref: () => undefined,
    get size() {
      return { width: sizeStore.width, height: sizeStore.height };
    },
    remeasure: vi.fn(),
  }),
}));

const widget = {
  id: "w-axis",
  type: "customViz" as const,
  title: "D3",
  colSpan: 6,
  rowSpan: 3,
  order: 0,
  customVizConfig: {
    artifactId: ARTIFACT_ID,
    dataBinding: {
      status: "connected" as const,
      dataSourceId: "ds1",
      datasetId: "set1",
      configId: "cfg1",
      dimensions: [{ field: "category" }],
      metrics: [{ field: "value", agg: "sum" as const }],
    },
  },
};

function expectedTickCount(width: number): number {
  const innerWidth = Math.max(width - 56, 8);
  return thinCategoryTickIndices(CATEGORY_COUNT, innerWidth, 56).length;
}

describe("CustomVizWidget axisPlan resize", () => {
  afterEach(() => {
    cleanup();
    sizeStore.width = 320;
    sizeStore.height = 200;
  });

  it("recomputes axisPlan tick density when host layout width changes", async () => {
    sizeStore.width = 320;
    const { rerender } = render(<CustomVizWidget widget={widget} mode="view" />);

    const narrowTicks = expectedTickCount(320);
    await waitFor(() => {
      expect(screen.getByText(String(narrowTicks))).toBeInTheDocument();
    });

    const host = screen.getByTestId("custom-viz-host");
    const narrowPayload = JSON.parse(
      host.querySelector(`.${CUSTOM_VIZ_PAYLOAD_CLASS}`)?.textContent ?? "{}",
    );
    expect(narrowPayload.axisPlan?.categoryCount).toBe(CATEGORY_COUNT);
    expect(narrowPayload.axisPlan?.categoryTickIndices).toHaveLength(narrowTicks);
    expect(narrowPayload.layout).toEqual({ width: 320, height: 200 });

    sizeStore.width = 640;
    rerender(<CustomVizWidget widget={widget} mode="view" />);

    const wideTicks = expectedTickCount(640);
    expect(wideTicks).toBeGreaterThan(narrowTicks);

    await waitFor(() => {
      expect(screen.getByText(String(wideTicks))).toBeInTheDocument();
    });

    const widePayload = JSON.parse(
      host.querySelector(`.${CUSTOM_VIZ_PAYLOAD_CLASS}`)?.textContent ?? "{}",
    );
    expect(widePayload.axisPlan?.categoryTickIndices).toHaveLength(wideTicks);
    expect(widePayload.layout).toEqual({ width: 640, height: 200 });
  });
});

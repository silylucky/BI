import { describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { CustomVizWidget } from "./CustomVizWidget";
import { CUSTOM_VIZ_PAYLOAD_CLASS, CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION } from "./custom-viz/customVizPayload";

const { mockExecuteReturn } = vi.hoisted(() => ({
  mockExecuteReturn: {
    columns: ["region", "amount"],
    rows: [
      ["华东", 100],
      ["华北", 80],
    ],
    loading: false,
    error: null,
    slowHint: false,
  },
}));

vi.mock("@/lib/api", () => ({
  fetchWithTimeout: vi.fn(async () => ({
    ok: true,
    text: async () => "<!DOCTYPE html><html><body><div id='cv-root'></div></body></html>",
  })),
  getAuthHeaders: () => ({}),
  apiFetch: vi.fn(async () => ({
    artifactId: "550e8400-e29b-41d4-a716-446655440000",
    manifest: { defaultStyle: { accentColor: "#111111" } },
    status: "active",
    contentHash: "abc",
  })),
}));

vi.mock("@/components/charts/useChartExecute", () => ({
  useChartExecute: () => mockExecuteReturn,
}));

vi.mock("@/lib/appBasePath", () => ({
  resolveApiBaseUrl: () => "http://localhost:8000",
}));

vi.mock("@/hooks/useElementSize", () => ({
  useElementSize: () => ({
    ref: () => undefined,
    size: { width: 480, height: 240 },
    remeasure: vi.fn(),
  }),
}));

describe("CustomVizWidget payload injection", () => {
  it("injects execute rows and merged style into host payload node", async () => {
    const { getByTestId } = render(
      <CustomVizWidget
        widget={{
          id: "w1",
          type: "customViz",
          title: "AI",
          colSpan: 6,
          rowSpan: 3,
          order: 0,
          customVizConfig: {
            artifactId: "550e8400-e29b-41d4-a716-446655440000",
            dataBinding: {
              status: "connected",
              dataSourceId: "00000000-0000-4000-8000-000000000001",
              datasetId: "00000000-0000-4000-8000-000000000002",
              configId: "00000000-0000-4000-8000-000000000003",
              dimensions: [{ field: "region" }],
              metrics: [{ field: "amount", agg: "sum" }],
            },
            style: { accentColor: "#336699" },
          },
        }}
        mode="view"
      />,
    );

    await waitFor(() => {
      const host = getByTestId("custom-viz-host");
      const node = host.querySelector(`.${CUSTOM_VIZ_PAYLOAD_CLASS}`);
      expect(node).not.toBeNull();
      expect(JSON.parse(node!.textContent!)).toEqual({
        protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
        bindingStatus: "bound",
        columns: ["region", "amount"],
        rows: [
          ["华东", 100],
          ["华北", 80],
        ],
        style: { accentColor: "#336699" },
        encoding: { dimensions: ["region"], metrics: ["amount"] },
        layout: { width: 480, height: 240 },
        axisPlan: { categoryCount: 2, categoryTickIndices: [0, 1] },
      });
    });

    const host = getByTestId("custom-viz-host");
    expect(host.style.getPropertyValue("--vs-style-accent-color")).toBe("#336699");
  });
});

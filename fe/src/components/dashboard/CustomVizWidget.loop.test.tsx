import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { fetchWithTimeout } from "@/lib/api";
import htmlBundle from "../../../../docs/api/vs-ai-spec/examples/custom-viz-bundle.json";
import { CustomVizWidget } from "./CustomVizWidget";
import { CUSTOM_VIZ_PAYLOAD_CLASS } from "./custom-viz/customVizPayload";

const ARTIFACT_ID = "550e8400-e29b-41d4-a716-446655440000";

const store = vi.hoisted(() => ({
  hash: "h1",
  html: '<!DOCTYPE html><html><body><p id="cv-ver">v1</p></body></html>',
}));

vi.mock("@/lib/api", () => ({
  fetchWithTimeout: vi.fn(async (url: string) => ({
    ok: true,
    text: async () => store.html,
    json: async () => ({}),
    url,
  })),
  getAuthHeaders: () => ({}),
  apiFetch: vi.fn(async () => ({
    artifactId: ARTIFACT_ID,
    manifest: { defaultStyle: { accentColor: "#111111" } },
    status: "active",
    contentHash: store.hash,
  })),
}));

vi.mock("@/components/charts/useChartExecute", () => ({
  useChartExecute: () => ({
    columns: [],
    rows: [],
    loading: false,
    error: null,
    slowHint: false,
  }),
}));

vi.mock("@/lib/appBasePath", () => ({
  resolveApiBaseUrl: () => "http://localhost:8000",
}));

const widgetBase = {
  id: "w1",
  type: "customViz" as const,
  title: "AI",
  colSpan: 6,
  rowSpan: 3,
  order: 0,
  customVizConfig: { artifactId: ARTIFACT_ID },
};

describe("CustomVizWidget closed loop", () => {
  afterEach(() => {
    cleanup();
  });
  it("reloads HTML when the tab becomes visible after PUT (contentHash changes)", async () => {
    store.hash = "h1";
    store.html = '<!DOCTYPE html><html><body><p id="cv-ver">v1</p></body></html>';
    render(<CustomVizWidget widget={widgetBase} mode="view" />);
    await waitFor(() => {
      expect(screen.getByText("v1")).toBeInTheDocument();
    });
    expect(vi.mocked(fetchWithTimeout).mock.calls.at(-1)?.[0]).toContain("h=h1");

    store.hash = "h2";
    store.html = '<!DOCTYPE html><html><body><p id="cv-ver">v2</p></body></html>';
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => {
      expect(screen.getByText("v2")).toBeInTheDocument();
    });
    expect(screen.queryByText("v1")).not.toBeInTheDocument();
    expect(vi.mocked(fetchWithTimeout).mock.calls.at(-1)?.[0]).toContain("h=h2");
  });

  it("injects unbound payload and shows official html hint", async () => {
    store.hash = "hint";
    store.html = (htmlBundle as { files: { "index.html": string } }).files["index.html"];
    render(
      <CustomVizWidget
        widget={{
          ...widgetBase,
          customVizConfig: {
            artifactId: ARTIFACT_ID,
            dataBinding: { status: "manual" },
          },
        }}
        mode="view"
      />,
    );
    await waitFor(() => {
      expect(screen.getByText("请在右侧绑定数据集与字段")).toBeInTheDocument();
    });
    const host = screen.getByTestId("custom-viz-host");
    const payload = JSON.parse(host.querySelector(`.${CUSTOM_VIZ_PAYLOAD_CLASS}`)?.textContent ?? "{}");
    expect(payload.bindingStatus).toBe("unbound");
  });
});

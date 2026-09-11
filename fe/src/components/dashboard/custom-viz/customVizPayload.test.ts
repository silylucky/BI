import { describe, expect, it } from "vitest";
import {
  CUSTOM_VIZ_LAYOUT_UPDATE_EVENT,
  CUSTOM_VIZ_PAYLOAD_CLASS,
  CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
  buildCustomVizRuntimePayload,
  injectCustomVizPayload,
  resolveCustomVizBindingStatus,
} from "@/components/dashboard/custom-viz/customVizPayload";

describe("resolveCustomVizBindingStatus", () => {
  it("returns unbound when execute is not ready and no slot hint", () => {
    expect(
      resolveCustomVizBindingStatus({
        executeReady: false,
        loading: false,
        error: null,
        rows: [[1]],
      }),
    ).toBe("unbound");
  });

  it("returns error with slot hint when dataset is connected but fields are incomplete", () => {
    expect(
      resolveCustomVizBindingStatus({
        executeReady: false,
        loading: false,
        error: null,
        rows: [],
        slotBindingHint: "至少绑定 1 个数值列",
      }),
    ).toBe("error");
  });

  it("returns error when execute fails", () => {
    expect(
      resolveCustomVizBindingStatus({
        executeReady: true,
        loading: false,
        error: "查询失败",
        rows: [],
      }),
    ).toBe("error");
  });

  it("returns empty when bound but no rows", () => {
    expect(
      resolveCustomVizBindingStatus({
        executeReady: true,
        loading: false,
        error: null,
        rows: [],
      }),
    ).toBe("empty");
  });

  it("returns bound when rows exist", () => {
    expect(
      resolveCustomVizBindingStatus({
        executeReady: true,
        loading: false,
        error: null,
        rows: [["a", 1]],
      }),
    ).toBe("bound");
  });
});

describe("buildCustomVizRuntimePayload", () => {
  it("includes protocolVersion and error on failure", () => {
    const payload = buildCustomVizRuntimePayload({
      executeReady: true,
      loading: false,
      error: "查询失败",
      columns: [],
      rows: [],
      style: {},
    });
    expect(payload.protocolVersion).toBe(CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION);
    expect(payload.bindingStatus).toBe("error");
    expect(payload.error).toBe("查询失败");
  });

  it("surfaces slot binding hint as payload error when execute is blocked", () => {
    const payload = buildCustomVizRuntimePayload({
      executeReady: false,
      loading: false,
      error: null,
      columns: [],
      rows: [],
      style: {},
      slotBindingHint: "至少绑定 1 个数值列",
    });
    expect(payload.bindingStatus).toBe("error");
    expect(payload.error).toBe("至少绑定 1 个数值列");
  });

  it("includes encoding when bound fields provided", () => {
    const payload = buildCustomVizRuntimePayload({
      executeReady: true,
      loading: false,
      error: null,
      columns: ["sale_date", "amount"],
      rows: [["2024-01-01", 10]],
      style: {},
      encoding: { dimensions: ["sale_date"], metrics: ["amount"] },
    });
    expect(payload.encoding).toEqual({ dimensions: ["sale_date"], metrics: ["amount"] });
  });

  it("includes layout, axisPlan and truncated metadata", () => {
    const payload = buildCustomVizRuntimePayload({
      executeReady: true,
      loading: false,
      error: null,
      columns: ["a"],
      rows: [[1]],
      style: {},
      layout: { width: 480, height: 240 },
      truncated: true,
      rowCap: 500,
    });
    expect(payload.layout).toEqual({ width: 480, height: 240 });
    expect(payload.axisPlan?.categoryCount).toBe(1);
    expect(payload.axisPlan?.categoryTickIndices).toEqual([0]);
    expect(payload.truncated).toBe(true);
    expect(payload.rowCap).toBe(500);
  });
});

describe("injectCustomVizPayload", () => {
  it("writes JSON payload node and style CSS variables on host", () => {
    const host = document.createElement("div");
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["region", "amount"],
      rows: [
        ["华东", 100],
        ["华北", 80],
      ],
      style: { accentColor: "#336699", barHeight: 24 },
    });

    const node = host.querySelector(`.${CUSTOM_VIZ_PAYLOAD_CLASS}`);
    expect(node).not.toBeNull();
    expect(node?.textContent).toBe(
      JSON.stringify({
        protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
        bindingStatus: "bound",
        columns: ["region", "amount"],
        rows: [
          ["华东", 100],
          ["华北", 80],
        ],
        style: { accentColor: "#336699", barHeight: 24 },
      }),
    );
    expect(host.style.getPropertyValue("--vs-style-accent-color")).toBe("#336699");
    expect(host.style.getPropertyValue("--vs-style-bar-height")).toBe("24");
  });

  it("updates existing payload node in place", () => {
    const host = document.createElement("div");
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "unbound",
      columns: ["a"],
      rows: [[1]],
      style: {},
    });
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["b"],
      rows: [[2]],
      style: { foo: "bar" },
    });
    expect(host.querySelectorAll(`.${CUSTOM_VIZ_PAYLOAD_CLASS}`)).toHaveLength(1);
    expect(JSON.parse(host.querySelector(`.${CUSTOM_VIZ_PAYLOAD_CLASS}`)!.textContent!)).toEqual({
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["b"],
      rows: [[2]],
      style: { foo: "bar" },
    });
  });

  it("skips redundant inject with identical payload", () => {
    const host = document.createElement("div");
    let events = 0;
    host.addEventListener("vs-cv-payload-update", () => {
      events += 1;
    });
    const payload = {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound" as const,
      columns: ["a"],
      rows: [[1]],
      style: { accentColor: "#111" },
    };
    injectCustomVizPayload(host, payload);
    injectCustomVizPayload(host, payload);
    expect(events).toBe(1);
    expect(host.querySelectorAll(`.${CUSTOM_VIZ_PAYLOAD_CLASS}`)).toHaveLength(1);
  });

  it("dispatches vs-cv-payload-update for bundle listeners", () => {
    const host = document.createElement("div");
    let detail: unknown;
    host.addEventListener("vs-cv-payload-update", (e) => {
      detail = (e as CustomEvent).detail;
    });
    const payload = {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "unbound" as const,
      columns: ["x"],
      rows: [[9]],
      style: {},
    };
    injectCustomVizPayload(host, payload);
    expect(detail).toEqual(payload);
  });

  it("dispatches vs-cv-layout-update when layout changes", () => {
    const host = document.createElement("div");
    let layoutDetail: unknown;
    host.addEventListener(CUSTOM_VIZ_LAYOUT_UPDATE_EVENT, (e) => {
      layoutDetail = (e as CustomEvent).detail;
    });
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["a"],
      rows: [[1]],
      style: {},
      layout: { width: 320, height: 200 },
    });
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["a"],
      rows: [[1]],
      style: {},
      layout: { width: 640, height: 200 },
    });
    expect(layoutDetail).toEqual({ width: 640, height: 200 });
  });
});

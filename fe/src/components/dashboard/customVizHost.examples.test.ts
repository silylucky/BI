import { afterEach, describe, expect, it } from "vitest";
import medalBundle from "../../../../docs/api/vs-ai-spec/examples/custom-viz-ranking-bar-medal.json";
import alertFeed from "../../../../docs/api/vs-ai-spec/examples/custom-viz-alert-feed.json";
import htmlBundle from "../../../../docs/api/vs-ai-spec/examples/custom-viz-bundle.json";
import d3Bundle from "../../../../docs/api/vs-ai-spec/examples/custom-viz-d3-bundle.json";
import pulseKpi from "../../../../docs/api/vs-ai-spec/examples/custom-viz-pulse-kpi.json";
import ringProgress from "../../../../docs/api/vs-ai-spec/examples/custom-viz-ring-progress.json";
import { mountCustomVizHtml } from "./customVizHost";
import {
  CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
  injectCustomVizPayload,
} from "./custom-viz/customVizPayload";

const UNBOUND_HINT = "请在右侧绑定数据集与字段";

type ExampleBundle = { files: { "index.html": string } };

const HTML_EXAMPLES: Array<{ name: string; bundle: ExampleBundle; root: string }> = [
  { name: "bundle", bundle: htmlBundle as ExampleBundle, root: "#vs-cv-root" },
  { name: "pulse-kpi", bundle: pulseKpi as ExampleBundle, root: "#vs-cv-kpi" },
  { name: "ring-progress", bundle: ringProgress as ExampleBundle, root: "#vs-cv-rings" },
  { name: "alert-feed", bundle: alertFeed as ExampleBundle, root: "#vs-cv-track" },
  { name: "d3-bundle", bundle: d3Bundle as ExampleBundle, root: "#vs-cv-chart" },
  { name: "ranking-bar-medal", bundle: medalBundle as ExampleBundle, root: "#vs-cv-root" },
];

const hosts: HTMLElement[] = [];

function mountExample(html: string): HTMLElement {
  const host = document.createElement("div");
  host.className = "vs-custom-viz-host";
  document.body.appendChild(host);
  hosts.push(host);
  mountCustomVizHtml(host, html);
  return host;
}

afterEach(() => {
  while (hosts.length) {
    hosts.pop()?.remove();
  }
});

describe("official customViz examples", () => {
  it.each(HTML_EXAMPLES)("shows unbound hint for $name", ({ bundle, root }) => {
    const host = mountExample(bundle.files["index.html"]);
    expect(host.querySelector(root)?.textContent).toContain(UNBOUND_HINT);
  });

  it("two hosts with the same official html do not steal each other's root", () => {
    const html = (htmlBundle as ExampleBundle).files["index.html"];
    const a = mountExample(html);
    const b = mountExample(html);
    const rootA = a.querySelector("#vs-cv-root");
    const rootB = b.querySelector("#vs-cv-root");
    expect(rootA).toBeTruthy();
    expect(rootB).toBeTruthy();
    expect(rootA).not.toBe(rootB);
    if (rootA) rootA.textContent = "HOST_A_MARK";
    expect(b.querySelector("#vs-cv-root")?.textContent).toContain(UNBOUND_HINT);
    expect(a.querySelector("#vs-cv-root")?.textContent).toBe("HOST_A_MARK");
  });

  it("draws d3 bars from vsCv payload rows", () => {
    const host = mountExample((d3Bundle as ExampleBundle).files["index.html"]);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["region", "amount"],
      rows: [
        ["华东", 10],
        ["华北", 20],
      ],
      style: {},
    });
    const rects = host.querySelectorAll("#vs-cv-chart rect");
    expect(rects.length).toBe(2);
  });

  it("ranking strip respects platform labelShow=false from payload style", () => {
    const host = mountExample((htmlBundle as ExampleBundle).files["index.html"]);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["region", "amount"],
      rows: [["华东", 10]],
      style: { labelShow: false },
    });
    expect(host.querySelector("#vs-cv-root .lbl")).toBeNull();
    expect(host.querySelector("#vs-cv-root .bar")).toBeTruthy();
  });

  it("d3 example thins axis labels for dense categories", () => {
    const host = mountExample((d3Bundle as ExampleBundle).files["index.html"]);
    const rows = Array.from({ length: 40 }, (_, index) => [`类目${index}`, index + 1]);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["region", "amount"],
      rows,
      style: {},
      layout: { width: 320, height: 200 },
    });
    const labels = host.querySelectorAll("#vs-cv-chart text.lbl");
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.length).toBeLessThan(rows.length);
  });

  it("d3 example resizes SVG when payload layout width changes", () => {
    const host = mountExample((d3Bundle as ExampleBundle).files["index.html"]);
    const rows = [
      ["华东", 10],
      ["华北", 20],
    ];
    const basePayload = {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound" as const,
      columns: ["region", "amount"],
      rows,
      style: {},
    };
    injectCustomVizPayload(host, {
      ...basePayload,
      layout: { width: 320, height: 200 },
    });
    const svg = host.querySelector("#vs-cv-chart");
    expect(svg?.getAttribute("width")).toBe("320");
    expect(svg?.getAttribute("height")).toBe("200");

    injectCustomVizPayload(host, {
      ...basePayload,
      layout: { width: 640, height: 200 },
      axisPlan: { categoryCount: 2, categoryTickIndices: [0, 1] },
    });
    expect(svg?.getAttribute("width")).toBe("640");
    expect(svg?.getAttribute("height")).toBe("200");
  });

  it("d3 example shows empty and error hints through mount render", () => {
    const host = mountExample((d3Bundle as ExampleBundle).files["index.html"]);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "empty",
      columns: ["region", "amount"],
      rows: [],
      style: {},
      layout: { width: 320, height: 200 },
    });
    expect(host.querySelector("#vs-cv-chart")?.textContent).toContain("暂无数据");

    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "error",
      columns: [],
      rows: [],
      style: {},
      error: "查询失败",
      layout: { width: 320, height: 200 },
    });
    expect(host.querySelector("#vs-cv-chart")?.textContent).toContain("查询失败");
  });

  it("ranking bar medal sorts descending and renders top-3 badge classes", () => {
    const host = mountExample((medalBundle as ExampleBundle).files["index.html"]);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["category", "value"],
      rows: [
        ["丙", 30],
        ["甲", 100],
        ["乙", 60],
        ["丁", 10],
      ],
      style: { showAnimation: false },
    });
    const labels = Array.from(host.querySelectorAll("#vs-cv-root .lbl")).map((node) => node.textContent);
    expect(labels).toEqual(["甲", "乙", "丙", "丁"]);
    expect(host.querySelector("#vs-cv-root .badge.rank-1")?.textContent).toBe("1");
    expect(host.querySelector("#vs-cv-root .badge.rank-2")?.textContent).toBe("2");
    expect(host.querySelector("#vs-cv-root .badge.rank-3")?.textContent).toBe("3");
    expect(host.querySelectorAll("#vs-cv-root .badge.rank-other")).toHaveLength(1);
  });

  it("ranking bar medal formats values with percent and thousands", () => {
    const host = mountExample((medalBundle as ExampleBundle).files["index.html"]);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["category", "value"],
      rows: [["份额", 0.25]],
      style: { showAnimation: false, valueFormatter: "percent" },
    });
    expect(host.querySelector("#vs-cv-root .val")?.textContent).toBe("25.0%");

    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["category", "value"],
      rows: [["销量", 1500]],
      style: { showAnimation: false, valueFormatter: "thousands" },
    });
    expect(host.querySelector("#vs-cv-root .val")?.textContent).toBe("1.5k");
  });

  it("ranking bar medal hides badges when showRankBadge is false", () => {
    const host = mountExample((medalBundle as ExampleBundle).files["index.html"]);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["category", "value"],
      rows: [
        ["甲", 100],
        ["乙", 60],
      ],
      style: { showAnimation: false, showRankBadge: false },
    });
    expect(host.querySelectorAll("#vs-cv-root .badge")).toHaveLength(0);
    expect(host.querySelectorAll("#vs-cv-root .row")).toHaveLength(2);
  });

  it("ranking bar medal renders all payload rows", () => {
    const host = mountExample((medalBundle as ExampleBundle).files["index.html"]);
    const rows = Array.from({ length: 5 }, (_, index) => [`项${index}`, index + 1]);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["category", "value"],
      rows,
      layout: { width: 480, height: 320 },
      style: { showAnimation: false },
    });
    expect(host.querySelectorAll("#vs-cv-root .row")).toHaveLength(5);
  });

  it("ranking bar medal keeps all rows and uses scroll container", () => {
    const host = mountExample((medalBundle as ExampleBundle).files["index.html"]);
    const rows = Array.from({ length: 12 }, (_, index) => [`项${index}`, index + 1]);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["category", "value"],
      rows,
      layout: { width: 480, height: 200 },
      style: { showAnimation: false, barHeight: 28, gap: 12 },
    });
    expect(host.querySelectorAll("#vs-cv-root .row")).toHaveLength(12);
    const root = host.querySelector("#vs-cv-root");
    expect(root).not.toBeNull();
    if (root) {
      expect(window.getComputedStyle(root).overflowY).toBe("auto");
    }
  });

  it("ranking bar medal scales bar width by max value", () => {
    const host = mountExample((medalBundle as ExampleBundle).files["index.html"]);
    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: ["category", "value"],
      rows: [
        ["低", 10],
        ["高", 100],
      ],
      style: { showAnimation: false },
    });
    const widths = Array.from(host.querySelectorAll("#vs-cv-root .fill")).map(
      (node) => parseFloat((node as HTMLElement).style.width),
    );
    expect(widths[0]).toBeGreaterThan(widths[1]);
    expect(widths[0]).toBeCloseTo(100, 0);
    expect(widths[1]).toBeCloseTo(10, 0);
  });
});

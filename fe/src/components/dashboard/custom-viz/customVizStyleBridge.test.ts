import { describe, expect, it } from "vitest";
import { mountCustomVizHtml } from "../customVizHost";
import { CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION, injectCustomVizPayload } from "./customVizPayload";
import { appendCustomVizStyleBridge, applyCustomVizStyleBridgeDom } from "./customVizStyleBridge";

describe("customVizStyleBridge", () => {
  it("injects bridge stylesheet and maps accentColor to host CSS var", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    document.body.appendChild(host);

    const html = `<!DOCTYPE html><html><head><style>.fill{width:40px;height:12px;background:#000000}</style></head><body><div class="fill"></div></body></html>`;
    mountCustomVizHtml(host, html);
    expect(host.querySelector(".vs-cv-style-bridge")).toBeTruthy();

    injectCustomVizPayload(host, {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound",
      columns: [],
      rows: [],
      style: { accentColor: "#ff0000" },
    });
    expect(host.style.getPropertyValue("--vs-style-accent-color")).toBe("#ff0000");
    host.remove();
  });

  it("hides badges when showRankBadge is false", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    host.innerHTML = '<div class="badge">1</div><div class="badge">2</div>';
    document.body.appendChild(host);
    appendCustomVizStyleBridge(host);

    applyCustomVizStyleBridgeDom(host, { showRankBadge: false });
    expect(host.getAttribute("data-vs-show-rank-badge")).toBe("false");
    host.querySelectorAll(".badge").forEach((node) => {
      expect((node as HTMLElement).style.display).toBe("none");
    });
    host.remove();
  });

  it("re-applies accentColor without changing rows", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    document.body.appendChild(host);
    const base = {
      protocolVersion: CUSTOM_VIZ_PAYLOAD_PROTOCOL_VERSION,
      bindingStatus: "bound" as const,
      columns: ["x"],
      rows: [[1]],
      style: { accentColor: "#111111" },
    };
    injectCustomVizPayload(host, base);
    injectCustomVizPayload(host, { ...base, style: { accentColor: "#222222" } });
    expect(host.style.getPropertyValue("--vs-style-accent-color")).toBe("#222222");
    host.remove();
  });

  it("hides tooltip when tooltipShow is false", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    host.innerHTML = '<div id="tooltip" class="tooltip">tip</div>';
    document.body.appendChild(host);
    appendCustomVizStyleBridge(host);

    applyCustomVizStyleBridgeDom(host, { tooltipShow: false });
    expect(host.getAttribute("data-vs-tooltip-show")).toBe("false");
    expect((host.querySelector("#tooltip") as HTMLElement).style.display).toBe("none");
    host.remove();
  });

  it("appends manifest hook stylesheet when provided", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    document.body.appendChild(host);
    appendCustomVizStyleBridge(host, {
      accentColor: { selectors: [".custom-bar"] },
    });
    expect(host.querySelector(".vs-cv-style-hooks")?.textContent).toContain(".custom-bar");
    host.remove();
  });

  it("applies SVG area gradient when seriesGradient is true", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    host.innerHTML =
      '<svg><defs></defs><path class="trend-area" fill="#10b981" fill-opacity="0.4"></path></svg>';
    document.body.appendChild(host);
    appendCustomVizStyleBridge(host);

    applyCustomVizStyleBridgeDom(host, { seriesGradient: true, accentColor: "#336699" });
    const area = host.querySelector(".trend-area") as SVGPathElement;
    expect(area.getAttribute("fill")).toMatch(/^url\(#vs-cv-series-grad-/);
    expect(area.getAttribute("fill-opacity")).toBe("1");
    host.remove();
  });

  it("restores solid area fill when seriesGradient is false", () => {
    const host = document.createElement("div");
    host.className = "vs-custom-viz-host";
    host.innerHTML = '<svg><path class="trend-area" fill="url(#old)"></path></svg>';
    document.body.appendChild(host);

    applyCustomVizStyleBridgeDom(host, { seriesGradient: false, accentColor: "#abcdef" });
    const area = host.querySelector(".trend-area") as SVGPathElement;
    expect(area.getAttribute("fill")).toBe("#abcdef");
    host.remove();
  });
});

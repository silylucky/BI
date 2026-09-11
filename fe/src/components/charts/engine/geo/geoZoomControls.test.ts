import * as d3 from "d3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mountGeoZoomControls } from "./geoZoomControls";

describe("mountGeoZoomControls", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("renders zoom in, zoom out, and refresh buttons", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    container.appendChild(svg);
    const g = d3.select(svg).append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>();

    const detach = mountGeoZoomControls({
      container,
      svg,
      zoom,
      zoomRoot: g,
    });

    const bar = container.querySelector('[data-testid="geo-zoom-controls"]');
    expect(bar).toBeTruthy();
    expect(container.querySelector('[aria-label="放大"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="缩小"]')).toBeTruthy();
    expect(container.querySelector('[aria-label="刷新"]')).toBeTruthy();

    detach();
  });

  it("resets zoom and calls refresh when refresh is clicked", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "400");
    svg.setAttribute("height", "320");
    container.appendChild(svg);
    const g = d3.select(svg).append("g");
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .extent([
        [0, 0],
        [400, 320],
      ])
      .on("zoom", (event) => {
        g.attr("transform", event.transform.toString());
      });
    d3.select(svg).call(zoom);
    d3.select(svg).call(zoom.transform, d3.zoomIdentity.translate(40, 30).scale(2));
    const onRefresh = vi.fn();

    const detach = mountGeoZoomControls({
      container,
      svg,
      zoom,
      zoomRoot: g,
      onRefresh,
    });

    const refreshBtn = container.querySelector('[aria-label="刷新"]') as HTMLButtonElement;
    refreshBtn.click();

    await new Promise((resolve) => setTimeout(resolve, 220));

    const transform = d3.zoomTransform(svg);
    expect(transform.x).toBeCloseTo(0, 5);
    expect(transform.y).toBeCloseTo(0, 5);
    expect(transform.k).toBeCloseTo(1, 5);
    expect(onRefresh).toHaveBeenCalled();
    detach();
  });
});

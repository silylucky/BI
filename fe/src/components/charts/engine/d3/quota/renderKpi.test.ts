import { afterEach, describe, expect, it } from "vitest";
import { renderD3KpiChart } from "./renderKpi";

function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  return container;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("renderD3KpiChart", () => {
  it("renders value above label for dimension count metric", () => {
    const container = mount();
    const cleanup = renderD3KpiChart(container, {
      width: 320,
      height: 160,
      options: {
        metrics: [{ field: "region_name", label: "region_name" }],
        rows: [
          ["华北", 1],
          ["华东", 1],
          ["华南", 1],
        ],
        columns: ["region_name", "amount"],
      },
      colors: ["#465fff"],
      valueFormat: undefined,
    });

    const ps = Array.from(container.querySelectorAll("p"));
    expect(ps[0]?.textContent).toMatch(/0|44|3/);
    expect(ps[1]?.textContent).toContain("region_name");
    expect(ps[1]?.textContent).toContain("计数");
    cleanup();
  });

  it("renders row-oriented indicators when label dimension exists in data", () => {
    const container = mount();
    const cleanup = renderD3KpiChart(container, {
      width: 400,
      height: 120,
      options: {
        metrics: [{ field: "数值", label: "数值" }],
        labelField: "指标",
        rows: [
          ["办件量", 1280],
          ["在线率", 92.5],
        ],
        columns: ["指标", "数值"],
      },
      colors: ["#465fff"],
      valueFormat: undefined,
    });

    const labels = Array.from(container.querySelectorAll("p")).map((el) => el.textContent);
    expect(labels).toContain("办件量");
    expect(labels).toContain("在线率");
    cleanup();
  });

  it("applies right alignment from style options", () => {
    const container = mount();
    const cleanup = renderD3KpiChart(container, {
      width: 320,
      height: 160,
      options: {
        metrics: [{ field: "amount", label: "销售额" }],
        rows: [[1280]],
        columns: ["amount"],
        __kpiAlign: "right",
      },
      colors: ["#465fff"],
      valueFormat: undefined,
    });

    const layout = container.querySelector(".vs-kpi-chart > div");
    expect(layout?.className).toContain("items-end");
    expect(layout?.style.textAlign).toBe("right");
    cleanup();
  });
});

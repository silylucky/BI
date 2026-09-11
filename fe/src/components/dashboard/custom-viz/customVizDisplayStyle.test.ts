import { describe, expect, it } from "vitest";
import {
  mergeCustomVizTitleStyle,
  readCustomVizRemark,
  resolveCustomVizContentShellStyle,
  resolveCustomVizRuntimeStyle,
  resolveCustomVizWidgetShellStyle,
  stripCustomVizDisplayStyleOverrides,
  syncCustomVizWidgetsForColorScheme,
  syncCustomVizWidgetsForDashboardScopes,
} from "./customVizDisplayStyle";

describe("resolveCustomVizRuntimeStyle", () => {
  it("merges manifest default, displayStyle, and schema style", () => {
    const style = resolveCustomVizRuntimeStyle({
      manifestDefault: { accentColor: "#111", barHeight: 12 },
      config: {
        artifactId: "a1",
        displayStyle: {
          title: { show: true, color: "#abc" },
          label: { show: false },
        },
        style: { accentColor: "#222", cornerRadius: 6 },
      },
    });

    expect(style).toEqual({
      accentColor: "#222",
      barHeight: 12,
      titleShow: true,
      titleColor: "#abc",
      labelShow: false,
      cornerRadius: 6,
      paletteColors: ["#465fff", "#7a5af8", "#12b76a", "#0ba5ec", "#ee46bc"],
      tooltipShow: true,
    });
  });

  it("uses display palette for accentColor when schema style has no explicit accent", () => {
    const style = resolveCustomVizRuntimeStyle({
      manifestDefault: { accentColor: "#10b981", lineWidth: 3 },
      config: {
        artifactId: "a1",
        displayStyle: { paletteId: "nightfall" },
        style: { lineWidth: 5 },
      },
      dashboardStyle: {},
    });

    expect(style.accentColor).not.toBe("#10b981");
    expect(style.lineWidth).toBe(5);
    expect(Array.isArray(style.paletteColors)).toBe(true);
    expect((style.paletteColors as string[]).length).toBeGreaterThan(0);
    expect(style.accentColor).toBe((style.paletteColors as string[])[0]);
  });

  it("keeps schema accentColor over display palette", () => {
    const style = resolveCustomVizRuntimeStyle({
      manifestDefault: { accentColor: "#10b981" },
      config: {
        artifactId: "a1",
        displayStyle: { paletteId: "nightfall" },
        style: { accentColor: "#ff00ff" },
      },
    });

    expect(style.accentColor).toBe("#ff00ff");
  });

  it("injects inherited label and tooltip visibility into payload style", () => {
    const style = resolveCustomVizRuntimeStyle({
      manifestDefault: {},
      config: { artifactId: "a1" },
      dashboardStyle: {
        chartLabelShow: false,
        tooltipShow: true,
        chartLabelStyle: { color: "#abc", fontSize: 14 },
        chartTooltipStyle: { color: "#def", background: "#111", fontSize: 13 },
      },
    });

    expect(style.labelShow).toBe(false);
    expect(style.tooltipShow).toBe(true);
    expect(style.labelColor).toBe("#abc");
    expect(style.labelFontSize).toBe(14);
    expect(style.tooltipColor).toBe("#def");
    expect(style.tooltipBackground).toBe("#111");
    expect(style.tooltipFontSize).toBe(13);
  });
});

describe("stripCustomVizDisplayStyleOverrides", () => {
  it("clears background, palette, and color overrides while keeping structure fields", () => {
    const next = stripCustomVizDisplayStyleOverrides({
      background: { background: "#ff0000", padding: 8 },
      paletteId: "warm",
      paletteColors: ["#111111"],
      title: { fontSize: 16, color: "#abc" },
      label: { position: "outside", color: "#def" },
      tooltip: { fontSize: 12, color: "#000", background: "#fff" },
      border: { width: 2, color: "#999" },
    });

    expect(next).toEqual({
      title: { fontSize: 16 },
      label: { position: "outside" },
      tooltip: { fontSize: 12 },
      border: { width: 2 },
    });
  });
});

describe("resolveCustomVizWidgetShellStyle", () => {
  it("merges dashboard, advanced widgetStyle, and style-tab background", () => {
    const merged = resolveCustomVizWidgetShellStyle(
      {
        customVizConfig: {
          artifactId: "a1",
          widgetStyle: { background: "#613e3e", backgroundShow: true },
          displayStyle: {
            background: { backgroundShow: false, padding: 12 },
            border: { show: true, color: "#999", width: 2 },
          },
        },
      },
      { widgetStyle: { background: "#ffffff", borderRadius: 8 } },
    );

    expect(merged?.background).toBe("#613e3e");
    expect(merged?.backgroundShow).toBe(false);
    expect(merged?.padding).toBe(12);
    expect(merged?.borderRadius).toBe(8);
    expect(merged?.borderEnabled).toBe(true);
    expect(merged?.borderColor).toBe("#999");
    expect(merged?.borderWidth).toBe(2);
  });

  it("respects backgroundShow false in rendered shell", () => {
    const shell = resolveCustomVizContentShellStyle(
      {
        customVizConfig: {
          artifactId: "a1",
          displayStyle: { background: { backgroundShow: false } },
        },
      },
      { widgetStyle: { background: "#613e3e", backgroundShow: true } },
      "light",
    );

    expect(shell.outer.style.backgroundColor).toBe("transparent");
  });
});

describe("customViz title and remark chrome", () => {
  it("reads remark visibility and merges title overrides", () => {
    expect(
      readCustomVizRemark({
        artifactId: "a1",
        displayStyle: { remark: { show: true, text: "  备注  " } },
      }),
    ).toEqual({ show: true, text: "备注" });

    expect(
      mergeCustomVizTitleStyle(
        { fontSize: 14, color: "#111" },
        { artifactId: "a1", displayStyle: { title: { color: "#abc", fontSize: 20 } } },
        "light",
      ),
    ).toMatchObject({ color: "#abc", fontSize: "20px" });
  });
});

describe("syncCustomVizWidgetsForDashboardScopes", () => {
  it("clears customViz overrides when dashboard palette/widget/title changes", () => {
    const widgets = syncCustomVizWidgetsForDashboardScopes(
      [
        {
          id: "cv1",
          type: "customViz",
          title: "排名条",
          colSpan: 6,
          rowSpan: 4,
          customVizConfig: {
            artifactId: "a1",
            widgetStyle: { background: "#613e3e", backgroundShow: true },
            displayStyle: {
              title: { show: true, fontSize: 20 },
              background: { backgroundShow: false },
              paletteId: "warm",
              label: { show: false, color: "#fff" },
            },
          },
        },
      ],
      new Set(["title", "widgetAppearance", "palette"]),
    );

    expect(widgets[0].type === "customViz" && widgets[0].customVizConfig).toEqual({
      artifactId: "a1",
      displayStyle: undefined,
    });
  });

  it("keeps schema style and data binding untouched", () => {
    const widgets = syncCustomVizWidgetsForDashboardScopes(
      [
        {
          id: "cv1",
          type: "customViz",
          title: "排名条",
          colSpan: 6,
          rowSpan: 4,
          customVizConfig: {
            artifactId: "a1",
            style: { accentColor: "#222", showRankBadge: true },
            displayStyle: { paletteId: "warm" },
          },
        },
      ],
      new Set(["palette"]),
    );

    expect(widgets[0].type === "customViz" && widgets[0].customVizConfig).toEqual({
      artifactId: "a1",
      style: { accentColor: "#222", showRankBadge: true },
      displayStyle: undefined,
    });
  });
});

describe("syncCustomVizWidgetsForColorScheme", () => {
  it("clears palette and mismatched shell overrides on theme switch", () => {
    const widgets = syncCustomVizWidgetsForColorScheme(
      [
        {
          id: "cv1",
          type: "customViz",
          title: "排名条",
          colSpan: 6,
          rowSpan: 4,
          customVizConfig: {
            artifactId: "a1",
            widgetStyle: { background: "#ffffff", backgroundShow: true },
            displayStyle: {
              paletteId: "warm",
              background: { background: "#ffffff", backgroundShow: true },
              title: { color: "#1d2939" },
            },
          },
        },
      ],
      "dark",
    );

    expect(widgets[0].type === "customViz" && widgets[0].customVizConfig).toEqual({
      artifactId: "a1",
      displayStyle: undefined,
      widgetStyle: undefined,
    });
  });
});

import { describe, expect, it } from "vitest";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import {
  inferWidgetSyncScopes,
  mergeChartTitleStyle,
  mergeShapeInnerPresentation,
  patchChartDeStyleNested,
  patchChartLabelStyle,
  patchChartShowLabel,
  readChartLegendVisible,
  readChartLegendPosition,
  readChartShowLabel,
  resolveChartLabelDisplayColor,
  readChartTitleVisible,
  resolveChartContentShellStyle,
  resolveEffectiveWidgetShellConfig,
  readEffectiveChartBorder,
  resolveWidgetShellStyle,
  stripChartLabelFormatOverrides,
  stripChartPaletteOverrides,
  stripChartQueryLimitOverride,
  stripChartTitleOverrides,
  stripChartWidgetAppearanceOverrides,
  syncChartWidgetsForDashboardScopes,
  syncChartWidgetsForDashboardTitleStyle,
  mergeShapeInnerPresentation,
  widgetStyleToContentCss,
  resolveEffectivePaletteColors,
  patchChartPaletteDeStyle,
  readChartDeStyle,
} from "./chartDeStyle";
import { mergeWidgetShellStyle } from "@/components/dashboard/dashboardStyleConfig";

const baseCfg: ChartViewConfig = { chartType: "bar", dataSourceId: "ds-1" };

describe("widgetStyleToContentCss", () => {
  it("applies individual padding and unified radius", () => {
    const { surface } = widgetStyleToContentCss({
      background: "#ffffff",
      paddingMode: "individual",
      paddingTop: 4,
      paddingRight: 8,
      paddingBottom: 12,
      paddingLeft: 16,
      borderRadius: 6,
    });
    expect(surface.padding).toBe("4px 8px 12px 16px");
    expect(surface.borderRadius).toBe("6px");
    expect(surface.background).toBe("#ffffff");
  });

  it("applies backdrop blur on image layer without inheriting shell opacity", () => {
    const { surface, backgroundLayer } = widgetStyleToContentCss({
      backgroundImage: "https://example.com/bg.png",
      backdropBlur: 8,
      opacity: 0.9,
    });
    expect(surface.opacity).toBeUndefined();
    expect(surface.backdropFilter).toBeUndefined();
    expect(backgroundLayer?.backgroundImage).toContain("example.com/bg.png");
    expect(backgroundLayer?.filter).toBe("blur(8px)");
    expect(backgroundLayer?.opacity).toBeUndefined();
  });

  it("uses backgroundImageOpacity only on image layer", () => {
    const { backgroundLayer } = widgetStyleToContentCss({
      backgroundImage: "https://example.com/bg.png",
      opacity: 0,
      backgroundImageOpacity: 0.5,
    });
    expect(backgroundLayer?.opacity).toBe(0.5);
  });

  it("keeps custom background color when enabling backdrop blur", () => {
    const { backgroundLayer } = widgetStyleToContentCss({
      background: "#abcdef",
      backgroundImage: "https://example.com/bg.png",
      backdropBlur: 12,
    });
    expect(backgroundLayer?.background).toBeUndefined();
    expect(backgroundLayer?.backgroundImage).toContain("example.com/bg.png");
    expect(backgroundLayer?.backdropFilter).toBeUndefined();
    expect(backgroundLayer?.filter).toBe("blur(12px)");
    expect(backgroundLayer?.transform).toContain("scale");
  });

  it("keeps background image when blur toggles from zero to non-zero", () => {
    const withoutBlur = widgetStyleToContentCss({
      backgroundImage: "https://example.com/bg.png",
      backdropBlur: 0,
    });
    const withBlur = widgetStyleToContentCss({
      backgroundImage: "https://example.com/bg.png",
      backdropBlur: 12,
    });
    expect(withoutBlur.backgroundLayer?.backgroundImage).toContain("example.com/bg.png");
    expect(withoutBlur.backgroundLayer?.filter).toBeUndefined();
    expect(withBlur.backgroundLayer?.backgroundImage).toContain("example.com/bg.png");
    expect(withBlur.backgroundLayer?.filter).toBe("blur(12px)");
  });

  it("uses backdrop blur for frosted glass without background image", () => {
    const { backgroundLayer } = widgetStyleToContentCss({
      backdropBlur: 8,
    });
    expect(backgroundLayer?.backdropFilter).toBe("blur(8px)");
    expect(backgroundLayer?.WebkitBackdropFilter).toBe("blur(8px)");
    expect(backgroundLayer?.filter).toBeUndefined();
  });
});

describe("mergeChartTitleStyle", () => {
  it("uses dashboard titleStyle when chart has no presentation override", () => {
    const style = mergeChartTitleStyle(
      { fontSize: 20, color: "#112233" },
      baseCfg,
      "light",
    );
    expect(style).toEqual({ fontSize: "20px", color: "#112233" });
  });

  it("chart deStyle.title still overrides dashboard titleStyle", () => {
    const cfg = patchChartDeStyleNested(baseCfg, "title", { fontSize: 24, color: "#ff0000" });
    const style = mergeChartTitleStyle({ fontSize: 14, color: "#112233" }, cfg, "light");
    expect(style.fontSize).toBe("24px");
    expect(style.color).toBe("#ff0000");
  });
});

describe("stripChartTitleOverrides", () => {
  it("removes entire title block", () => {
    const cfg = patchChartDeStyleNested(baseCfg, "title", {
      show: false,
      fontSize: 22,
      color: "#aabbcc",
    });
    expect(stripChartTitleOverrides(cfg).nativeBody?.deStyle?.title).toBeUndefined();
  });
});

describe("readChartLegendPosition", () => {
  it("defaults to bottom when unset", () => {
    expect(readChartLegendPosition({})).toBe("bottom");
    expect(readChartLegendPosition({ legend: { show: true } })).toBe("bottom");
    expect(readChartLegendPosition({ legend: { position: "left" } })).toBe("left");
  });

  it("reconciles stale position from hAlign/vAlign", () => {
    expect(
      readChartLegendPosition({ legend: { position: "bottom", hAlign: "right", vAlign: "middle" } }),
    ).toBe("right");
    expect(
      readChartLegendPosition({ legend: { position: "bottom", hAlign: "right", vAlign: "bottom" } }),
    ).toBe("bottom");
  });
});

describe("readChartLegendVisible", () => {
  it("defaults visible in embedded widgets until explicitly disabled", () => {
    expect(readChartLegendVisible({}, { embedded: true })).toBe(true);
    expect(readChartLegendVisible({ legend: { show: true } }, { embedded: true })).toBe(true);
    expect(readChartLegendVisible({ legend: { show: false } }, { embedded: true })).toBe(false);
  });

  it("defaults visible in full-size preview", () => {
    expect(readChartLegendVisible({})).toBe(true);
    expect(readChartLegendVisible({ legend: { show: false } })).toBe(false);
  });
});

describe("readChartTitleVisible", () => {
  it("falls back to global titleStyle.show", () => {
    expect(readChartTitleVisible(baseCfg, { show: false })).toBe(false);
    const hidden = patchChartDeStyleNested(baseCfg, "title", { show: false });
    expect(readChartTitleVisible(hidden, { show: true })).toBe(false);
  });
});

describe("syncChartWidgetsForDashboardTitleStyle", () => {
  it("clears per-chart title presentation on all chart widgets", () => {
    const widgets = syncChartWidgetsForDashboardTitleStyle([
      {
        id: "w1",
        type: "chart",
        title: "A",
        colSpan: 6,
        rowSpan: 4,
        chartConfig: patchChartDeStyleNested(baseCfg, "title", { fontSize: 18 }),
      },
      {
        id: "w2",
        type: "text",
        title: "B",
        colSpan: 6,
        rowSpan: 2,
        textConfig: { content: "hi" },
      },
    ]);
    expect(widgets[0].type === "chart" && widgets[0].chartConfig?.nativeBody?.deStyle?.title).toBe(
      undefined,
    );
    expect(widgets[1]).toEqual({
      id: "w2",
      type: "text",
      title: "B",
      colSpan: 6,
      rowSpan: 2,
      textConfig: { content: "hi" },
    });
  });
});

describe("dashboard widget style sync", () => {
  it("inferWidgetSyncScopes maps patch keys to scopes", () => {
    expect(inferWidgetSyncScopes({ titleStyle: { fontSize: 16 } })).toEqual(new Set(["title"]));
    expect(inferWidgetSyncScopes({ widgetStyle: { padding: 8 } })).toEqual(
      new Set(["widgetAppearance"]),
    );
    expect(inferWidgetSyncScopes({ paletteId: "ocean" })).toEqual(new Set(["palette"]));
    expect(inferWidgetSyncScopes({ chartLabelStyle: { color: "#fff" } })).toEqual(
      new Set(["palette"]),
    );
    expect(inferWidgetSyncScopes({ numberFormat: { decimals: 2 } })).toEqual(
      new Set(["numberFormat"]),
    );
    expect(inferWidgetSyncScopes({ defaultQueryLimit: 500 })).toEqual(new Set(["queryLimit"]));
    expect(inferWidgetSyncScopes({ chrome: { showAuxiliaryGrid: false } })).toEqual(new Set());
  });

  it("syncChartWidgetsForDashboardScopes clears matching overrides", () => {
    const cfg = patchChartDeStyleNested(baseCfg, "title", { fontSize: 20 });
    const withBg = patchChartDeStyleNested(cfg, "background", { background: "#fff" });
    const withPalette = {
      ...withBg,
      nativeBody: {
        ...withBg.nativeBody,
        deStyle: {
          ...withBg.nativeBody?.deStyle,
          paletteId: "custom",
          label: { formatType: "percent", fontSize: 12 },
        },
        deDisplay: { resultLimit: "500" },
      },
    };
    const widgets = syncChartWidgetsForDashboardScopes(
      [
        {
          id: "w1",
          type: "chart",
          title: "A",
          colSpan: 6,
          rowSpan: 4,
          chartConfig: withPalette,
        },
      ],
      new Set(["widgetAppearance", "palette", "numberFormat", "queryLimit"]),
    );
    const de = widgets[0].type === "chart" ? widgets[0].chartConfig?.nativeBody?.deStyle : undefined;
    const display =
      widgets[0].type === "chart" ? widgets[0].chartConfig?.nativeBody?.deDisplay : undefined;
    expect(de?.background).toBeUndefined();
    expect(de?.paletteId).toBeUndefined();
    expect(de?.label).toBeUndefined();
    expect(display).toBeUndefined();
  });

  it("stripChartPaletteOverrides clears label and tooltip palette fields", () => {
    const cfg = patchChartShowLabel(baseCfg, true);
    const withPalette = patchChartDeStyleNested(cfg, "tooltip", {
      show: true,
      fontSize: 14,
      color: "#fff",
      background: "#000",
    });
    const stripped = stripChartPaletteOverrides({
      ...withPalette,
      nativeBody: {
        ...withPalette.nativeBody,
        deStyle: {
          ...withPalette.nativeBody?.deStyle,
          paletteId: "ocean",
          seriesGradient: true,
        },
      },
    });
    const de = stripped.nativeBody?.deStyle;
    expect(de?.paletteId).toBeUndefined();
    expect(de?.seriesGradient).toBeUndefined();
    expect(de?.label).toBeUndefined();
    expect(de?.tooltip).toBeUndefined();
    expect(stripped.nativeBody?.deFeatures).toBeUndefined();
  });

  it("syncChartWidgetsForDashboardScopes clears table palette overrides", () => {
    const cfg = {
      chartType: "table-info",
      nativeBody: {
        deTableStyle: {
          tablePaletteId: "amber",
          headerBg: "#111111",
          headerFontSize: 9,
        },
      },
    };
    const widgets = syncChartWidgetsForDashboardScopes(
      [
        {
          id: "w1",
          type: "chart",
          title: "表",
          colSpan: 6,
          rowSpan: 4,
          chartConfig: cfg,
        },
      ],
      new Set(["palette"]),
    );
    const tableStyle =
      widgets[0].type === "chart"
        ? widgets[0].chartConfig?.nativeBody?.deTableStyle
        : undefined;
    expect(tableStyle?.tablePaletteId).toBeUndefined();
    expect(tableStyle?.headerBg).toBeUndefined();
    expect(tableStyle?.headerFontSize).toBe(9);
  });

  it("strip helpers are no-ops when override absent", () => {
    expect(stripChartWidgetAppearanceOverrides(baseCfg)).toBe(baseCfg);
    expect(stripChartPaletteOverrides(baseCfg)).toBe(baseCfg);
    expect(stripChartLabelFormatOverrides(baseCfg)).toBe(baseCfg);
    expect(stripChartQueryLimitOverride(baseCfg)).toBe(baseCfg);
  });
});

describe("patchChartLabelStyle", () => {
  it("auto-enables showLabel when setting label color", () => {
    const cfg = patchChartLabelStyle(baseCfg, { color: "#ff5500" });
    expect(readChartShowLabel(cfg)).toBe(true);
    expect(cfg.nativeBody?.deStyle?.label?.color).toBe("#ff5500");
  });

  it("does not toggle showLabel when only fontSize changes", () => {
    const cfg = patchChartLabelStyle(
      patchChartShowLabel(baseCfg, false),
      { fontSize: 16 },
    );
    expect(readChartShowLabel(cfg)).toBe(false);
    expect(cfg.nativeBody?.deStyle?.label?.fontSize).toBe(16);
  });
});

describe("readChartShowLabel", () => {
  it("defaults to true when unset", () => {
    expect(readChartShowLabel(baseCfg)).toBe(true);
  });

  it("respects dashboard chartLabelShow=false", () => {
    expect(readChartShowLabel(baseCfg, { chartLabelShow: false })).toBe(false);
  });

  it("defaults sankey node labels to on when unset", () => {
    expect(readChartShowLabel({ ...baseCfg, chartType: "sankey" })).toBe(true);
  });

  it("prefers explicit label.show over deFeatures.showLabel", () => {
    const cfg: ChartViewConfig = {
      ...baseCfg,
      nativeBody: {
        deStyle: { label: { show: true } },
        deFeatures: { showLabel: false },
      },
    };
    expect(readChartShowLabel(cfg)).toBe(true);
  });
});

describe("resolveChartLabelDisplayColor", () => {
  it("falls back to dashboard style then theme token", () => {
    expect(resolveChartLabelDisplayColor(baseCfg, { colorScheme: "light" })).toBe("#667085");
    expect(
      resolveChartLabelDisplayColor(baseCfg, {
        colorScheme: "light",
        chartLabelStyle: { color: "#112233" },
      }),
    ).toBe("#112233");
    const cfg = patchChartDeStyleNested(baseCfg, "label", { color: "#aabbcc" });
    expect(resolveChartLabelDisplayColor(cfg, { colorScheme: "light" })).toBe("#aabbcc");
  });
});

describe("resolveWidgetShellStyle", () => {
  it("renders decorative frame for non-chart widgets when widgetStyle uses frame mode", () => {
    const shell = resolveWidgetShellStyle(
      {
        backgroundShow: true,
        backgroundMode: "frame",
        framePresetId: "frame-7",
        frameColor: "#3370ff",
      },
      "light",
    );
    expect(shell.frameLayer?.backgroundImage).toContain("data:image/svg+xml");
  });
});

describe("resolveChartContentShellStyle", () => {
  it("merges per-chart background and border onto shape-inner shell", () => {
    let cfg = patchChartDeStyleNested(baseCfg, "background", { background: "#abcdef" });
    cfg = patchChartDeStyleNested(cfg, "border", { show: true, color: "#112233", width: 2 });
    const resolved = resolveChartContentShellStyle({ borderEnabled: false }, cfg, "light");
    expect(resolved.inner).toEqual({});
    expect(resolved.outer.style.background).toBe("#abcdef");
    expect(resolved.outer.style.borderColor).toBe("#112233");
    expect(resolved.outer.style.borderWidth).toBe(2);
  });

  it("keeps chart background image on shape-inner shell like solid color", () => {
    const cfg = patchChartDeStyleNested(baseCfg, "background", {
      backgroundShow: true,
      backgroundMode: "image",
      backgroundImage: "data:image/svg+xml;base64,PHN2Zy8+",
    });
    const resolved = resolveChartContentShellStyle(undefined, cfg, "light");
    expect(resolved.innerBackgroundLayer).toBeNull();
    expect(resolved.outer.backgroundLayer?.backgroundImage).toContain("data:image/svg+xml");
    expect(resolved.outer.backgroundLayer?.backgroundSize).toBe("100% 100%");
    const merged = mergeShapeInnerPresentation({
      outer: resolved.outer,
      inner: resolved.inner,
      innerBackgroundLayer: resolved.innerBackgroundLayer,
      innerFrameLayer: resolved.innerFrameLayer,
    });
    expect(merged.shell.backgroundLayers[0]?.backgroundImage).toContain("data:image/svg+xml");
    expect(merged.content.backgroundLayers.every((layer) => !layer?.backgroundImage)).toBe(true);
    expect(merged.shell.style.backgroundColor).toBe("transparent");
  });

  it("prefers image mode when backgroundImage exists alongside framePresetId", () => {
    const cfg = patchChartDeStyleNested(baseCfg, "background", {
      backgroundShow: true,
      backgroundImage: "https://example.com/panel.png",
      framePresetId: "frame-1",
    });
    const resolved = resolveChartContentShellStyle(undefined, cfg, "light");
    expect(resolved.outer.backgroundLayer?.backgroundImage).toContain("example.com/panel.png");
  });
});

describe("mergeShapeInnerPresentation", () => {
  it("keeps global widget shell on shape-inner and chart inner on shape-content", () => {
    const outer = mergeWidgetShellStyle({ padding: 12, borderRadius: 8 }, "light");
    const { surface } = widgetStyleToContentCss({ background: "#f5f5f5" }, "light");
    const merged = mergeShapeInnerPresentation({
      outer,
      inner: surface,
      innerBackgroundLayer: null,
      innerFrameLayer: null,
    });
    expect(merged.shell.style.padding).toBe("12px");
    expect(merged.shell.style.borderRadius).toBe("8px");
    expect(merged.shell.style.background).toBeUndefined();
    expect(merged.content.style.background).toBe("#f5f5f5");
  });

  it("applies global border color onto shape-inner shell", () => {
    const outer = mergeWidgetShellStyle({ borderColor: "#ff0000" }, "light");
    const merged = mergeShapeInnerPresentation({
      outer,
      inner: {},
      innerBackgroundLayer: null,
      innerFrameLayer: null,
    });
    expect(merged.shell.style.borderColor).toBe("#ff0000");
    expect(merged.shell.style.borderWidth).toBe(1);
    expect(merged.shell.style.borderStyle).toBe("solid");
  });

  it("includes decorative frame overlay on shape-inner frame layers (above content)", () => {
    const cfg = patchChartDeStyleNested(baseCfg, "background", {
      backgroundShow: true,
      backgroundMode: "frame",
      framePresetId: "frame-1",
    });
    const shell = resolveChartContentShellStyle(undefined, cfg, "light");
    const merged = mergeShapeInnerPresentation({
      outer: shell.outer,
      inner: shell.inner,
      innerBackgroundLayer: shell.innerBackgroundLayer,
      innerFrameLayer: shell.innerFrameLayer,
    });
    expect(merged.shell.backgroundLayers.every((layer) => !layer?.backgroundImage)).toBe(true);
    expect(merged.shell.frameLayers[0]?.backgroundImage).toContain("data:image/svg+xml");
  });

  it("keeps shape-inner transparent when frosted glass backdrop layer is active", () => {
    const outer = mergeWidgetShellStyle({ backdropBlur: 12 }, "light");
    const merged = mergeShapeInnerPresentation({
      outer,
      inner: {},
      innerBackgroundLayer: null,
      innerFrameLayer: null,
    });
    expect(outer.backgroundLayer?.backdropFilter).toBe("blur(12px)");
    expect(merged.shell.style.backgroundColor).toBe("transparent");
  });
});

describe("resolveEffectiveWidgetShellConfig", () => {
  it("inherits dashboard opacity when chart has no background override", () => {
    const effective = resolveEffectiveWidgetShellConfig({ opacity: 0 }, baseCfg);
    expect(effective.opacity).toBe(0);
  });

  it("chart background override wins over dashboard widgetStyle", () => {
    const cfg = patchChartDeStyleNested(baseCfg, "background", { opacity: 0.6 });
    const effective = resolveEffectiveWidgetShellConfig({ opacity: 0 }, cfg);
    expect(effective.opacity).toBe(0.6);
  });

  it("readEffectiveChartBorder merges deStyle.border onto global shell", () => {
    const cfg = patchChartDeStyleNested(baseCfg, "border", {
      show: true,
      color: "#ff0000",
      width: 2,
    });
    const border = readEffectiveChartBorder(cfg, { borderColor: "#000000" });
    expect(border.show).toBe(true);
    expect(border.color).toBe("#ff0000");
    expect(border.width).toBe(2);
  });
});

describe("chart palette overrides", () => {
  it("resolveEffectivePaletteColors prefers component custom colors", () => {
    const cfg: ChartViewConfig = {
      ...baseCfg,
      nativeBody: {
        deStyle: {
          paletteId: "default",
          paletteColors: ["#000000", "#ffffff"],
        },
      },
    };
    expect(resolveEffectivePaletteColors(cfg, "clarity", ["#111111"])).toEqual([
      "#000000",
      "#ffffff",
    ]);
  });

  it("resolveEffectivePaletteColors falls back to dashboard palette", () => {
    expect(
      resolveEffectivePaletteColors(baseCfg, "default", ["#123456", "#abcdef"]),
    ).toEqual(["#123456", "#abcdef"]);
  });

  it("patchChartPaletteDeStyle stores custom colors and clears on inherit", () => {
    const withCustom = patchChartPaletteDeStyle(baseCfg, "default", ["#ff0000", "#00ff00"]);
    expect(readChartDeStyle(withCustom).paletteColors).toEqual(["#ff0000", "#00ff00"]);

    const inherited = patchChartPaletteDeStyle(withCustom, undefined, []);
    const de = readChartDeStyle(inherited);
    expect(de.paletteId).toBeUndefined();
    expect(de.paletteColors).toBeUndefined();
    expect(de.seriesColor).toBeUndefined();
  });

  it("stripChartPaletteOverrides removes custom palette colors", () => {
    const cfg: ChartViewConfig = {
      ...baseCfg,
      nativeBody: {
        deStyle: {
          paletteId: "default",
          paletteColors: ["#ff0000"],
        },
      },
    };
    const stripped = stripChartPaletteOverrides(cfg);
    const de = readChartDeStyle(stripped);
    expect(de.paletteId).toBeUndefined();
    expect(de.paletteColors).toBeUndefined();
  });

  it("stripChartPaletteOverrides removes per-series colors", () => {
    const cfg: ChartViewConfig = {
      ...baseCfg,
      nativeBody: {
        deStyle: {
          seriesColor: [{ id: "amount", name: "amount", color: "#ff0000" }],
        },
      },
    };
    const stripped = stripChartPaletteOverrides(cfg);
    const de = readChartDeStyle(stripped);
    expect(de.seriesColor).toBeUndefined();
  });
});

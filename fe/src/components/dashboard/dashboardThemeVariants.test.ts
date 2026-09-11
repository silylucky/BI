import { describe, expect, it } from "vitest";
import {
  applyDashboardStylePatch,
  applyDashboardTitleStylePatch,
  bootstrapDashboardStyleConfig,
  defaultThemeVariant,
  hydrateDashboardStyleConfig,
  initializeDualThemePresets,
  normalizeStyleConfigForColorScheme,
  resetDashboardColorsToActiveThemeBundle,
  resolveThemePresetForSwitch,
  switchDashboardColorScheme,
  switchDashboardThemeBundle,
  syncChartWidgetsForColorScheme,
} from "./dashboardThemeVariants";
import { CANVAS_BG_DARK_DEFAULT, CANVAS_BG_LIGHT_DEFAULT } from "./dashboardStyleConfig";
import { hydrateDashboardStyle } from "./stylePipeline";

describe("dashboardThemeVariants", () => {
  it("switching to dark applies default dark canvas when no variant saved", () => {
    const next = switchDashboardColorScheme({ colorScheme: "light" }, "dark");
    expect(next.colorScheme).toBe("dark");
    expect(next.canvasBackground).toBe(CANVAS_BG_DARK_DEFAULT);
    expect(next.themeVariants?.light).toBeDefined();
    expect(next.themeVariants?.dark).toBeDefined();
  });

  it("round-trips custom §5.3 canvas through variant store", () => {
    const customized = switchDashboardColorScheme(
      {
        colorScheme: "light",
        canvasBackground: "#f1c40f",
        canvasBackgroundCustom: true,
      },
      "dark",
    );
    const back = switchDashboardColorScheme(customized, "light");
    expect(back.canvasBackground).toBe("#f1c40f");
    expect(back.canvasBackgroundCustom).toBe(true);
  });

  it("initializeDualThemePresets seeds both schemes", () => {
    const next = initializeDualThemePresets({ colorScheme: "light" });
    expect(next.themeVariants?.light?.canvasBackground).toBe(
      defaultThemeVariant("light").canvasBackground,
    );
    expect(next.themeVariants?.dark?.canvasBackground).toBe(
      defaultThemeVariant("dark").canvasBackground,
    );
  });

  it("hydrateDashboardStyleConfig seeds missing dual variants on empty config", () => {
    const next = hydrateDashboardStyleConfig({});
    expect(next.themeVariants?.light?.canvasBackground).toBe(CANVAS_BG_LIGHT_DEFAULT);
    expect(next.themeVariants?.dark?.canvasBackground).toBe(CANVAS_BG_DARK_DEFAULT);
    expect(next.themeVariants?.dark?.widgetStyle?.background).toBe("#1e293b");
  });

  it("bootstrap promotes legacy root fields to active variant only", () => {
    const next = bootstrapDashboardStyleConfig({
      colorScheme: "dark",
      canvasBackground: "#0f172a",
      widgetStyle: { background: "#1e293b" },
    });
    expect(next.themeVariants?.dark?.canvasBackground).toBe(CANVAS_BG_DARK_DEFAULT);
    expect(next.themeVariants?.light?.canvasBackground).toBe(CANVAS_BG_LIGHT_DEFAULT);
    expect(next.canvasBackground).toBe(CANVAS_BG_DARK_DEFAULT);
  });

  it("bootstrap is idempotent once variants are seeded", () => {
    const once = bootstrapDashboardStyleConfig({ colorScheme: "light" });
    const twice = bootstrapDashboardStyleConfig(once);
    expect(twice).toEqual(once);
  });

  it("hydrateDashboardStyleConfig normalizes active dark root and keeps light variant", () => {
    const next = hydrateDashboardStyleConfig({
      colorScheme: "dark",
      canvasBackground: "#eff6ff",
      widgetStyle: { background: "#ffffff" },
    });
    expect(next.canvasBackground).toBe(CANVAS_BG_DARK_DEFAULT);
    expect(next.widgetStyle?.background).toBe("#1e293b");
    expect(next.themeVariants?.light?.canvasBackground).toBe(CANVAS_BG_LIGHT_DEFAULT);
    expect(next.themeVariants?.dark?.canvasBackground).toBe(CANVAS_BG_DARK_DEFAULT);
  });

  it("preserves template palette and widget border when legacy themeAccent is stripped", () => {
    const hydrated = hydrateDashboardStyle({
      surfaceKind: "data-screen",
      colorScheme: "dark",
      themeAccent: "#22d3ee",
      canvasBackgroundCustom: true,
      canvasBackground: "radial-gradient(ellipse 100% 85% at 50% -5%, #22d3ee40 0%, #0f172a 42%, #020617 100%)",
      canvasBackgroundImage: "/template-assets/backgrounds/screen-gov-cyan-grid.svg",
      paletteId: "custom",
      paletteColors: ["#22d3ee", "#38bdf8", "#0ea5e9"],
      widgetStyle: {
        borderColor: "#22d3ee80",
        borderEnabled: true,
      },
    });
    expect(hydrated.themeAccent).toBeUndefined();
    expect(hydrated.widgetStyle?.borderColor).toBe("#22d3ee80");
    expect(hydrated.paletteColors).toEqual(["#22d3ee", "#38bdf8", "#0ea5e9"]);
  });

  it("hydrateDashboardStyleConfig resets deprecated themeAccent to standard presets", () => {
    const next = hydrateDashboardStyleConfig({
      colorScheme: "dark",
      themeAccent: "#f79009",
      canvasBackground: "#172033",
      widgetStyle: { background: "#243047" },
    });
    expect(next.themeAccent).toBeUndefined();
    expect(next.themeVariants?.light).toEqual(defaultThemeVariant("light"));
    expect(next.themeVariants?.dark?.canvasBackground).toBe(CANVAS_BG_DARK_DEFAULT);
    expect(next.themeVariants?.dark?.widgetStyle?.background).toBe("#1e293b");
  });

  it("switching themes after hydrate applies standard inactive preset", () => {
    const hydrated = hydrateDashboardStyleConfig({ colorScheme: "dark" });
    const light = switchDashboardColorScheme(hydrated, "light");
    expect(light.canvasBackground).toBe(CANVAS_BG_LIGHT_DEFAULT);
    expect(light.widgetStyle?.background).toBe("#ffffff");
  });

  it("legacy light blue canvas without custom flag resets on theme switch", () => {
    const dark = bootstrapDashboardStyleConfig({ colorScheme: "dark" });
    const polluted = {
      ...dark,
      themeVariants: {
        ...dark.themeVariants,
        light: {
          canvasBackground: "#eff6ff",
          widgetStyle: { background: "#ffffff" },
        },
      },
    };
    const light = switchDashboardColorScheme(polluted, "light");
    expect(light.canvasBackground).toBe(CANVAS_BG_LIGHT_DEFAULT);
    expect(light.canvasBackgroundCustom).toBeUndefined();
  });

  it("custom §5.3 canvas survives theme round-trip", () => {
    const base = bootstrapDashboardStyleConfig({
      colorScheme: "light",
      canvasBackground: "#f1c40f",
      canvasBackgroundCustom: true,
    });
    const dark = switchDashboardColorScheme(base, "dark");
    const back = switchDashboardColorScheme(dark, "light");
    expect(back.canvasBackground).toBe("#f1c40f");
    expect(back.canvasBackgroundCustom).toBe(true);
  });

  it("normalize preserves custom title color on same scheme reload", () => {
    const next = normalizeStyleConfigForColorScheme({
      colorScheme: "light",
      titleStyle: { color: "#884422" },
    });
    expect(next.titleStyle?.color).toBe("#884422");
  });

  it("normalize clears light gradient and decor when colorScheme is dark", () => {
    const next = normalizeStyleConfigForColorScheme({
      colorScheme: "dark",
      canvasBackground: "linear-gradient(160deg, #eff6ff 0%, #f8fafc 45%, #fef3c7 100%)",
      widgetStyle: { background: "#ffffff" },
    });
    expect(next.canvasBackground).toBe(CANVAS_BG_DARK_DEFAULT);
    expect(next.canvasBackgroundImage).toBeUndefined();
    expect(next.widgetStyle?.background).toBe("#1e293b");
  });

  it("normalize coerces light blue canvas swatch when colorScheme is dark", () => {
    const next = normalizeStyleConfigForColorScheme({
      colorScheme: "dark",
      canvasBackground: "#eff6ff",
    });
    expect(next.canvasBackground).toBe(CANVAS_BG_DARK_DEFAULT);
  });

  it("syncChartWidgetsForColorScheme resets per-chart deStyle background on dark", () => {
    const widgets = syncChartWidgetsForColorScheme(
      [
        {
          id: "w1",
          type: "chart",
          title: "柱图",
          colSpan: 6,
          rowSpan: 4,
          chartConfig: {
            mode: "dataset",
            chartType: "bar",
            dataSourceId: "ds1",
            configId: "c1",
            nativeBody: {
              deStyle: { background: { background: "#57617a" } },
            },
          },
        },
      ],
      "dark",
    );
    expect(
      widgets[0].type === "chart" &&
        widgets[0].chartConfig?.nativeBody?.deStyle?.background?.background,
    ).toBe("#1e293b");
  });

  it("switchDashboardThemeBundle syncs styleConfig and widgets together", () => {
    const bundle = switchDashboardThemeBundle(
      { colorScheme: "light", canvasBackground: "#eff6ff" },
      [
        {
          id: "w1",
          type: "chart",
          title: "柱图",
          colSpan: 6,
          rowSpan: 4,
          chartConfig: {
            mode: "dataset",
            chartType: "bar",
            dataSourceId: "ds1",
            configId: "c1",
            nativeBody: {
              deStyle: { background: { background: "#ffffff" } },
            },
          },
        },
        {
          id: "w2",
          type: "customViz",
          title: "排名条",
          colSpan: 6,
          rowSpan: 4,
          customVizConfig: {
            artifactId: "a1",
            displayStyle: { paletteId: "warm", background: { background: "#ffffff" } },
          },
        },
      ],
      "dark",
    );
    expect(bundle.styleConfig.canvasBackground).toBe(CANVAS_BG_DARK_DEFAULT);
    expect(
      bundle.widgets[0].type === "chart" &&
        bundle.widgets[0].chartConfig?.nativeBody?.deStyle?.background?.background,
    ).toBe("#1e293b");
    expect(
      bundle.widgets[1].type === "customViz" && bundle.widgets[1].customVizConfig?.displayStyle,
    ).toBeUndefined();
  });

  it("applyDashboardTitleStylePatch updates global title and clears chart overrides", () => {
    const bundle = applyDashboardTitleStylePatch(
      { titleStyle: { fontSize: 14 } },
      [
        {
          id: "w1",
          type: "chart",
          title: "柱图",
          colSpan: 6,
          rowSpan: 4,
          chartConfig: {
            chartType: "bar",
            dataSourceId: "ds1",
            nativeBody: {
              deStyle: { title: { fontSize: 22, color: "#ff0000" } },
            },
          },
        },
      ],
      { fontSize: 18, color: "#334455" },
    );
    expect(bundle.styleConfig.titleStyle).toEqual({ fontSize: 18, color: "#334455" });
    expect(
      bundle.widgets[0].type === "chart" &&
        bundle.widgets[0].chartConfig?.nativeBody?.deStyle?.title,
    ).toBeUndefined();
  });

  it("applyDashboardStylePatch clears widget appearance and palette overrides", () => {
    const bundle = applyDashboardStylePatch(
      { widgetStyle: { padding: 8 }, paletteId: "default" },
      [
        {
          id: "w1",
          type: "chart",
          title: "柱图",
          colSpan: 6,
          rowSpan: 4,
          chartConfig: {
            chartType: "bar",
            dataSourceId: "ds1",
            nativeBody: {
              deStyle: {
                background: { padding: 4 },
                paletteId: "ocean",
                paletteOpacity: 0.8,
                seriesColor: [{ id: "amount", name: "amount", color: "#ff0000" }],
              },
            },
          },
        },
      ],
      { widgetStyle: { padding: 12 }, paletteId: "warm" },
    );
    expect(bundle.styleConfig.widgetStyle?.padding).toBe(12);
    expect(bundle.styleConfig.paletteId).toBe("amber");
    const de =
      bundle.widgets[0].type === "chart"
        ? bundle.widgets[0].chartConfig?.nativeBody?.deStyle
        : undefined;
    expect(de?.background).toBeUndefined();
    expect(de?.paletteId).toBeUndefined();
    expect(de?.paletteOpacity).toBeUndefined();
    expect(de?.seriesColor).toBeUndefined();
  });

  it("applyDashboardStylePatch clears customViz widgetStyle and displayStyle overrides", () => {
    const bundle = applyDashboardStylePatch(
      { widgetStyle: { background: "#fff" }, paletteId: "default", titleStyle: { fontSize: 16 } },
      [
        {
          id: "cv1",
          type: "customViz",
          title: "排名条",
          colSpan: 6,
          rowSpan: 4,
          customVizConfig: {
            artifactId: "a1",
            widgetStyle: { background: "#613e3e" },
            displayStyle: {
              title: { fontSize: 20 },
              paletteId: "warm",
              background: { padding: 8 },
            },
            style: { accentColor: "#222" },
          },
        },
      ],
      { widgetStyle: { background: "#000" }, paletteId: "clarity", titleStyle: { fontSize: 18 } },
    );

    expect(bundle.widgets[0].type === "customViz" && bundle.widgets[0].customVizConfig).toEqual({
      artifactId: "a1",
      style: { accentColor: "#222" },
    });
  });

  it("applyDashboardStylePatch syncs tableColorStyle with chart palette", () => {
    const bundle = applyDashboardStylePatch(
      {
        colorScheme: "light",
        paletteId: "default",
        tableColorStyle: {
          headerBg: "#001122",
          tablePaletteId: "default",
        },
      },
      [],
      { paletteId: "clarity" },
    );
    expect(bundle.styleConfig.paletteId).toBe("clarity");
    expect(bundle.styleConfig.tableColorStyle?.tablePaletteId).toBe("clarity");
    expect(bundle.styleConfig.tableColorStyle?.headerBg).not.toBe("#001122");
    expect(bundle.styleConfig.tableColorStyle?.headerBg).toBeTruthy();
  });

  it("resetDashboardColorsToActiveThemeBundle resets dashboard and chart color overrides", () => {
    const bundle = resetDashboardColorsToActiveThemeBundle(
      {
        colorScheme: "light",
        canvasBackground: "#ff0000",
        canvasBackgroundCustom: true,
        canvasBackgroundImage: "https://example.com/bg.png",
        canvasDecorPresetId: "dots",
        titleStyle: { fontSize: 18, color: "#884422" },
        widgetStyle: {
          padding: 12,
          background: "#eeeeee",
          borderColor: "#111111",
          backgroundImage: "https://example.com/widget.png",
          backgroundMode: "image",
          framePresetId: "frame-1",
        },
        chartLabelStyle: { fontSize: 14, color: "#ff00ff" },
        chartTooltipStyle: { fontSize: 12, color: "#000000", background: "#abcdef" },
        tableColorStyle: { headerBg: "#001122" },
        paletteId: "warm",
      },
      [
        {
          id: "w1",
          type: "chart",
          title: "柱图",
          colSpan: 6,
          rowSpan: 4,
          chartConfig: {
            chartType: "bar",
            dataSourceId: "ds1",
            nativeBody: {
              deStyle: {
                title: { fontSize: 20, color: "#ff0000" },
                background: { background: "#cccccc", padding: 8 },
                label: { fontSize: 11, color: "#00ff00" },
                tooltip: { fontSize: 12, color: "#0000ff", background: "#ffff00" },
              },
              deTableStyle: { headerBg: "#334455", columnWidthMode: "auto" },
            },
          },
        },
      ],
    );

    expect(bundle.styleConfig.canvasBackground).toBe(CANVAS_BG_LIGHT_DEFAULT);
    expect(bundle.styleConfig.canvasBackgroundCustom).toBeUndefined();
    expect(bundle.styleConfig.canvasBackgroundImage).toBeUndefined();
    expect(bundle.styleConfig.canvasDecorPresetId).toBeUndefined();
    expect(bundle.styleConfig.titleStyle).toEqual({
      fontSize: 18,
      color: defaultThemeVariant("light").titleStyle?.color,
    });
    expect(bundle.styleConfig.widgetStyle?.padding).toBe(12);
    expect(bundle.styleConfig.widgetStyle?.background).toBe("#ffffff");
    expect(bundle.styleConfig.widgetStyle?.backgroundImage).toBeUndefined();
    expect(bundle.styleConfig.widgetStyle?.backgroundMode).toBeUndefined();
    expect(bundle.styleConfig.widgetStyle?.framePresetId).toBeUndefined();
    expect(bundle.styleConfig.chartLabelStyle?.fontSize).toBe(14);
    expect(bundle.styleConfig.chartLabelStyle?.color).toBe("#667085");
    expect(bundle.styleConfig.paletteId).toBe("warm");

    const de =
      bundle.widgets[0].type === "chart"
        ? bundle.widgets[0].chartConfig?.nativeBody?.deStyle
        : undefined;
    expect(de?.title).toEqual({ fontSize: 20 });
    expect(de?.background).toBeUndefined();
    expect(de?.label).toEqual({ fontSize: 11 });
    expect(de?.tooltip).toEqual({ fontSize: 12 });
    const tableStyle =
      bundle.widgets[0].type === "chart"
        ? bundle.widgets[0].chartConfig?.nativeBody?.deTableStyle
        : undefined;
    expect(tableStyle).toEqual({ columnWidthMode: "auto" });
  });

  it("resetDashboardColorsToActiveThemeBundle strips customViz widgetStyle background overrides", () => {
    const bundle = resetDashboardColorsToActiveThemeBundle(
      { colorScheme: "light" },
      [
        {
          id: "w-cv",
          type: "customViz",
          title: "外部组件",
          colSpan: 6,
          rowSpan: 4,
          order: 0,
          customVizConfig: {
            artifactId: "550e8400-e29b-41d4-a716-446655440000",
            widgetStyle: {
              background: "#ff0000",
              opacity: 0.5,
              borderColor: "#111111",
            },
            displayStyle: {
              background: { background: "#00ff00" },
              paletteId: "warm",
              title: { fontSize: 18, color: "#112233" },
              label: { color: "#445566" },
            },
          },
        },
      ],
    );

    expect(bundle.widgets[0].type).toBe("customViz");
    if (bundle.widgets[0].type !== "customViz") return;
    expect(bundle.widgets[0].customVizConfig?.widgetStyle).toBeUndefined();
    expect(bundle.widgets[0].customVizConfig?.displayStyle).toEqual({
      title: { fontSize: 18 },
    });
  });
});

import type { DashboardLayoutV2, PixelLayoutWidget } from "@/components/dashboard/layoutUtils";
import { randomId } from "@/lib/randomId";
import { defaultChartConfig } from "@/components/dashboard/layoutUtils";
import { buildDashboardLayoutForSave } from "@/components/dashboard/dashboardCanvasMode";
import { bootstrapDashboardStyleConfig } from "@/components/dashboard/dashboardThemeVariants";
import { buildDefaultLayoutForSurface } from "@/lib/surfacePreset";
import { SCREEN_ACCENT, SCREEN_CANVAS_BG, SCREEN_TITLE_COLOR } from "@/lib/screenTokens";
import {
  SCREEN_BORDER_MARKER,
  SCREEN_CLOCK_MARKER,
} from "@/lib/screenVisualAssets";
import { normalizeLayoutForTemplateExport } from "@/lib/templateDemoData";

export type DataScreenTemplateId = "blank" | "tech-blue" | "gov-minimal" | "command-center";

export type DataScreenTemplateMeta = {
  id: DataScreenTemplateId;
  name: string;
  description: string;
};

export const DATA_SCREEN_TEMPLATE_CATALOG: DataScreenTemplateMeta[] = [
  {
    id: "blank",
    name: "空白大屏",
    description: "1920×1080 深色画布，从零搭建",
  },
  {
    id: "command-center",
    name: "指挥台三栏",
    description: "对标 DE L1：标题 + 三栏图表示意位",
  },
  {
    id: "tech-blue",
    name: "科技蓝",
    description: "标题 + 边框 + 时钟，适合监控墙",
  },
  {
    id: "gov-minimal",
    name: "政务简约",
    description: "居中标题与装饰边框，留白充足",
  },
];

function widgetId(): string {
  return randomId();
}

function screenTitleHtml(text: string): string {
  return `<p style="text-align:center;font-size:34px;font-weight:600;color:${SCREEN_TITLE_COLOR};letter-spacing:0.18em;margin:0;text-shadow:0 0 24px rgba(34,211,238,0.25)">${text}</p>`;
}

function panelPlaceholderHtml(title: string): string {
  return `<div style="box-sizing:border-box;height:100%;border:1px solid rgba(34,211,238,0.28);background:rgba(15,23,42,0.82);border-radius:8px;padding:12px;display:flex;flex-direction:column;box-shadow:0 0 12px rgba(34,211,238,0.12)"><div style="color:#a5f3fc;font-size:13px;font-weight:500;margin-bottom:8px">${title}</div><div style="flex:1;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.32);font-size:12px;letter-spacing:0.05em">拖入图表替换</div></div>`;
}

function panelWidget(
  title: string,
  placement: Pick<PixelLayoutWidget, "x" | "y" | "width" | "height">,
  order: number,
): PixelLayoutWidget {
  const id = widgetId();
  return {
    id,
    type: "text",
    title,
    order,
    ...placement,
    textConfig: {
      content: panelPlaceholderHtml(title),
      variant: "html",
    },
  };
}

function chartSlotWidget(
  title: string,
  chartType: "bar" | "line" | "pie",
  placement: Pick<PixelLayoutWidget, "x" | "y" | "width" | "height">,
  order: number,
): PixelLayoutWidget {
  const id = widgetId();
  return {
    id,
    type: "chart",
    title,
    order,
    ...placement,
    chartConfig: { ...defaultChartConfig(chartType), chartId: id },
  };
}

function buildCommandCenterLayout(): DashboardLayoutV2 {
  const base = buildDefaultLayoutForSurface("data-screen");
  return {
    ...base,
    styleConfig: {
      ...base.styleConfig,
      canvasBackground: SCREEN_CANVAS_BG,
      themeAccent: SCREEN_ACCENT,
      refreshIntervalSec: 60,
    },
    widgets: [
      {
        id: widgetId(),
        type: "text",
        title: "边框装饰",
        x: 64,
        y: 56,
        width: 1792,
        height: 968,
        order: 0,
        textConfig: { content: SCREEN_BORDER_MARKER, variant: "plain" },
      },
      {
        id: widgetId(),
        type: "text",
        title: "主标题",
        x: 520,
        y: 20,
        width: 880,
        height: 56,
        order: 1,
        textConfig: {
          content: screenTitleHtml("智慧城市运行指挥舱"),
          variant: "html",
        },
      },
      {
        id: widgetId(),
        type: "text",
        title: "时钟",
        x: 1500,
        y: 16,
        width: 380,
        height: 72,
        order: 2,
        textConfig: { content: SCREEN_CLOCK_MARKER, variant: "plain" },
      },
      panelWidget("核心指标", { x: 48, y: 96, width: 400, height: 220 }, 3),
      panelWidget("趋势分析", { x: 48, y: 332, width: 400, height: 220 }, 4),
      panelWidget("区域态势", { x: 48, y: 568, width: 400, height: 220 }, 5),
      chartSlotWidget("主指标趋势", "line", { x: 472, y: 96, width: 976, height: 400 }, 6),
      chartSlotWidget("结构占比", "pie", { x: 472, y: 512, width: 476, height: 276 }, 7),
      chartSlotWidget("对比分析", "bar", { x: 972, y: 512, width: 476, height: 276 }, 8),
      panelWidget("实时告警", { x: 1472, y: 96, width: 400, height: 220 }, 9),
      panelWidget("排行榜", { x: 1472, y: 332, width: 400, height: 220 }, 10),
      panelWidget("设备状态", { x: 1472, y: 568, width: 400, height: 220 }, 11),
    ],
  };
}

function buildTechBlueLayout(): DashboardLayoutV2 {
  const base = buildDefaultLayoutForSurface("data-screen");
  return {
    ...base,
    styleConfig: {
      ...base.styleConfig,
      refreshIntervalSec: 60,
    },
    widgets: [
      {
        id: widgetId(),
        type: "text",
        title: "边框装饰",
        x: 80,
        y: 72,
        width: 1760,
        height: 936,
        order: 0,
        textConfig: {
          content: SCREEN_BORDER_MARKER,
          variant: "plain",
        },
      },
      {
        id: widgetId(),
        type: "text",
        title: "主标题",
        x: 560,
        y: 28,
        width: 800,
        height: 64,
        order: 1,
        textConfig: {
          content: screenTitleHtml("数据可视化大屏"),
          variant: "html",
        },
      },
      {
        id: widgetId(),
        type: "text",
        title: "时钟",
        x: 1480,
        y: 24,
        width: 400,
        height: 72,
        order: 2,
        textConfig: {
          content: SCREEN_CLOCK_MARKER,
          variant: "plain",
        },
      },
    ],
  };
}

function buildGovMinimalLayout(): DashboardLayoutV2 {
  const base = buildDefaultLayoutForSurface("data-screen");
  return {
    ...base,
    styleConfig: {
      ...base.styleConfig,
      canvasBackground: "#0a1628",
      canvasBackgroundCustom: true,
      refreshIntervalSec: 120,
    },
    widgets: [
      {
        id: widgetId(),
        type: "text",
        title: "边框装饰",
        x: 120,
        y: 96,
        width: 1680,
        height: 888,
        order: 0,
        textConfig: {
          content: SCREEN_BORDER_MARKER,
          variant: "plain",
        },
      },
      {
        id: widgetId(),
        type: "text",
        title: "主标题",
        x: 460,
        y: 48,
        width: 1000,
        height: 80,
        order: 1,
        textConfig: {
          content: screenTitleHtml("政务数据运行监测"),
          variant: "html",
        },
      },
    ],
  };
}

export function buildDataScreenLayoutFromTemplate(
  templateId: DataScreenTemplateId,
): DashboardLayoutV2 {
  switch (templateId) {
    case "command-center":
      return buildCommandCenterLayout();
    case "tech-blue":
      return buildTechBlueLayout();
    case "gov-minimal":
      return buildGovMinimalLayout();
    case "blank":
    default:
      return buildDefaultLayoutForSurface("data-screen");
  }
}

export function parseImportedDataScreenLayout(raw: unknown): DashboardLayoutV2 {
  if (!raw || typeof raw !== "object") {
    throw new Error("布局 JSON 格式无效");
  }
  const record = raw as Record<string, unknown>;
  const layoutSource =
    (record.kind === "data-screen" || record.kind === "viz-layout") &&
    record.layout &&
    typeof record.layout === "object"
      ? (record.layout as DashboardLayoutV2)
      : (raw as DashboardLayoutV2);
  const layout = layoutSource;
  if (layout.version !== 2) {
    throw new Error("仅支持 version 2 像素布局");
  }
  if (!layout.canvas?.width || !layout.canvas?.height) {
    throw new Error("缺少 canvas 尺寸");
  }
  const styleConfig = bootstrapDashboardStyleConfig({
    ...layout.styleConfig,
    surfaceKind: "data-screen",
    colorScheme: layout.styleConfig?.colorScheme ?? "dark",
  });
  const draft: DashboardLayoutV2 = {
    ...layout,
    styleConfig,
    widgets: Array.isArray(layout.widgets) ? layout.widgets : [],
    globalFilters: Array.isArray(layout.globalFilters) ? layout.globalFilters : [],
  };
  const sanitized = buildDashboardLayoutForSave(draft, styleConfig);
  if (sanitized.version !== 2) {
    throw new Error("仅支持 version 2 像素布局");
  }
  return sanitized;
}

export type VizLayoutEnvelope = {
  templateVersion: 1;
  kind: "viz-layout" | "data-screen";
  surfaceKind?: "dashboard" | "data-screen";
  name: string;
  description?: string | null;
  categoryKey?: string;
  layout: DashboardLayoutV2;
};

export function exportDataScreenTemplate(
  layout: DashboardLayoutV2,
  name: string,
): VizLayoutEnvelope {
  const styleConfig = bootstrapDashboardStyleConfig({
    ...layout.styleConfig,
    surfaceKind: "data-screen",
  });
  const cleanLayout = buildDashboardLayoutForSave(
    { ...layout, styleConfig },
    styleConfig,
  ) as DashboardLayoutV2;
  return {
    templateVersion: 1,
    kind: "viz-layout",
    surfaceKind: "data-screen",
    name: name.trim() || "未命名大屏",
    layout: normalizeLayoutForTemplateExport(cleanLayout),
  };
}

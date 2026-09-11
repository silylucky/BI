import { useMemo } from "react";
import { chartInspectorCapabilities } from "@/lib/chartInspectorCapabilities";
import {
  readChartConditionalRules,
  readChartDeFeatures,
  readChartMarkLines,
} from "@/lib/chartDeFeatures";
import { useChartInspector } from "./chartInspectorContext";
import { InspectorSubtleEmpty } from "./inspectorCompact";
import { WidgetAdvancedAccordion } from "./WidgetAdvancedAccordion";
import {
  ChartAdvancedConditionalSection,
  ChartAdvancedFeatureSettings,
  ChartAdvancedMapBubbleSection,
  ChartAdvancedMapLinkageSection,
  ChartAdvancedMarkLinesSection,
} from "./chartAdvancedSections";
import { ChartAdvancedMapAreaMappingSection } from "./ChartGeoAreaMappingPanel";
import { readChartDeStyle, readChartGeoStyle } from "@/lib/chartDeStyle";
import { countEffectiveAreaMappings } from "@/lib/chartGeoAreaMapping";
import { readChartLinkageConfig } from "@/lib/chartDeFeatures";

type ChartAdvancedPanelProps = Record<string, never>;

/** DataEase chart-edit「高级」Tab：按图表能力动态展示区块 */
export function ChartAdvancedPanel(_props: ChartAdvancedPanelProps) {
  const { cfg } = useChartInspector();
  const caps = chartInspectorCapabilities(cfg.chartType);

  const sections = useMemo(() => {
    const markLines = readChartMarkLines(cfg);
    const rules = readChartConditionalRules(cfg);
    const mapLinkage = readChartLinkageConfig(cfg);
    const list = [];

    if (caps.dataZoom || caps.timeRange) {
      const features = readChartDeFeatures(cfg);
      const featureTitle =
        caps.dataZoom && caps.timeRange
          ? "功能设置"
          : caps.dataZoom
            ? "缩略轴"
            : "时间范围";
      list.push({
        id: "feature",
        title: featureTitle,
        defaultOpen: Boolean(features.dataZoom || cfg.timeRange?.enabled),
        badge:
          caps.dataZoom && features.dataZoom
            ? "开"
            : cfg.timeRange?.enabled
              ? "开"
              : undefined,
        content: <ChartAdvancedFeatureSettings />,
      });
    }

    if (caps.markLines) {
      list.push({
        id: "guide",
        title: "辅助线",
        hint: "添加固定值参考线，用于标注目标或阈值。",
        defaultOpen: markLines.length > 0,
        badge: markLines.filter((line) => line.enabled).length,
        content: <ChartAdvancedMarkLinesSection />,
      });
    }

    if (caps.conditional) {
      list.push({
        id: "conditional",
        title: "条件样式",
        hint: "按度量值阈值高亮柱/线段颜色（自上而下匹配首条规则）。柱线组合图可能仅作用于部分系列，请预览确认。",
        defaultOpen: rules.length > 0,
        badge: rules.filter((rule) => rule.enabled).length,
        content: <ChartAdvancedConditionalSection />,
      });
    }

    if (cfg.chartType === "map" || cfg.chartType === "map-3d") {
      const geoForMapping = readChartGeoStyle(readChartDeStyle(cfg));
      const mappingCount = countEffectiveAreaMappings(geoForMapping.areaMapping);
      list.push({
        id: "map-area-mapping",
        title: "地名映射",
        defaultOpen: mappingCount > 0,
        badge: mappingCount > 0 ? mappingCount : undefined,
        content: <ChartAdvancedMapAreaMappingSection />,
      });
    }

    if (cfg.chartType === "map") {
      list.push({
        id: "map-linkage",
        title: "联动设置",
        defaultOpen: mapLinkage.enabled,
        badge: mapLinkage.enabled ? "开" : undefined,
        content: <ChartAdvancedMapLinkageSection />,
      });
    }

    if (cfg.chartType === "map") {
      const geo = readChartGeoStyle(readChartDeStyle(cfg));
      list.push({
        id: "map-bubble",
        title: "气泡动效",
        defaultOpen: geo.bubbleEffect === true,
        badge: geo.bubbleEffect ? "开" : undefined,
        content: <ChartAdvancedMapBubbleSection />,
      });
    }

    return list;
  }, [caps, cfg]);

  if (sections.length === 0) {
    return (
      <InspectorSubtleEmpty message="当前图表类型暂无高级配置项；可切换柱图/折线图以使用更多能力。" />
    );
  }

  return <WidgetAdvancedAccordion sections={sections} />;
};

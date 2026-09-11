import { useEffect, useState } from "react";
import { fetchChartTypeCatalog, type ChartTypeCatalogItem } from "@/lib/chartRegistry";
import { styleVariantLabel } from "@/lib/chartStyleSectionRegistry";
import {
  DEFAULT_PIE_INNER_RADIUS_PERCENT,
  patchChartDeStyleNested,
  PIE_INNER_RADIUS_MAX,
  PIE_INNER_RADIUS_MIN,
  readChartDeStyle,
  readChartPieStyle,
} from "@/lib/chartDeStyle";
import { ChartInspectorSection, INSPECTOR_SELECT } from "../inspectorCompact";
import { ChartDeSegmentField } from "../chartInspectorDeFields";
import { ChartDeSliderField } from "../deAttrSlider";
import { useChartInspector } from "../ChartInspectorContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** 关系图 UI 仅展示有效布局；default 与 force 等价 */
function graphVariantsForUi(variants: string[]): string[] {
  const filtered = variants.filter((v) => v !== "default");
  return filtered.length > 0 ? filtered : ["force", "dagre"];
}

function resolveGraphLayoutVariant(
  cfg: Parameters<typeof readChartDeStyle>[0],
): "force" | "dagre" {
  const graphLayout = readChartDeStyle(cfg).graph?.layout;
  if (graphLayout === "dagre" || graphLayout === "force") return graphLayout;
  return cfg.styleVariant === "dagre" ? "dagre" : "force";
}

/** 折线/柱/饼：基础样式（子类型），对标 DE 第一段折叠 */
export function ChartVariantBasicSection() {
  const { cfg, onChange, catalog } = useChartInspector();
  const [localCatalog, setLocalCatalog] = useState<ChartTypeCatalogItem[]>(catalog);

  useEffect(() => {
    if (catalog.length > 0) return;
    fetchChartTypeCatalog().then(setLocalCatalog).catch(() => setLocalCatalog([]));
  }, [catalog]);

  const spec = (catalog.length ? catalog : localCatalog).find((c) => c.type === cfg.chartType);
  const rawVariants = spec?.styleVariants ?? ["default"];
  const variants = cfg.chartType === "graph" ? graphVariantsForUi(rawVariants) : rawVariants;
  const current =
    cfg.chartType === "graph" ? resolveGraphLayoutVariant(cfg) : (cfg.styleVariant ?? "default");
  const pieStyle = readChartPieStyle(readChartDeStyle(cfg));
  const isPieDonut = cfg.chartType === "pie" && current === "donut";

  if (variants.length <= 1) return null;

  const options = variants.map((v) => ({ value: v, label: styleVariantLabel(v) }));

  const applyVariant = (variant: string) => {
    if (cfg.chartType === "line") {
      let next: typeof cfg = { ...cfg, styleVariant: variant };
      if (variant === "smooth") {
        next = patchChartDeStyleNested(next, "cartesian", { lineSmooth: true });
      } else if (variant === "default" && current === "smooth") {
        next = patchChartDeStyleNested(next, "cartesian", { lineSmooth: false });
      }
      onChange(next);
      return;
    }
    if (cfg.chartType === "graph") {
      const layout = variant === "dagre" ? "dagre" : "force";
      onChange({
        ...patchChartDeStyleNested(cfg, "graph", { layout }),
        styleVariant: layout,
      });
      return;
    }
    onChange({ ...cfg, styleVariant: variant });
  };

  return (
    <ChartInspectorSection title="基础样式" data-testid="chart-variant-basic">
      {options.length <= 4 ? (
        <ChartDeSegmentField
          label={cfg.chartType === "pie" ? "饼图类型" : cfg.chartType === "graph" ? "布局" : "图表类型"}
          value={current}
          columns={Math.min(options.length, 4)}
          options={options}
          onChange={applyVariant}
        />
      ) : (
        <div className="border-b border-gray-100 py-2 dark:border-white/[0.06]">
          <p className="mb-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">图表类型</p>
          <Select value={current} onValueChange={applyVariant}>
            <SelectTrigger className={INSPECTOR_SELECT} aria-label="图表类型">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {isPieDonut ? (
        <ChartDeSliderField
          label="内径 %"
          value={pieStyle.innerRadiusPercent}
          fallback={DEFAULT_PIE_INNER_RADIUS_PERCENT}
          min={PIE_INNER_RADIUS_MIN}
          max={PIE_INNER_RADIUS_MAX}
          step={1}
          unit="%"
          onChange={(innerRadiusPercent) =>
            onChange(patchChartDeStyleNested(cfg, "pie", { innerRadiusPercent }))
          }
        />
      ) : null}
    </ChartInspectorSection>
  );
}

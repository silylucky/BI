import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChartEngineViewProps } from "@/components/charts/engine/types";
import { buildChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import { applyChartStyleChain } from "@/components/charts/engine/applyChartStyleChain";
import { renderD3CartesianChart } from "@/components/charts/engine/d3/cartesian/dispatch";
import { disposeD3Renderer, runD3Renderer } from "@/components/charts/engine/d3/core/d3RendererSession";
import {
  buildCartesianRenderConfig,
  d3CartesianTestId,
} from "@/components/charts/engine/d3/views/buildCartesianConfig";
import {
  ADVANCED_CHART_ROW_CAP,
  capRows,
} from "@/components/charts/engine/buildDatasetEncoding";
import { useElementSize } from "@/hooks/useElementSize";
import { useEmbeddedChartLiveResize } from "@/hooks/useEmbeddedChartLiveResize";
import { cn } from "@/lib/utils";

function resolvePaintWidth(
  el: HTMLElement,
  width: number | string | undefined,
  observedWidth: number,
  height: number,
): number {
  const fromProp = typeof width === "number" ? width : 0;
  const fromDom = el.clientWidth || observedWidth || fromProp;
  return fromDom > 0 ? fromDom : Math.max(320, height);
}

function D3CartesianViewInner(props: ChartEngineViewProps) {
  const { viewModel, style, chartConfig, fill = false, height = 180, width, ariaLabel } = props;

  const plan = useMemo(() => {
    const base = buildChartRenderPlan(viewModel);
    return applyChartStyleChain(base, style, chartConfig);
  }, [viewModel, style, chartConfig]);

  const { rows: capped, truncated } = useMemo(
    () => capRows(viewModel.dataset.rows, ADVANCED_CHART_ROW_CAP),
    [viewModel.dataset.rows],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const { ref: sizeRef, size } = useElementSize<HTMLDivElement>({ enabled: !fill });

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      sizeRef(node);
    },
    [sizeRef],
  );

  const testId = d3CartesianTestId(viewModel.chartType, plan.plotType);

  const rerender = useCallback(() => {
    const el = containerRef.current;
    if (!el || plan.kind !== "d3" || plan.empty || capped.length === 0) return;

    const chartWidth = fill ? el.clientWidth : resolvePaintWidth(el, width, size.width ?? 0, height);
    const chartHeight = fill ? el.clientHeight : height;
    const config = buildCartesianRenderConfig(props, plan, chartWidth, chartHeight);
    if (!config) return;
    try {
      runD3Renderer(el, () => renderD3CartesianChart(el, plan, config));
      setRenderError(null);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : "图表渲染失败");
    }
  }, [plan, capped.length, fill, width, height, size.width, size.height, props]);

  useEmbeddedChartLiveResize(fill && !plan.empty, containerRef, rerender, rerender);

  useEffect(() => {
    rerender();
  }, [rerender]);

  useEffect(() => {
    return () => disposeD3Renderer(containerRef.current);
  }, []);

  if (plan.error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center px-3 text-center text-theme-sm text-error-600 dark:text-error-400",
          fill ? "absolute inset-0" : "min-h-[180px]",
        )}
        role="alert"
      >
        {plan.error}
      </div>
    );
  }

  if (plan.empty || capped.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-theme-sm text-gray-400 dark:text-gray-500",
          fill ? "absolute inset-0" : "min-h-[180px]",
        )}
        role="status"
        aria-label="暂无数据"
      >
        暂无数据
      </div>
    );
  }

  return (
    <div
      className={cn("w-full", fill ? "absolute inset-0 flex min-h-0 flex-col" : "min-h-[120px]")}
      aria-label={ariaLabel}
    >
      {truncated ? (
        <p role="status" className="mb-2 shrink-0 text-theme-sm text-warning-600 dark:text-warning-400">
          数据量较大，已采样显示前 {ADVANCED_CHART_ROW_CAP} 条</p>
      ) : null}
      {renderError ? (
        <p role="alert" className="mb-2 shrink-0 text-theme-sm text-error-600 dark:text-error-400">
          {renderError}
        </p>
      ) : null}
      <div
        ref={setContainerRef}
        className={cn("relative", fill ? "min-h-0 flex-1" : "w-full")}
        data-testid={testId}
        style={fill ? undefined : { height, width: width ?? "100%" }}
      />
    </div>
  );
}

export const D3CartesianView = memo(D3CartesianViewInner);

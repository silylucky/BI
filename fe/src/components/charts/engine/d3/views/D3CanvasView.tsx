import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChartEngineViewProps } from "@/components/charts/engine/types";
import { buildChartRenderPlan } from "@/components/charts/engine/buildChartRenderPlan";
import { applyChartStyleChain } from "@/components/charts/engine/applyChartStyleChain";
import { embeddedSizeChanged, readChartPaintSize } from "@/components/charts/engine/embeddedContainerSize";
import { setChartAnimationSuppressed } from "@/components/charts/engine/d3/core/animate";
import { setDepthVisual } from "@/components/charts/engine/d3/core/chartVisualTokens";
import { disposeD3Renderer, runD3Renderer } from "@/components/charts/engine/d3/core/d3RendererSession";
import {
  beginPresentationPaint,
  endPresentationPaint,
  type ChartPresentationPaintContext,
} from "@/components/charts/engine/d3/core/chartPresentationScale";
import { renderD3Chart } from "@/components/charts/engine/d3/renderDispatch";
import { buildD3DispatchPayload } from "@/components/charts/engine/d3/views/buildRenderConfig";
import { buildD3CanvasContentKey } from "@/components/charts/engine/d3/views/buildD3CanvasContentKey";
import { d3ChartTestId } from "@/components/charts/engine/d3/views/d3TestId";
import {
  ADVANCED_CHART_ROW_CAP,
  GRAPH_CHART_ROW_CAP,
  capRows,
} from "@/components/charts/engine/buildDatasetEncoding";
import { usePixelShapePlayer } from "@/components/dashboard/pixelCanvas/pixelShapePlayerContext";
import { useElementSize } from "@/hooks/useElementSize";
import { useEmbeddedChartLiveResize } from "@/hooks/useEmbeddedChartLiveResize";
import { useChartVisualScale } from "@/hooks/useChartVisualScale";
import { capChartPaintSize } from "@/lib/dashboardEditChartPerf";
import { cn } from "@/lib/utils";

type PaintMode = "data" | "live" | "commit";

const LIVE_RESIZE_THROTTLE_MS = 100;

function D3CanvasViewInner(props: ChartEngineViewProps) {
  const {
    viewModel,
    style,
    chartConfig,
    fill = false,
    height = 180,
    width,
    ariaLabel,
    paintMaxEdge,
    chartDataRevision,
  } = props;

  const plan = useMemo(() => {
    const base = buildChartRenderPlan(viewModel);
    return applyChartStyleChain(base, style, chartConfig);
  }, [viewModel, style, chartConfig]);

  const rowCap = viewModel.chartType === "graph" ? GRAPH_CHART_ROW_CAP : ADVANCED_CHART_ROW_CAP;
  const { rows: capped, truncated } = useMemo(
    () => capRows(viewModel.dataset.rows, rowCap),
    [viewModel.dataset.rows, rowCap],
  );
  const graphDataTruncated =
    viewModel.chartType === "graph" && plan.kind === "d3" && Boolean(plan.options?.graphTruncated);

  const playing = usePixelShapePlayer();
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const visualScale = useChartVisualScale();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastMeasureRef = useRef({ width: 0, height: 0 });
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const measureRetryRef = useRef(0);
  const [renderError, setRenderError] = useState<string | null>(null);

  const { ref: sizeRef, size } = useElementSize<HTMLDivElement>({
    enabled: !fill,
    debounceMs: LIVE_RESIZE_THROTTLE_MS,
    paused: playing,
  });

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      sizeRef(node);
    },
    [sizeRef],
  );

  const testId = d3ChartTestId(viewModel.chartType, plan.plotType);
  const mapEmptyOk = viewModel.chartType === "map" || viewModel.chartType === "map-3d";

  const contentKey = useMemo(
    () =>
      buildD3CanvasContentKey({
        chartType: viewModel.chartType,
        plotType: plan.plotType,
        plan,
        rowCount: capped.length,
        rowSample: capped
          .slice(0, 6)
          .map((row) => row.map((cell) => String(cell ?? "")).join(","))
          .join("|"),
        style,
        chartConfig,
        chartDataRevision,
      }),
    [viewModel.chartType, plan, capped, style, chartConfig, chartDataRevision],
  );

  const readPaintSize = useCallback(() => {
    const el = containerRef.current;
    if (!el) return null;
    const raw = readChartPaintSize(el, {
      fill,
      visualScale,
      layoutFootprint: props.layoutFootprint,
      width,
      height,
      observedWidth: size.width,
    });
    if (!raw) return null;
    return capChartPaintSize(raw, paintMaxEdge);
  }, [fill, visualScale, props.layoutFootprint, width, height, size.width, paintMaxEdge]);

  const measureAndRender = useCallback(
    (mode: PaintMode, force = false) => {
      const el = containerRef.current;
      if (!el || plan.kind !== "d3" || plan.empty) return;
      if (!mapEmptyOk && capped.length === 0) return;

      const paint = readPaintSize();
      if (!paint) {
        if ((mode === "commit" || mode === "live") && measureRetryRef.current < 2) {
          measureRetryRef.current += 1;
          requestAnimationFrame(() => measureAndRender(mode, force));
        }
        return;
      }
      const next = { width: Math.round(paint.width), height: Math.round(paint.height) };
      if (next.width <= 0 || next.height <= 0) {
        if ((mode === "commit" || mode === "live") && measureRetryRef.current < 2) {
          measureRetryRef.current += 1;
          requestAnimationFrame(() => measureAndRender(mode, force));
        }
        return;
      }
      measureRetryRef.current = 0;
      if (!force && !embeddedSizeChanged(next, lastMeasureRef.current)) return;
      lastMeasureRef.current = next;

      el.dataset.vsIncremental = mode === "live" ? "true" : "false";
      setDepthVisual(style.depthVisual ?? "off");

      const suppressAnim = mode === "live" || mode === "commit";
      setChartAnimationSuppressed(suppressAnim);
      try {
        const paint: ChartPresentationPaintContext = {
          chartWidth: next.width,
          chartHeight: next.height,
          visualScale,
          renderTier: props.geo3dRenderTier,
        };
        beginPresentationPaint(paint);
        const payload = buildD3DispatchPayload(props, plan, next.width, next.height, {
          visualScale,
          renderTier: props.geo3dRenderTier,
        });
        if (!payload) return;
        runD3Renderer(el, () => renderD3Chart(el, plan, payload));
        setRenderError(null);
      } catch (err) {
        setRenderError(err instanceof Error ? err.message : "图表渲染失败");
      } finally {
        endPresentationPaint();
        if (mode !== "live") setChartAnimationSuppressed(false);
      }
    },
    [plan, capped.length, readPaintSize, visualScale, props, mapEmptyOk, style.depthVisual],
  );

  const measureAndRenderRef = useRef(measureAndRender);
  measureAndRenderRef.current = measureAndRender;

  const onLiveResize = useCallback(() => {
    setChartAnimationSuppressed(true);
    if (liveTimerRef.current !== null) return;
    liveTimerRef.current = setTimeout(() => {
      liveTimerRef.current = null;
      measureAndRender("live");
    }, LIVE_RESIZE_THROTTLE_MS);
  }, [measureAndRender]);

  const onCommitResize = useCallback(() => {
    if (liveTimerRef.current !== null) {
      clearTimeout(liveTimerRef.current);
      liveTimerRef.current = null;
    }
    // 无尺寸差则跳过（live 已画过则不闪）；commit 内仍压制入场动画
    measureAndRender("commit", false);
  }, [measureAndRender]);

  const onCommitResizeRef = useRef(onCommitResize);
  onCommitResizeRef.current = onCommitResize;

  useEmbeddedChartLiveResize(fill && !plan.empty, containerRef, onLiveResize, onCommitResize);

  useEffect(() => {
    measureAndRenderRef.current("data", true);
  }, [contentKey]);

  useEffect(() => {
    // 选区切换只改绘制上限；尺寸 cap 后无差则跳过，避免未缩放组件闪一下
    measureAndRenderRef.current("commit", false);
  }, [paintMaxEdge]);

  useEffect(() => {
    if (!props.layoutFootprint || playingRef.current) return;
    onCommitResizeRef.current();
  }, [props.layoutFootprint?.width, props.layoutFootprint?.height]);

  useEffect(() => {
    return () => {
      if (liveTimerRef.current !== null) clearTimeout(liveTimerRef.current);
      disposeD3Renderer(containerRef.current);
      setChartAnimationSuppressed(false);
    };
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

  if (plan.empty || (!mapEmptyOk && capped.length === 0)) {
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
    <div className={cn("w-full", fill ? "absolute inset-0 flex min-h-0 flex-col" : "min-h-[120px]")} aria-label={ariaLabel}>
      {truncated ? (
        <p role="status" className="mb-2 shrink-0 text-theme-sm text-warning-600 dark:text-warning-400">
          数据量较大，已采样显示前 {rowCap} 条</p>
      ) : null}
      {graphDataTruncated ? (
        <p role="status" className="mb-2 shrink-0 text-theme-sm text-warning-600 dark:text-warning-400">
          关系过多，已按关系强度保留主要节点与连线</p>
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

export const D3CanvasView = memo(D3CanvasViewInner);

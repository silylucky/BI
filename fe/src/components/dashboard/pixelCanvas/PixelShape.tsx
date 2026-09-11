import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { pixelWidgetToLayoutWidget } from "../dashboardCanvasMode";
import { mergeChartTitleStyle, readChartRemark, readChartTitleVisible, resolveChartContentShellStyle, mergeShapeInnerPresentation, resolveWidgetShellStyle } from "@/lib/chartDeStyle";
import {
  mergeCustomVizTitleStyle,
  readCustomVizRemark,
  readCustomVizTitleVisible,
  resolveCustomVizContentShellStyle,
} from "../custom-viz/customVizDisplayStyle";
import type { DashboardCanvas, PixelLayoutWidget } from "../layoutUtils";
import { mergeTitleStyle } from "../dashboardStyleConfig";
import { shapeInnerShellChromeStyle, shapeTitleStackStyle } from "../dashboardWidgetTypography";
import { resolveWidgetEffectiveScheme } from "@/lib/chartSurfaceTheme";
import { shapeTitlePresentationStyle } from "../dashboardWidgetTypography";
import { mergeWidgetOverrideStyle } from "../widgetRailStyleSections";
import { resolveDashboardAlignmentSnap, resolveDashboardChrome } from "../dashboardChromeConfig";
import {
  applyPixelInteraction,
  preferAdvancedResizeRect,
  RESIZE_CURSORS,
  RESIZE_DIRECTIONS,
  RESIZE_LABELS,
  screenDeltaToCanvas,
  SHAPE_RESIZE_HANDLE_SCREEN_PX,
  SHAPE_RESIZE_VISUAL_SCREEN_PX,
  type PixelInteractionKind,
  pixelShapePlayerZIndex,
  pixelShapeZIndex,
  type PixelRect,
  type ResizeDirection,
} from "./geometry";
import { computeMarkLineSnap, markLineThreshold, type MarkLineGuide } from "./pixelMarkLine";
import { resolveWidgetChromeInset } from "./shapeVisualInset";
import type { PixelShapePreviewSync } from "./pixelShapePreviewRegistry";
import { DashboardWidgetContextMenu, type DashboardWidgetActions } from "../WidgetContextMenu";
import { PixelShapeDragEdges } from "./PixelShapeDragEdges";
import { WidgetShapeChrome } from "./WidgetShapeChrome";
import { PixelShapeInteractionProvider } from "./PixelShapeInteractionContext";
import { PixelShapePlayerProvider } from "./pixelShapePlayerContext";
import { EmbeddedChartLegendShell } from "@/components/charts/EmbeddedChartLegend";
import {
  WidgetShellLegendProvider,
  useWidgetShellLegend,
} from "./widgetShellLegendContext";
import { usePixelShapeDocumentDrag } from "./usePixelShapeDocumentDrag";
import { usePaletteDragActive } from "./paletteDragContext";
import { usePixelChromeScale } from "./PixelCanvasScaleContext";
import {
  dispatchPixelShapeLiveResize,
} from "./pixelShapeLiveResize";
import { isScreenBorderWidget, isScreenVisualWidget } from "@/lib/screenVisualAssets";
import { applyScreenBorderShellPresentation } from "../screen/screenBorderWidgetChrome";
import { WidgetShellBackgroundLayers } from "../WidgetShellPresentationLayers";
import { pixelRectsNearlyEqual } from "./pixelRectEqual";
import { shouldApplyPropsRectToDisplay } from "./pixelShapePropsSync";

type ActiveInteraction = {
  pointerId: number;
  kind: PixelInteractionKind;
  startClient: { x: number; y: number };
  startRect: PixelRect;
  skipFirstMove: boolean;
  captureTarget: HTMLElement | null;
};

type PixelShapeProps = {
  widget: PixelLayoutWidget;
  canvas: DashboardCanvas;
  scale: number;
  /** 对标 DE curGap：shape 外层 padding（画布逻辑 px） */
  shapeGapPx?: number;
  mode: "edit" | "view";
  selected: boolean;
  children: ReactNode;
  onSelect?: (widgetId: string, additive: boolean) => void;
  onPreview?: (widget: PixelLayoutWidget) => void;
  onCommit?: (widget: PixelLayoutWidget) => void;
  onCancel?: (widgetId: string) => void;
  onPlayingChange?: (playing: boolean) => void;
  onMarkGuidesChange?: (guides: MarkLineGuide[] | null) => void;
  /** 编辑辅助网格：对齐参考线 + 20px 网格吸附 */
  markLinesEnabled?: boolean;
  viewport?: PixelRect;
  snapTargets?: Array<Pick<PixelRect, "x" | "y" | "width" | "height">>;
  otherWidgets?: Array<Pick<PixelRect, "x" | "y" | "width" | "height">>;
  widgetActions?: DashboardWidgetActions;
  styleConfig?: DashboardStyleConfig;
  registerPreviewSync?: (widgetId: string, sync: PixelShapePreviewSync) => () => void;
  /** 拖动/缩放中靠近画布边缘时自动滚动，返回 scrollTop 变化量 */
  onDragAutoScroll?: (event: PointerEvent) => number;
  /** 仪表板可向下撑高画布；大屏等固定画布场景为 false */
  allowBottomGrowth?: boolean;
  /** 重叠布局下 resize 仅改活动组件，无需 preview 推挤 */
  suppressResizePreview?: boolean;
  /** 仪表板碰撞 preview 推挤期：邻块仅 imperative，不写 React 几何 */
  layoutStyleDeferred?: boolean;
  /** 重叠布局：Alt/Ctrl+点击轮换选中下层组件 */
  allowStackCycleSelect?: boolean;
  onCycleStackSelect?: (clientX: number, clientY: number, hitWidgetId: string) => void;
};

const HANDLE_POSITION: Record<ResizeDirection, string> = {
  n: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
  ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2",
  e: "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
  se: "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
  s: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
  sw: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
  w: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
  nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
};

function widgetRect(widget: PixelLayoutWidget): PixelRect {
  return {
    x: widget.x,
    y: widget.y,
    width: widget.width,
    height: widget.height,
  };
}

function withRect(widget: PixelLayoutWidget, rect: PixelRect): PixelLayoutWidget {
  return { ...widget, ...rect };
}

function keyboardDelta(event: KeyboardEvent): { x: number; y: number } | null {
  const step = event.shiftKey ? 10 : 1;
  if (event.key === "ArrowLeft") return { x: -step, y: 0 };
  if (event.key === "ArrowRight") return { x: step, y: 0 };
  if (event.key === "ArrowUp") return { x: 0, y: -step };
  if (event.key === "ArrowDown") return { x: 0, y: step };
  return null;
}

function boundaryHint(
  start: PixelRect,
  delta: PixelRect,
  next: PixelRect,
  kind: PixelInteractionKind,
  canvas: DashboardCanvas,
  allowBottomGrowth: boolean,
): string | null {
  if (kind === "move") {
    if (delta.x > 0 && next.x < start.x + delta.x) return "已到画布右边界";
    if (delta.x < 0 && next.x > start.x + delta.x) return "已到画布左边界";
    if (delta.y < 0 && next.y > start.y + delta.y) return "已到画布顶部";
    if (!allowBottomGrowth && delta.y > 0 && next.y + next.height > canvas.height) {
      return "已到画布底部";
    }
    return null;
  }
  if (kind.includes("e") && next.width < start.width + delta.width) return "已到画布右边界";
  if (kind.includes("w") && next.x > start.x + delta.x) return "已到画布左边界";
  if (kind.includes("n") && next.y > start.y + delta.y) return "已到画布顶部";
  if (!allowBottomGrowth && kind.includes("s") && next.y + next.height > canvas.height) {
    return "已到画布底部";
  }
  return null;
}

function resolveShapeTitleState(
  widget: PixelLayoutWidget,
  styleConfig: DashboardStyleConfig | undefined,
  mode: "edit" | "view",
): {
  showTitle: boolean;
  titleStyle: CSSProperties;
  remark: { show: boolean; text: string };
} {
  const chrome = resolveDashboardChrome(styleConfig);
  const effectiveScheme = resolveWidgetEffectiveScheme(styleConfig);
  if (widget.type === "chart") {
    const chartTitleVisible = readChartTitleVisible(
      widget.chartConfig,
      styleConfig?.titleStyle,
    );
    return {
      showTitle: chartTitleVisible,
      titleStyle: mergeChartTitleStyle(
        styleConfig?.titleStyle,
        widget.chartConfig,
        effectiveScheme,
      ),
      remark: readChartRemark(widget.chartConfig),
    };
  }
  if (widget.type === "tabs" || widget.type === "text" || widget.type === "media") {
    return {
      showTitle: false,
      titleStyle: mergeTitleStyle(styleConfig?.titleStyle),
      remark: { show: false, text: "" },
    };
  }
  if (widget.type === "customViz" && widget.customVizConfig) {
    return {
      showTitle: readCustomVizTitleVisible(widget.customVizConfig, styleConfig),
      titleStyle: mergeCustomVizTitleStyle(
        styleConfig?.titleStyle,
        widget.customVizConfig,
        effectiveScheme,
      ),
      remark: readCustomVizRemark(widget.customVizConfig),
    };
  }
  const showTitle = mode === "edit" ? chrome.showChartActionButtons : true;
  return {
    showTitle,
    titleStyle: mergeTitleStyle(styleConfig?.titleStyle),
    remark: { show: false, text: "" },
  };
}

type PixelShapeInnerChromeProps = {
  widget: PixelLayoutWidget;
  scale: number;
  mode: "edit" | "view";
  selectedInEdit: boolean;
  showTitle: boolean;
  titleStyle: CSSProperties;
  remark: { show: boolean; text: string };
  innerShell: ReturnType<typeof mergeShapeInnerPresentation>["shell"];
  contentShell: ReturnType<typeof mergeShapeInnerPresentation>["content"];
  onTitleChange?: (widgetId: string, title: string) => void;
  onSelect?: (widgetId: string, additive: boolean) => void;
  startInteraction: (event: PointerEvent<HTMLElement>, kind: PixelInteractionKind) => void;
  handleKeyboardInteraction: (
    event: KeyboardEvent<HTMLElement>,
    kind: PixelInteractionKind,
  ) => void;
  contentRef?: RefObject<HTMLDivElement | null>;
  children: ReactNode;
};

function PixelShapeInnerChrome({
  widget,
  scale,
  mode,
  selectedInEdit,
  showTitle,
  titleStyle,
  remark,
  innerShell,
  contentShell,
  onTitleChange,
  onSelect,
  startInteraction,
  handleKeyboardInteraction,
  contentRef,
  children,
}: PixelShapeInnerChromeProps) {
  const chromeScale = usePixelChromeScale();
  const legendCtx = useWidgetShellLegend();
  const legend = legendCtx?.state;
  const layoutWidget = pixelWidgetToLayoutWidget(widget);
  const screenVisualAsset =
    layoutWidget.type === "text" && isScreenVisualWidget(layoutWidget);
  // 始终使用同一壳层结构，避免图例从空→有时在 Shell/裸 children 间切换导致 ChartRenderer 卸载重挂、execute 死循环
  const legendItems =
    legend?.visible && legend.items.length > 0 ? legend.items : [];

  const clipChart = true;
  const chartBody = screenVisualAsset ? (
    <div
      className={cn(
        "relative z-[1] flex h-full min-h-0 min-w-0 flex-1 flex-col",
        clipChart ? "overflow-hidden" : "overflow-visible",
      )}
    >
      {children}
    </div>
  ) : (
    <EmbeddedChartLegendShell
      position={legend?.position ?? "bottom"}
      orient={legend?.orient ?? "horizontal"}
      hAlign={legend?.hAlign ?? "center"}
      vAlign={legend?.vAlign ?? "bottom"}
      fontSize={legend?.fontSize ?? 12}
      icon={legend?.icon ?? "triangle"}
      iconSize={legend?.iconSize ?? 6}
      textColor={legend?.textColor}
      items={legendItems}
      clipChart={clipChart}
    >
      {children}
    </EmbeddedChartLegendShell>
  );

  const overflowClass = clipChart ? "overflow-hidden" : "overflow-visible";

  return (
    <>
      <WidgetShellBackgroundLayers layers={innerShell} prefix={`pixel-shell-${widget.id}`} />
      <div
        className={cn("relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col", overflowClass)}
        style={showTitle ? shapeTitleStackStyle(titleStyle, chromeScale) : undefined}
      >
        <WidgetShapeChrome
          title={widget.title}
          titleStyle={shapeTitlePresentationStyle(titleStyle, chromeScale)}
          titleMetricsStyle={titleStyle}
          showTitle={showTitle}
          remark={remark}
          mode={mode}
          selected={selectedInEdit}
          widgetId={widget.id}
          canvasScale={scale}
          onTitleChange={onTitleChange}
          onSelectPointerDown={(event) => onSelect?.(widget.id, event.shiftKey)}
          onDragPointerDown={(event) => startInteraction(event, "move")}
          onDragKeyDown={(event) => handleKeyboardInteraction(event, "move")}
        />
        <div
          ref={contentRef}
          className={cn(
            "pixel-shape-content relative z-[1] flex min-h-0 min-w-0 w-full flex-1 flex-col",
            overflowClass,
          )}
          style={contentShell.style}
        >
          <WidgetShellBackgroundLayers layers={contentShell} prefix={`pixel-content-${widget.id}`} />
          <div className={cn("relative z-[1] flex min-h-0 min-w-0 w-full flex-1 flex-col", overflowClass)}>
            {chartBody}
          </div>
          {contentShell.frameLayers.map((layer, index) =>
            layer ? (
              <div
                key={`content-frame-${index}`}
                className="pointer-events-none absolute inset-0 z-[2]"
                style={layer}
                aria-hidden
                data-testid="pixel-shape-content-frame"
              />
            ) : null,
          )}
        </div>
      </div>
      {innerShell.frameLayers.map((layer, index) =>
        layer ? (
          <div
            key={`shell-frame-${index}`}
            className="pointer-events-none absolute inset-0 z-[3]"
            style={layer}
            aria-hidden
            data-testid="pixel-shape-shell-frame"
          />
        ) : null,
      )}
    </>
  );
}

export function PixelShape({
  widget,
  canvas,
  scale,
  shapeGapPx = 0,
  mode,
  selected,
  children,
  onSelect,
  onPreview,
  onCommit,
  onCancel,
  onPlayingChange,
  onMarkGuidesChange,
  markLinesEnabled = true,
  viewport,
  snapTargets,
  otherWidgets,
  widgetActions,
  styleConfig,
  registerPreviewSync,
  onDragAutoScroll,
  allowBottomGrowth = true,
  suppressResizePreview = false,
  layoutStyleDeferred = false,
  allowStackCycleSelect = false,
  onCycleStackSelect,
}: PixelShapeProps) {
  const bindDocumentDrag = usePixelShapeDocumentDrag();
  const chromeScale = usePixelChromeScale();
  const paletteDragActive = usePaletteDragActive();
  const { showTitle, titleStyle, remark } = resolveShapeTitleState(widget, styleConfig, mode);
  const onTitleChange = widgetActions?.onTitleChange;
  const chrome = resolveDashboardChrome(styleConfig);
  const alignmentSnap = resolveDashboardAlignmentSnap(styleConfig);
  const effectiveScheme = resolveWidgetEffectiveScheme(styleConfig);
  const chromeInset = resolveWidgetChromeInset(styleConfig?.widgetStyle);
  const shellWidgetStyle = mergeWidgetOverrideStyle(styleConfig?.widgetStyle, widget);
  const shell =
    widget.type === "chart" && widget.chartConfig
      ? resolveChartContentShellStyle(
          shellWidgetStyle,
          widget.chartConfig,
          effectiveScheme,
        )
      : widget.type === "customViz" && widget.customVizConfig
        ? resolveCustomVizContentShellStyle(widget, styleConfig, effectiveScheme)
        : {
            outer: resolveWidgetShellStyle(
              shellWidgetStyle,
              effectiveScheme,
            ),
            inner: {} as CSSProperties,
            innerBackgroundLayer: null,
            innerFrameLayer: null,
          };
  const { shell: innerShell, content: contentShell } =
    widget.type === "text" && isScreenBorderWidget(widget)
      ? applyScreenBorderShellPresentation(mergeShapeInnerPresentation(shell))
      : mergeShapeInnerPresentation(shell);
  const isBorderAsset = widget.type === "text" && isScreenBorderWidget(widget);
  const activeRef = useRef<ActiveInteraction | null>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef(widgetRect(widget));
  const moveFrameRef = useRef<number | null>(null);
  const pendingMoveRef = useRef<{
    rect: PixelRect;
    guides: MarkLineGuide[];
    event: PointerEvent;
    active: ActiveInteraction;
  } | null>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const hintValueRef = useRef<string | null>(null);
  const lastSyncedPropsRectRef = useRef<PixelRect | null>(null);
  const [isPlayer, setIsPlayer] = useState(false);

  const syncHint = (nextHint: string | null) => {
    if (hintValueRef.current === nextHint) return;
    hintValueRef.current = nextHint;
    const el = hintRef.current;
    if (!el) return;
    if (nextHint) {
      el.textContent = nextHint;
      el.hidden = false;
    } else {
      el.textContent = "";
      el.hidden = true;
    }
  };

  const syncOuterStyle = (next: PixelRect) => {
    const el = outerRef.current;
    if (!el) return;
    el.style.left = `${next.x}px`;
    el.style.top = `${next.y}px`;
    el.style.width = `${next.width}px`;
    el.style.height = `${next.height}px`;
  };

  const bindOuterRef = useCallback(
    (el: HTMLDivElement | null) => {
      outerRef.current = el;
      if (!el || activeRef.current) return;
      const propsRect = widgetRect(widget);
      const display = displayRef.current;
      if (
        !shouldApplyPropsRectToDisplay(
          display,
          propsRect,
          lastSyncedPropsRectRef.current,
        )
      ) {
        syncOuterStyle(display);
        return;
      }
      lastSyncedPropsRectRef.current = propsRect;
      displayRef.current = propsRect;
      syncOuterStyle(propsRect);
    },
    [widget.x, widget.y, widget.width, widget.height],
  );

  useEffect(() => {
    if (!registerPreviewSync) return;
    return registerPreviewSync(widget.id, (rect) => {
      displayRef.current = rect;
      syncOuterStyle(rect);
    });
  }, [widget.id, registerPreviewSync]);

  useLayoutEffect(() => {
    if (activeRef.current) return;
    const next = widgetRect(widget);
    const prev = lastSyncedPropsRectRef.current;
    if (prev && pixelRectsNearlyEqual(prev, next)) return;
    if (!shouldApplyPropsRectToDisplay(displayRef.current, next, prev)) {
      syncOuterStyle(displayRef.current);
      return;
    }
    lastSyncedPropsRectRef.current = next;
    displayRef.current = next;
    syncOuterStyle(next);
  }, [widget.x, widget.y, widget.width, widget.height]);

  useLayoutEffect(() => {
    if (activeRef.current) return;
    syncOuterStyle(displayRef.current);
  }, [layoutStyleDeferred]);

  useEffect(
    () => () => {
      if (moveFrameRef.current !== null) {
        cancelAnimationFrame(moveFrameRef.current);
      }
    },
    [],
  );

  const applyDisplay = (next: PixelRect) => {
    displayRef.current = next;
    syncOuterStyle(next);
    if (activeRef.current) {
      dispatchPixelShapeLiveResize();
    }
  };

  const snapPointerRect = (
    raw: PixelRect,
    event: PointerEvent,
    active: ActiveInteraction,
  ): { rect: PixelRect; guides: MarkLineGuide[] } => {
    let rect = raw;
    let guides: MarkLineGuide[] = [];
    if (markLinesEnabled) {
      const markTargets = snapTargets ?? otherWidgets ?? [];
      const snapped = computeMarkLineSnap(raw, markTargets, {
        threshold: markLineThreshold(scale, alignmentSnap.markLineThresholdPx),
        dragDir: {
          isRightward: event.clientX >= active.startClient.x,
          isDownward: event.clientY >= active.startClient.y,
        },
        interactionKind: active.kind,
        anchorRect: active.startRect,
        snapEdges: alignmentSnap.snapEdges,
        snapCenters: alignmentSnap.snapCenters,
      });
      rect = snapped.rect;
      guides = snapped.guides;
    }
    onMarkGuidesChange?.(guides.length > 0 ? guides : null);
    return { rect, guides };
  };

  const rectForPointer = (
    event: PointerEvent,
    active: ActiveInteraction,
  ): { rect: PixelRect; guides: MarkLineGuide[] } => {
    const screenDelta = {
      x: event.clientX - active.startClient.x,
      y: event.clientY - active.startClient.y,
    };
    const delta = screenDeltaToCanvas(screenDelta, scale);
    const raw = applyPixelInteraction(active.startRect, delta, active.kind, canvas, {
      allowBottomGrowth,
    });
    const nextHint = boundaryHint(
      active.startRect,
      { x: delta.x, y: delta.y, width: raw.width - active.startRect.width, height: raw.height - active.startRect.height },
      raw,
      active.kind,
      canvas,
      allowBottomGrowth,
    );
    syncHint(nextHint);
    return snapPointerRect(raw, event, active);
  };

  const applyPendingMoveFrame = () => {
    if (moveFrameRef.current !== null) {
      cancelAnimationFrame(moveFrameRef.current);
      moveFrameRef.current = null;
    }
    const pending = pendingMoveRef.current;
    pendingMoveRef.current = null;
    if (!pending) return;
    applyDisplay(pending.rect);
    onMarkGuidesChange?.(pending.guides.length > 0 ? pending.guides : null);
    if (!suppressResizePreview || pending.active.kind === "move") {
      onPreview?.(withRect(widget, pending.rect));
    }
  };

  const flushPointerFrame = () => {
    moveFrameRef.current = null;
    applyPendingMoveFrame();
  };

  const handlePointerMove = (event: PointerEvent) => {
    const active = activeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.skipFirstMove) {
      active.skipFirstMove = false;
    }
    const scrollDelta = onDragAutoScroll?.(event) ?? 0;
    if (scrollDelta !== 0) {
      active.startClient.y -= scrollDelta;
    }
    const { rect: next, guides } = rectForPointer(event, active);
    pendingMoveRef.current = { rect: next, guides, event, active };
    if (moveFrameRef.current !== null) return;
    moveFrameRef.current = requestAnimationFrame(flushPointerFrame);
  };

  const releasePointerCapture = (active: ActiveInteraction, pointerId: number) => {
    const target = active.captureTarget;
    if (!target?.hasPointerCapture?.(pointerId)) return;
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      // 浏览器已释放或目标已卸载
    }
  };

  const finish = (event: PointerEvent, commit: boolean) => {
    const active = activeRef.current;
    if (!active) return;
    if (active.pointerId !== event.pointerId) return;
    applyPendingMoveFrame();
    let finalRect = displayRef.current;
    if (active.kind !== "move") {
      const pointerRect = rectForPointer(event, active).rect;
      finalRect = preferAdvancedResizeRect(
        active.startRect,
        displayRef.current,
        pointerRect,
        active.kind,
      );
    }
    const movedFromStart = !pixelRectsNearlyEqual(finalRect, active.startRect);
    const shouldCommit = commit || movedFromStart;
    const settledRect = shouldCommit ? finalRect : active.startRect;
    releasePointerCapture(active, event.pointerId);
    activeRef.current = null;
    syncHint(null);
    onMarkGuidesChange?.(null);
    applyDisplay(settledRect);
    if (shouldCommit) {
      lastSyncedPropsRectRef.current = null;
      onCommit?.(withRect(widget, settledRect));
    } else onCancel?.(widget.id);
    setIsPlayer(false);
    onPlayingChange?.(false);
  };

  const startInteraction = (
    event: PointerEvent<HTMLElement>,
    kind: PixelInteractionKind,
  ) => {
    if (mode !== "edit" || event.button > 0 || paletteDragActive || widget.locked) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(widget.id, event.shiftKey);
    syncHint(null);
    const pointerId = event.pointerId;
    if (activeRef.current) {
      const pending = activeRef.current;
      releasePointerCapture(pending, pending.pointerId);
      activeRef.current = null;
      onCommit?.(withRect(widget, displayRef.current));
    }
    const captureTarget =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    if (captureTarget?.setPointerCapture) {
      try {
        captureTarget.setPointerCapture(pointerId);
      } catch {
        // 部分环境不支持或目标不可捕获
      }
    }
    activeRef.current = {
      pointerId,
      kind,
      startClient: { x: event.clientX, y: event.clientY },
      startRect: displayRef.current,
      skipFirstMove: true,
      captureTarget,
    };
    setIsPlayer(true);
    onPlayingChange?.(true);
    bindDocumentDrag(pointerId, {
      onMove: handlePointerMove,
      onEnd: (endEvent, commit) => finish(endEvent, commit),
    });
  };

  const handleKeyboardInteraction = (
    event: KeyboardEvent<HTMLElement>,
    kind: PixelInteractionKind,
  ) => {
    if (widget.locked) return;
    const delta = keyboardDelta(event);
    if (!delta) return;
    event.preventDefault();
    event.stopPropagation();
    onSelect?.(widget.id, event.shiftKey);
    const next = applyPixelInteraction(displayRef.current, delta, kind, canvas, {
      allowBottomGrowth,
    });
    applyDisplay(next);
    onCommit?.(withRect(widget, next));
  };


  const selectedInEdit = Boolean(mode === "edit" && selected);
  const committedRect = widgetRect(widget);
  const liveRect = displayRef.current;
  const rectOutOfSync =
    liveRect.x !== committedRect.x ||
    liveRect.y !== committedRect.y ||
    liveRect.width !== committedRect.width ||
    liveRect.height !== committedRect.height;
  const omitReactGeometry = layoutStyleDeferred;
  const stableRect = rectOutOfSync ? liveRect : committedRect;

  if (mode === "view" && widget.hidden) {
    return null;
  }

  const shapeSurface = (
    <PixelShapeInteractionProvider value={startInteraction}>
      <WidgetShellLegendProvider>
        <PixelShapePlayerProvider playing={isPlayer}>
          <div
            className={cn(
              "pixel-shape-inner dashboard-widget-surface relative z-[1] flex min-h-0 flex-1 flex-col overflow-hidden",
              selectedInEdit && "pixel-shape-selected",
            )}
            style={{
              ...innerShell.style,
              ...(showTitle ? shapeInnerShellChromeStyle(titleStyle, chromeScale) : {}),
            }}
            data-pixel-no-drag
            data-screen-border-asset={isBorderAsset ? "" : undefined}
            onPointerDown={(event) => {
              if (mode === "edit" && !paletteDragActive) {
                const target = event.target as HTMLElement;
                if (target.closest("[data-tabs-widget-id]")) {
                  return;
                }
                if (
                  allowStackCycleSelect &&
                  onCycleStackSelect &&
                  (event.altKey || event.ctrlKey)
                ) {
                  event.preventDefault();
                  event.stopPropagation();
                  onCycleStackSelect(event.clientX, event.clientY, widget.id);
                  return;
                }
                onSelect?.(widget.id, event.shiftKey);
              }
            }}
          >
            <PixelShapeInnerChrome
              widget={widget}
              scale={scale}
              mode={mode}
              selectedInEdit={selectedInEdit}
              showTitle={showTitle}
              titleStyle={titleStyle}
              remark={remark}
              innerShell={innerShell}
              contentShell={contentShell}
              onTitleChange={onTitleChange}
              onSelect={onSelect}
              startInteraction={startInteraction}
              handleKeyboardInteraction={handleKeyboardInteraction}
              contentRef={contentRef}
            >
              {children}
            </PixelShapeInnerChrome>
          </div>
        </PixelShapePlayerProvider>
      </WidgetShellLegendProvider>
    </PixelShapeInteractionProvider>
  );

  const shapeBody =
    mode === "edit" && widgetActions && chrome.showFloatingActions ? (
      <DashboardWidgetContextMenu
        widget={widget}
        actions={widgetActions}
        colorScheme={styleConfig?.colorScheme ?? "light"}
        selected={selected}
        onSelect={onSelect}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{shapeSurface}</div>
      </DashboardWidgetContextMenu>
    ) : (
      shapeSurface
    );

  return (
    <div
      ref={bindOuterRef}
      id={`shape-id-${widget.id}`}
      data-testid={`pixel-shape-${widget.id}`}
      data-component-id={widget.id}
      data-pixel-is-player={isPlayer ? "" : undefined}
        className={cn(
        "shape pixel-shape-outer dashboard-shape-gap-shell absolute flex touch-none select-none flex-col border-0 bg-transparent",
        selectedInEdit && "z-[1] pixel-shape-edit",
        widget.hidden && mode === "edit" && "opacity-35 ring-1 ring-dashed ring-gray-400/60 dark:ring-gray-500/50",
        widget.locked && mode === "edit" && "ring-1 ring-amber-400/50",
        paletteDragActive && "pointer-events-none",
      )}
      style={{
        ...(omitReactGeometry
          ? {}
          : {
              left: stableRect.x,
              top: stableRect.y,
              width: stableRect.width,
              height: stableRect.height,
            }),
        zIndex: isPlayer
          ? pixelShapePlayerZIndex(widget.order)
          : pixelShapeZIndex(widget.order, selectedInEdit),
        boxSizing: "border-box",
        ["--dashboard-shape-gap" as string]: `${Math.max(0, shapeGapPx)}px`,
      }}
    >
      <p
        ref={hintRef}
        className="sr-only"
        role="status"
        data-testid="pixel-boundary-hint"
        hidden
      />
      {selectedInEdit && !paletteDragActive ? (
        <PixelShapeDragEdges
          widgetId={widget.id}
          scale={scale}
          onDragPointerDown={(event) => startInteraction(event, "move")}
          onDragKeyDown={(event) => handleKeyboardInteraction(event, "move")}
        />
      ) : null}
      <div
        data-testid={`pixel-shape-body-${widget.id}`}
        className="pixel-shape-body relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      >
        {shapeBody}
      </div>

      {mode === "edit" && selected && !widget.locked
        ? RESIZE_DIRECTIONS.map((direction) => (
            <IconButton
              key={direction}
              type="button"
              variant="ghost"
              size="sm"
              data-testid={`pixel-resize-${direction}`}
              className={cn(
                "absolute z-30 flex touch-none select-none items-center justify-center rounded-none p-0",
                HANDLE_POSITION[direction],
              )}
              style={{
                width: SHAPE_RESIZE_HANDLE_SCREEN_PX / scale,
                height: SHAPE_RESIZE_HANDLE_SCREEN_PX / scale,
                cursor: RESIZE_CURSORS[direction],
              }}
              aria-label={`调整组件大小：${RESIZE_LABELS[direction]}`}
              onPointerDown={(event) => startInteraction(event, direction)}
              onKeyDown={(event) => handleKeyboardInteraction(event, direction)}
            >
              <span
                data-testid={`pixel-resize-visual-${direction}`}
                className="rounded-sm border border-brand-500 bg-white dark:bg-gray-900"
                style={{
                  width: SHAPE_RESIZE_VISUAL_SCREEN_PX / scale,
                  height: SHAPE_RESIZE_VISUAL_SCREEN_PX / scale,
                }}
              />
            </IconButton>
          ))
        : null}
    </div>
  );
}

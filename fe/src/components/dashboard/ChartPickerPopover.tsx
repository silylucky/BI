import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChartType } from "@/lib/chartViewConfig";
import { setChartTypeDragData } from "@/lib/dashboardDnd";
import {
  buildFallbackCatalogItems,
  enrichChartCatalogItems,
  fetchChartTypeCatalog,
  getChartTypeDisplayName,
  type ChartTypeCatalogItem,
} from "@/lib/chartRegistry";
import {
  buildDeStylePaletteSections,
  type DePaletteSection,
} from "@/lib/chartPaletteTaxonomy";
import { cn } from "@/lib/utils";
import { chartTypeIcon } from "@/lib/chartTypeIcons";
import type { CustomVizInsertPayload } from "@/components/dashboard/createLayoutWidget";
import { setCustomVizDragData, type CustomVizDragPayload } from "@/lib/dashboardDnd";
import { fetchAiVizArtifacts, AI_VIZ_STYLE_COMPLIANCE_LABELS, humanizeAiVizComplianceWarning, type AiVizArtifactMeta } from "@/lib/aiVizArtifacts";
import { queryKeys } from "@/lib/queryKeys";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { hasCapability } from "@/lib/capabilities";
import { sessionUserFromMe } from "@/lib/session";
import {
  AiVizArtifactDeleteDialog,
  type AiVizArtifactDeleteTarget,
} from "@/components/dashboard/ai-viz/AiVizArtifactDeleteDialog";
import {
  ChartExploreCatalogTrigger,
  ChartExploreDrawer,
} from "@/components/dashboard/ChartExploreDrawer";

type ChartPickerPopoverProps = {
  onInsert: (type: ChartType) => void;
  onInsertCustomViz?: (payload: CustomVizInsertPayload) => void;
  onInserted?: () => void;
  /** 由父级托管目录 Drawer 时传入（避免 Dropdown 关闭导致 Drawer 卸载） */
  onOpenCatalog?: () => void;
  onPaletteDragStart?: () => void;
  onPaletteDragEnd?: () => void;
  /** 选择态高亮（新建组件等场景） */
  selectedType?: ChartType;
  /** 自定义组件 artifact 选择态（与 selectedType 互斥） */
  selectedCustomVizArtifactId?: string | null;
  /** 默认 true；对话框内选类型时可关闭拖拽 */
  enableDrag?: boolean;
  /**
   * scroll：看板工具栏 — 右侧连续滚动 + IntersectionObserver 联动侧栏（默认）
   * isolated：Admin 弹窗等矮容器 — 侧栏切换时只展示当前分区，避免分类「串」在一起
   */
  layout?: "scroll" | "isolated";
  className?: string;
};

const CUSTOM_VIZ_SECTION_ID = "custom-viz";

function CustomVizTile({
  item,
  onInsert,
  onRemove,
  onInserted,
  onPaletteDragStart,
  onPaletteDragEnd,
  selected = false,
  enableDrag = true,
}: {
  item: AiVizArtifactMeta;
  onInsert: (payload: CustomVizInsertPayload) => void;
  onRemove?: (artifactId: string) => void;
  onInserted?: () => void;
  onPaletteDragStart?: () => void;
  onPaletteDragEnd?: () => void;
  selected?: boolean;
  enableDrag?: boolean;
}) {
  const label = item.manifest.displayName ?? item.manifest.id ?? "自定义组件";
  const complianceWarnings = item.warnings ?? [];
  const complianceTier = item.styleComplianceTier ?? (complianceWarnings.length > 0 ? "visual-only" : "full");
  const tierLabel = AI_VIZ_STYLE_COMPLIANCE_LABELS[complianceTier];
  const warningHint =
    complianceWarnings.length > 0
      ? `${tierLabel}\n${complianceWarnings.map((warning) => humanizeAiVizComplianceWarning(warning.message)).join("\n")}`
      : tierLabel !== AI_VIZ_STYLE_COMPLIANCE_LABELS.full
        ? tierLabel
        : undefined;
  const payload: CustomVizDragPayload = {
    type: "customViz",
    artifactId: item.artifactId,
    displayName: label,
  };

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={enableDrag}
      aria-pressed={selected}
      onDragStart={(e) => {
        if (!enableDrag) return;
        setCustomVizDragData(e.dataTransfer, payload);
        onPaletteDragStart?.();
        e.stopPropagation();
      }}
      onDragEnd={() => {
        if (!enableDrag) return;
        onPaletteDragEnd?.();
      }}
      onClick={() => {
        onInsert({ type: "customViz", artifactId: item.artifactId, displayName: label });
        onInserted?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInsert({ type: "customViz", artifactId: item.artifactId, displayName: label });
          onInserted?.();
        }
      }}
      className={cn(
        "relative flex flex-col items-center gap-1.5 rounded-lg border p-1.5 text-center transition-colors",
        enableDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        selected
          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:border-brand-500/60 dark:bg-brand-500/10 dark:ring-brand-500/25"
          : "border-transparent hover:border-brand-200 hover:bg-brand-50/60 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10",
        "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20",
      )}
      data-testid={`custom-viz-tile-${item.artifactId}`}
      title={warningHint}
    >
      {onRemove ? (
        <button
          type="button"
          className="absolute right-0 top-0 z-10 flex size-5 items-center justify-center rounded-md text-gray-400 hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/10 dark:hover:text-error-400"
          aria-label={`从组件库移除 ${label}`}
          title="从组件库移除"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove(item.artifactId);
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
        >
          <Trash2 className="size-3" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
      <span className="relative flex size-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-brand-500 dark:bg-white/[0.06] dark:text-brand-400">
        <Sparkles className="size-6" strokeWidth={1.75} aria-hidden />
        {complianceWarnings.length > 0 ? (
          <span
            className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-warning-500 text-white"
            aria-label="样式合规警告"
            title={warningHint}
          >
            <TriangleAlert className="size-2.5" strokeWidth={2.5} aria-hidden />
          </span>
        ) : complianceTier === "partial" ? (
          <span
            className="absolute -right-0.5 -top-0.5 rounded-full bg-brand-500 px-1 text-[9px] font-semibold leading-4 text-white"
            title={warningHint}
          >
            部分
          </span>
        ) : null}
      </span>
      <span className="line-clamp-2 w-full text-[11px] leading-tight text-gray-700 dark:text-gray-300">
        {label}
      </span>
      {complianceTier !== "full" ? (
        <span className="text-[10px] text-gray-500 dark:text-gray-400">{tierLabel}</span>
      ) : null}
    </div>
  );
}

function ChartTypeTile({
  item,
  onInsert,
  onInserted,
  onPaletteDragStart,
  onPaletteDragEnd,
  selected = false,
  enableDrag = true,
}: {
  item: ChartTypeCatalogItem;
  onInsert: (type: ChartType) => void;
  onInserted?: () => void;
  onPaletteDragStart?: () => void;
  onPaletteDragEnd?: () => void;
  selected?: boolean;
  enableDrag?: boolean;
}) {
  const chartType = item.type as ChartType;
  const label = item.displayName || getChartTypeDisplayName(item.type);
  const Icon = chartTypeIcon(item.type);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={enableDrag}
      aria-pressed={selected}
      onDragStart={(e) => {
        if (!enableDrag) return;
        setChartTypeDragData(e.dataTransfer, chartType);
        onPaletteDragStart?.();
        e.stopPropagation();
      }}
      onDragEnd={() => {
        if (!enableDrag) return;
        onPaletteDragEnd?.();
      }}
      onClick={() => {
        onInsert(chartType);
        onInserted?.();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onInsert(chartType);
          onInserted?.();
        }
      }}
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border p-1.5 text-center transition-colors",
        enableDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        selected
          ? "border-brand-500 bg-brand-50 ring-2 ring-brand-500/20 dark:border-brand-500/60 dark:bg-brand-500/10 dark:ring-brand-500/25"
          : "border-transparent hover:border-brand-200 hover:bg-brand-50/60 dark:hover:border-brand-500/30 dark:hover:bg-brand-500/10",
        "focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20",
      )}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-brand-500 dark:bg-white/[0.06] dark:text-brand-400">
        <Icon className="size-6" strokeWidth={1.75} aria-hidden />
      </span>
      <span className="line-clamp-2 w-full text-[11px] leading-tight text-gray-700 dark:text-gray-300">
        {label}
      </span>
    </div>
  );
}

function SectionGrid({
  section,
  onInsert,
  onInserted,
  onPaletteDragStart,
  onPaletteDragEnd,
  selectedType,
  enableDrag,
}: {
  section: DePaletteSection;
  onInsert: (type: ChartType) => void;
  onInserted?: () => void;
  onPaletteDragStart?: () => void;
  onPaletteDragEnd?: () => void;
  selectedType?: ChartType;
  enableDrag?: boolean;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">{section.label}</h3>
      <div className="grid grid-cols-4 gap-1">
        {section.items.map((item) => (
          <ChartTypeTile
            key={item.type}
            item={item}
            onInsert={onInsert}
            onInserted={onInserted}
            onPaletteDragStart={onPaletteDragStart}
            onPaletteDragEnd={onPaletteDragEnd}
            selected={selectedType === item.type}
            enableDrag={enableDrag}
          />
        ))}
      </div>
    </section>
  );
}

/** DataEase 风格：左侧分类导航 + 右侧连续滚动分区 */
export function ChartPickerPopover({
  onInsert,
  onInsertCustomViz,
  onInserted,
  onOpenCatalog,
  onPaletteDragStart,
  onPaletteDragEnd,
  selectedType,
  selectedCustomVizArtifactId,
  enableDrag = true,
  layout = "scroll",
  className,
}: ChartPickerPopoverProps) {
  const isIsolated = layout === "isolated";
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const canRemoveCustomViz = hasCapability(
    sessionUserFromMe(authUser ?? { username: "访客", roles: ["viewer"] }),
    "dashboard:edit",
  );
  const [catalog, setCatalog] = useState<ChartTypeCatalogItem[] | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>("quota");
  const [deleteTarget, setDeleteTarget] = useState<AiVizArtifactDeleteTarget | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLElement>());
  const scrollingByNavRef = useRef(false);

  useEffect(() => {
    void fetchChartTypeCatalog()
      .then((items) => setCatalog(Array.isArray(items) ? enrichChartCatalogItems(items) : null))
      .catch(() => setCatalog(null));
  }, []);

  const sections = useMemo(() => {
    const items = catalog?.length ? catalog : buildFallbackCatalogItems();
    return buildDeStylePaletteSections(enrichChartCatalogItems(items));
  }, [catalog]);

  const { data: customArtifactsData } = useQuery({
    queryKey: queryKeys.aiViz.list({ limit: 100, offset: 0 }),
    queryFn: () => fetchAiVizArtifacts(100, 0),
    enabled: Boolean(onInsertCustomViz),
  });
  const customArtifacts = customArtifactsData?.items ?? [];
  const handleRemoveCustomArtifact = useCallback((artifactId: string) => {
    const label =
      customArtifacts.find((item) => item.artifactId === artifactId)?.manifest.displayName ??
      "该组件";
    setDeleteTarget({ artifactId, label });
  }, [customArtifacts]);
  const navSections = useMemo(
    () =>
      onInsertCustomViz
        ? [...sections, { id: CUSTOM_VIZ_SECTION_ID, label: "自定义", items: [] }]
        : sections,
    [onInsertCustomViz, sections],
  );

  const setSectionRef = useCallback((id: string, node: HTMLElement | null) => {
    if (node) sectionRefs.current.set(id, node);
    else sectionRefs.current.delete(id);
  }, []);

  useEffect(() => {
    if (navSections.length === 0) return;
    if (!navSections.some((section) => section.id === activeSectionId)) {
      setActiveSectionId(navSections[0]!.id);
    }
  }, [navSections, activeSectionId]);

  useEffect(() => {
    if (isIsolated) return;
    const root = scrollRef.current;
    if (!root || navSections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingByNavRef.current) return;
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const top = visible[0]?.target.getAttribute("data-section-id");
        if (top) setActiveSectionId(top);
      },
      { root, threshold: 0.15, rootMargin: "-8px 0px -55% 0px" },
    );

    for (const section of navSections) {
      const node = sectionRefs.current.get(section.id);
      if (node) observer.observe(node);
    }

    return () => observer.disconnect();
  }, [isIsolated, navSections]);

  const scrollToSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    if (isIsolated) return;
    const node = sectionRefs.current.get(sectionId);
    if (!node || !scrollRef.current) return;
    scrollingByNavRef.current = true;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => {
      scrollingByNavRef.current = false;
    }, 400);
  };

  const activeChartSection = useMemo(
    () => sections.find((section) => section.id === activeSectionId) ?? sections[0],
    [activeSectionId, sections],
  );

  const renderSectionPanels = () => {
    if (isIsolated) {
      if (activeSectionId === CUSTOM_VIZ_SECTION_ID && onInsertCustomViz) {
        return (
          <div
            ref={(node) => setSectionRef(CUSTOM_VIZ_SECTION_ID, node)}
            data-section-id={CUSTOM_VIZ_SECTION_ID}
            className="scroll-mt-1"
          >
            <section className="space-y-2">
              <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">自定义</h3>
              {customArtifacts.length === 0 ? (
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  暂无 AI 自定义组件，请先在 AI 组件工作台生成并入库。
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {customArtifacts.map((item) => (
                    <CustomVizTile
                      key={item.artifactId}
                      item={item}
                      onInsert={onInsertCustomViz}
                      onRemove={canRemoveCustomViz ? handleRemoveCustomArtifact : undefined}
                      onInserted={onInserted}
                      onPaletteDragStart={onPaletteDragStart}
                      onPaletteDragEnd={onPaletteDragEnd}
                      selected={selectedCustomVizArtifactId === item.artifactId}
                      enableDrag={enableDrag}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        );
      }
      if (!activeChartSection) {
        return (
          <p className="text-theme-xs text-gray-500 dark:text-gray-400">暂无可用图表类型</p>
        );
      }
      return (
        <div
          ref={(node) => setSectionRef(activeChartSection.id, node)}
          data-section-id={activeChartSection.id}
          className="scroll-mt-1"
        >
          <SectionGrid
            section={activeChartSection}
            onInsert={onInsert}
            onInserted={onInserted}
            onPaletteDragStart={onPaletteDragStart}
            onPaletteDragEnd={onPaletteDragEnd}
            selectedType={selectedCustomVizArtifactId ? undefined : selectedType}
            enableDrag={enableDrag}
          />
        </div>
      );
    }

    return (
      <>
        {sections.map((section) => (
          <div
            key={section.id}
            ref={(node) => setSectionRef(section.id, node)}
            data-section-id={section.id}
            className="scroll-mt-1"
          >
            <SectionGrid
              section={section}
              onInsert={onInsert}
              onInserted={onInserted}
              onPaletteDragStart={onPaletteDragStart}
              onPaletteDragEnd={onPaletteDragEnd}
              selectedType={selectedCustomVizArtifactId ? undefined : selectedType}
              enableDrag={enableDrag}
            />
          </div>
        ))}
        {onInsertCustomViz ? (
          <div
            ref={(node) => setSectionRef(CUSTOM_VIZ_SECTION_ID, node)}
            data-section-id={CUSTOM_VIZ_SECTION_ID}
            className="scroll-mt-1"
          >
            <section className="space-y-2">
              <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">自定义</h3>
              {customArtifacts.length === 0 ? (
                <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                  暂无 AI 自定义组件，请先在 AI 组件工作台生成并入库。
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {customArtifacts.map((item) => (
                    <CustomVizTile
                      key={item.artifactId}
                      item={item}
                      onInsert={onInsertCustomViz}
                      onRemove={canRemoveCustomViz ? handleRemoveCustomArtifact : undefined}
                      onInserted={onInserted}
                      onPaletteDragStart={onPaletteDragStart}
                      onPaletteDragEnd={onPaletteDragEnd}
                      selected={selectedCustomVizArtifactId === item.artifactId}
                      enableDrag={enableDrag}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}
      </>
    );
  };

  return (
    <>
    <div
      className={cn("flex h-[min(70vh,400px)] min-h-[360px]", className)}
      data-testid="chart-picker-popover"
    >
      <nav
        className="custom-scrollbar flex w-[84px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-gray-200 py-1 pr-1 dark:border-gray-800"
        aria-label="图表分类"
      >
        {navSections.map((section) => {
          const active = section.id === activeSectionId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => scrollToSection(section.id)}
              className={cn(
                "rounded-md px-2 py-2 text-left text-[11px] leading-snug transition-colors",
                active
                  ? "bg-brand-50 font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-400"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5",
              )}
            >
              {section.label}
            </button>
          );
        })}
      </nav>

      <div
        ref={scrollRef}
        className="custom-scrollbar min-w-0 flex-1 overflow-y-auto px-3 py-2"
      >
        <div className={cn(isIsolated ? "space-y-2" : "space-y-5")}>{renderSectionPanels()}</div>
        {!isIsolated ? (
        <div className="mt-4 border-t border-gray-200 pt-2 dark:border-gray-800">
          <ChartExploreCatalogTrigger
            dense
            onOpen={() => {
              if (onOpenCatalog) {
                onOpenCatalog();
                return;
              }
              setCatalogOpen(true);
            }}
          />
        </div>
        ) : null}
      </div>
    </div>
    {!onOpenCatalog ? (
      <ChartExploreDrawer open={catalogOpen} onOpenChange={setCatalogOpen} />
    ) : null}
    <AiVizArtifactDeleteDialog
      target={deleteTarget}
      open={Boolean(deleteTarget)}
      onOpenChange={(open) => {
        if (!open) setDeleteTarget(null);
      }}
      onDeleted={() => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.aiViz.all });
      }}
    />
    </>
  );
}

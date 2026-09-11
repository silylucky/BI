import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MousePointerClick, Search } from "lucide-react";
import { ListPageSection, ListPageToolbar } from "@/components/layout/list-page-kit";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { enrichChartCatalogItems } from "@/lib/chartRegistry";
import {
  buildDeStylePaletteSections,
  filterVisibleCatalogItems,
} from "@/lib/chartPaletteTaxonomy";
import { queryKeys } from "@/lib/queryKeys";
import {
  CatalogListItem,
  CatalogMetric,
  CatalogSectionNav,
  ChartTypeDetail,
} from "@/pages/admin/charts/chartExplorePanels";
import type { ChartTypeCatalogEntry } from "@/pages/admin/charts/chartExploreTypes";

export type { ChartTypeCatalogEntry };

type ChartExploreContentProps = {
  /** Drawer 内嵌时省略外层 min-h 约束 */
  embedded?: boolean;
};

function mapCatalogEntry(item: ChartTypeCatalogEntry): ChartTypeCatalogEntry {
  return {
    ...item,
    paletteCategory: item.paletteCategory ?? item.category,
  };
}

export function ChartExploreContent({ embedded: _embedded = false }: ChartExploreContentProps) {
  const [sectionFilter, setSectionFilter] = useState<string>("__all__");
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: queryKeys.charts.types,
    queryFn: async () => {
      const raw = await apiFetch<ChartTypeCatalogEntry[]>("/api/v1/charts/types");
      return enrichChartCatalogItems(raw).map(mapCatalogEntry);
    },
  });

  const items = useMemo(() => filterVisibleCatalogItems(data ?? []), [data]);
  const sections = useMemo(() => buildDeStylePaletteSections(items), [items]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const pool =
      sectionFilter === "__all__"
        ? items
        : (sections.find((section) => section.id === sectionFilter)?.items ?? []);
    if (!needle) return pool;
    return pool.filter(
      (chart) =>
        chart.displayName.toLowerCase().includes(needle) ||
        chart.type.toLowerCase().includes(needle),
    );
  }, [items, sections, sectionFilter, query]);

  const grouped = useMemo(() => {
    if (sectionFilter !== "__all__") return [];
    const visibleTypes = new Set(filtered.map((chart) => chart.type));
    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => visibleTypes.has(item.type)),
      }))
      .filter((section) => section.items.length > 0);
  }, [filtered, sectionFilter, sections]);

  const selected = filtered.find((chart) => chart.type === selectedType) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!filtered.length) {
      setSelectedType(null);
      return;
    }
    if (!selectedType || !filtered.some((chart) => chart.type === selectedType)) {
      setSelectedType(filtered[0]!.type);
    }
  }, [filtered, selectedType]);

  const runtimeEngineKinds = new Set(items.map((chart) => chart.library).filter(Boolean)).size;
  const catalogRendererKinds = new Set(
    items.map((chart) => chart.catalogRenderer ?? chart.renderer).filter(Boolean),
  ).size;
  const maxStyleVariants = items.length
    ? Math.max(...items.map((chart) => chart.styleVariants.length))
    : 0;

  const sectionPills = useMemo(
    () => [{ id: "__all__", label: "全部" }, ...sections.map((s) => ({ id: s.id, label: s.label }))],
    [sections],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {isError ? (
        <PageErrorBanner message={mapApiError(error)} onRetry={() => void refetch()} />
      ) : null}

      <Alert severity="info" appearance="subtle" className="shrink-0">
        <AlertDescription>
          本目录为只读参考，与编辑态组件库分区一致；实际建图请在仪表板/大屏编辑页添加组件并配置数据源。
        </AlertDescription>
      </Alert>

      <ListPageSection className="min-h-0 flex-1">
        <ListPageToolbar
          filters={
            <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative w-full max-w-xs">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400"
                  aria-hidden
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="搜索图表名称或类型 ID"
                  className="h-10 pl-9"
                  aria-label="搜索图表类型"
                />
              </div>
              <div className="hidden flex-wrap items-center gap-2 lg:flex">
                {sectionPills.map((pill) => (
                  <Button
                    key={pill.id}
                    type="button"
                    size="sm"
                    variant={sectionFilter === pill.id ? "primary" : "outline"}
                    onClick={() => setSectionFilter(pill.id)}
                  >
                    {pill.label}
                  </Button>
                ))}
              </div>
              <div className="lg:hidden">
                <Label className="mb-2 block">组件分区</Label>
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sectionPills.map((pill) => (
                      <SelectItem key={pill.id} value={pill.id}>
                        {pill.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          }
          actions={
            isLoading ? (
              <Skeleton className="h-10 w-48 rounded-lg" aria-label="加载注册表摘要" />
            ) : (
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-2 dark:border-gray-800 dark:bg-white/[0.02]">
                <CatalogMetric label="图表类型" value={items.length} />
                <CatalogMetric label="组件分区" value={sections.length} />
                <CatalogMetric label="运行时引擎" value={runtimeEngineKinds} />
                <CatalogMetric label="注册渲染器" value={catalogRendererKinds} />
                <CatalogMetric label="样式变体（最多）" value={maxStyleVariants} />
              </div>
            )
          }
        />

        <div className="flex min-h-0 flex-1 overflow-hidden lg:hidden">
          <div className="flex w-full flex-col gap-3 border-b border-gray-100 p-4 dark:border-white/[0.06]">
            <Label>图表类型</Label>
            <Select
              value={selected?.type ?? "__none__"}
              onValueChange={(value) => setSelectedType(value === "__none__" ? null : value)}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="选择图表类型" />
              </SelectTrigger>
              <SelectContent>
                {filtered.map((chart) => (
                  <SelectItem key={chart.type} value={chart.type}>
                    {chart.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <CatalogSectionNav
            sections={sections}
            activeSectionId={sectionFilter}
            onSelect={setSectionFilter}
          />

          <aside className="hidden min-h-0 w-[min(280px,30%)] shrink-0 flex-col border-r border-gray-100 dark:border-white/[0.06] lg:flex">
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
              {isLoading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <Skeleton key={index} className="mb-1 h-11 w-full rounded-lg" />
                  ))
                : null}
              {!isLoading && filtered.length === 0 ? (
                <p className="px-3 py-8 text-center text-theme-sm text-gray-500 dark:text-gray-400">
                  没有匹配的图表类型
                </p>
              ) : null}
              {!isLoading && sectionFilter === "__all__"
                ? grouped.map((group) => (
                    <div key={group.id} className="mb-3">
                      <p className="px-3 py-2 text-theme-xs font-medium tracking-wide text-gray-400 uppercase dark:text-gray-500">
                        {group.label}
                      </p>
                      <div className="space-y-0.5">
                        {group.items.map((item) => (
                          <CatalogListItem
                            key={item.type}
                            chart={item}
                            active={selected?.type === item.type}
                            onSelect={() => setSelectedType(item.type)}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                : null}
              {!isLoading && sectionFilter !== "__all__"
                ? filtered.map((chart) => (
                    <CatalogListItem
                      key={chart.type}
                      chart={chart}
                      active={selected?.type === chart.type}
                      onSelect={() => setSelectedType(chart.type)}
                    />
                  ))
                : null}
            </div>
          </aside>

          <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {isLoading ? (
              <div className="p-6">
                <Skeleton className="h-48 w-full rounded-xl" />
              </div>
            ) : selected ? (
              <ChartTypeDetail chart={selected} />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
                  <MousePointerClick className="size-6" aria-hidden />
                </div>
                <h3 className="text-theme-base font-semibold text-gray-800 dark:text-white/90">
                  {filtered.length ? "选择图表类型" : "暂无匹配结果"}
                </h3>
                <p className="mt-2 max-w-sm text-theme-sm text-gray-500 dark:text-gray-400">
                  {filtered.length
                    ? "从左侧目录选择图表，查看字段规则、样式变体与支持能力。"
                    : "尝试调整搜索关键词或切换组件分区。"}
                </p>
              </div>
            )}
          </section>
        </div>
      </ListPageSection>
    </div>
  );
}

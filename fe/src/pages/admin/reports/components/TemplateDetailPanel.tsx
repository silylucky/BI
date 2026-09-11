import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Layers,
  Settings2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { catalogNodePath } from "@/lib/reportCatalogUtils";
import { BatchImportPanel } from "./BatchImportPanel";
import { CatalogNodeMetaPanel } from "./CatalogNodeMetaPanel";
import { CatalogNodeDeleteButton } from "./CatalogNodeDeleteButton";
import { ReportExportCard } from "./ReportExportCard";
import { ReportExtensionPreview } from "./ReportExtensionPreview";
import { ReportMetricExtensionForm } from "./ReportMetricExtensionForm";
import { SchedulePanel } from "./SchedulePanel";
import { TemplateBlockEditor } from "./TemplateBlockEditor";
import {
  TemplateEmptyState,
  TemplateMetaGrid,
  TemplateMetaItem,
  TemplatePanelHeader,
  TemplatePanelSection,
  TemplateTabShell,
} from "./templatePanelUi";
import { type CatalogNode, useCatalogExtension, useExtensionRenderSpec, useExtensionRevisions } from "../useReportTemplates";
import type { ReportCatalogNode } from "@/lib/reportCatalogUtils";

const KIND_LABELS: Record<string, string> = {
  excel: "Excel",
  pdf: "PDF",
};

const TEMPLATE_TABS = [
  { value: "basic", label: "基本信息", icon: FileText },
  { value: "blocks", label: "模板块", icon: Layers },
  { value: "extension", label: "扩展配置", icon: Settings2 },
  { value: "preview", label: "预览", icon: Eye },
  { value: "schedule", label: "调度", icon: Clock },
] as const;

export function TemplateDetailPanel({
  node,
  allNodes,
  readOnly,
  onDeleted,
}: {
  node: CatalogNode;
  allNodes: ReportCatalogNode[];
  readOnly: boolean;
  onDeleted?: () => void;
}) {
  const [tab, setTab] = useState("basic");
  const tabByNodeRef = useRef<Record<string, string>>({});
  const extQuery = useCatalogExtension(node.id);
  const revisionsQuery = useExtensionRevisions(node.id);
  const renderQuery = useExtensionRenderSpec(node.id, tab === "preview");
  const extensionData =
    extQuery.data && String(extQuery.data.catalogNodeId) === String(node.id) ? extQuery.data : null;
  const extensionLoading = extQuery.isPending && !extensionData;
  const previewData =
    renderQuery.data && String(renderQuery.data.templateNodeId ?? "") === node.id
      ? renderQuery.data
      : null;

  const parentPath = useMemo(() => {
    if (!node.parentId) return "根目录";
    const parent = allNodes.find((n) => n.id === node.parentId);
    return parent ? catalogNodePath(parent, allNodes) : "…";
  }, [allNodes, node.parentId]);

  useEffect(() => {
    const saved = tabByNodeRef.current[node.id];
    if (saved) setTab(saved);
    else setTab("basic");
  }, [node.id]);

  const handleTabChange = (value: string) => {
    tabByNodeRef.current[node.id] = value;
    setTab(value);
  };

  const templateKind = node.templateKind as string | null;
  const exportDisabled =
    extensionLoading || !extensionData || (extensionData.metrics?.length ?? 0) === 0;
  const exportDisabledHint = "请先配置扩展指标";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <TemplatePanelHeader
        title={node.name}
        kindLabel={node.templateKind ? KIND_LABELS[node.templateKind] : undefined}
        templateKey={node.templateKey}
        parentPath={parentPath}
        icon={FileText}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => handleTabChange("preview")}>
              <Eye className="size-4" aria-hidden />
              预览
            </Button>
            <ReportExportCard
              variant="toolbar"
              defaultTemplateId={node.id}
              defaultFormat={node.templateKind ?? "pdf"}
              disabled={exportDisabled}
              disabledHint={exportDisabledHint}
            />
            {!readOnly ? <CatalogNodeDeleteButton node={node} onDeleted={onDeleted} /> : null}
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6">
        <Tabs value={tab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col">
          <TabsList
            variant="enclosed"
            size="sm"
            className="w-full shrink-0 justify-start overflow-x-auto"
          >
            {TEMPLATE_TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value} variant="enclosed" size="sm">
                <Icon className="size-3.5 shrink-0" aria-hidden />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="min-h-0 flex-1 overflow-y-auto pt-5">
            <TabsContent value="basic" className="mt-0">
              <TemplateTabShell>
                <CatalogNodeMetaPanel
                  node={node}
                  allNodes={allNodes}
                  readOnly={readOnly}
                />
                <TemplatePanelSection
                  title="模板属性"
                  description="节点类型与格式标识，用于目录管理与导出路由。"
                  icon={FileText}
                >
                  <TemplateMetaGrid columns={3}>
                    <TemplateMetaItem label="节点类型">报表模板</TemplateMetaItem>
                    <TemplateMetaItem label="模板格式">
                      {node.templateKind ? KIND_LABELS[node.templateKind] : "—"}
                    </TemplateMetaItem>
                    <TemplateMetaItem label="模板键">
                      <span className="font-mono text-theme-xs">{node.templateKey ?? "—"}</span>
                    </TemplateMetaItem>
                  </TemplateMetaGrid>
                </TemplatePanelSection>
                <TemplatePanelSection
                  title="批量导入（高级）"
                  description="从 JSON 批量导入报表模板，适用于迁移或初始化。"
                  icon={Upload}
                >
                  <BatchImportPanel readOnly={readOnly} />
                </TemplatePanelSection>
              </TemplateTabShell>
            </TabsContent>

            <TabsContent value="blocks" className="mt-0">
              <TemplateTabShell>
                <TemplatePanelSection
                  title="模板块"
                  description="定义模板中的 SQL、表格或图表数据块，保存后用于文档渲染。"
                  icon={Layers}
                >
                  {node.templateKey && node.templateKind ? (
                    <TemplateBlockEditor
                      nodeId={node.id}
                      templateKey={node.templateKey}
                      format={node.templateKind}
                      displayName={node.name}
                      readOnly={readOnly}
                    />
                  ) : (
                    <TemplateEmptyState
                      title="尚未设置模板键"
                      description="请先在基本信息中保存模板键，再编辑模板块。"
                    />
                  )}
                </TemplatePanelSection>
              </TemplateTabShell>
            </TabsContent>

            <TabsContent value="extension" className="mt-0">
              <TemplateTabShell>
                <TemplatePanelSection
                  title="指标与筛选"
                  description="配置报表查数指标、数据集绑定与运行时数据源。"
                  icon={Settings2}
                >
                  <ReportMetricExtensionForm
                    nodeId={node.id}
                    readOnly={readOnly}
                    metrics={extensionData?.metrics ?? []}
                    filters={extensionData?.filters ?? []}
                    defaultDataSourceId={extensionData?.defaultDataSourceId}
                    isLoading={extensionLoading}
                  />
                  {(revisionsQuery.data?.items?.length ?? 0) > 0 ? (
                    <Collapsible
                      defaultOpen={false}
                      className="group mt-6 rounded-xl border border-gray-200 dark:border-gray-800"
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-xl p-4 text-left transition-colors hover:bg-gray-50/80 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30 dark:hover:bg-white/[0.03]">
                        <ChevronRight
                          className="size-4 shrink-0 text-gray-400 transition-transform group-data-[state=open]:rotate-90"
                          aria-hidden
                        />
                        <span className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
                          修订历史
                        </span>
                        <span className="ml-auto text-theme-xs tabular-nums text-gray-500 dark:text-gray-400">
                          {revisionsQuery.data?.items?.length ?? 0} 条
                        </span>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <ul className="space-y-1 border-t border-gray-200 px-4 py-3 text-theme-xs text-gray-600 dark:border-gray-800 dark:text-gray-400">
                          {revisionsQuery.data?.items?.map((rev) => (
                            <li key={rev.revision}>
                              v{rev.revision}
                              {rev.changeNote ? ` · ${rev.changeNote}` : ""}
                            </li>
                          ))}
                        </ul>
                      </CollapsibleContent>
                    </Collapsible>
                  ) : null}
                </TemplatePanelSection>
              </TemplateTabShell>
            </TabsContent>

            <TabsContent value="preview" className="mt-0">
              <TemplateTabShell>
                {renderQuery.isLoading && !previewData ? (
                  <Skeleton className="h-48 w-full rounded-2xl" />
                ) : null}
                {renderQuery.isError && !previewData ? (
                  <TemplateEmptyState
                    title="暂无渲染规格"
                    description="请先在「扩展配置」中添加指标并保存。当前为指标配置预览，非最终文档渲染。"
                  />
                ) : null}
                {previewData ? <ReportExtensionPreview data={previewData} /> : null}
              </TemplateTabShell>
            </TabsContent>

            <TabsContent value="schedule" className="mt-0">
              <SchedulePanel catalogNodeId={node.id} readOnly={readOnly} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Braces, ChevronDown, Eye } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ReportResultTable } from "./ReportResultTable";
import {
  TemplateEmptyState,
  TemplateMetaGrid,
  TemplateMetaItem,
  TemplatePanelSection,
} from "./templatePanelUi";
import type { ExtensionMetric } from "../useReportTemplates";

type RenderSpec = {
  templateNodeId?: string;
  revision?: number;
  renderVersion?: string;
  templateKind?: string | null;
  metrics?: ExtensionMetric[];
  filters?: Array<{ key: string; operator: string }>;
};

function metricModeLabel(mode?: string) {
  return mode === "dataset" ? "数据集" : "SQL 查询";
}

function metricConfigSummary(metric: ExtensionMetric) {
  if (metric.queryMode === "dataset") {
    return metric.datasetId ? `数据集 ${metric.datasetId.slice(0, 8)}…` : "未绑定数据集";
  }
  if (metric.expression?.trim()) {
    const expr = metric.expression.trim();
    return expr.length > 48 ? `${expr.slice(0, 48)}…` : expr;
  }
  return "未配置 SQL 表达式";
}

export function ReportExtensionPreview({
  data,
  embedded = false,
}: {
  data: RenderSpec;
  embedded?: boolean;
}) {
  const [jsonOpen, setJsonOpen] = useState(false);
  const metrics = data.metrics ?? [];

  const previewRows = metrics.map((m) => [
    m.label,
    m.key,
    metricModeLabel(m.queryMode),
    metricConfigSummary(m),
  ]);

  const content = (
    <div className="space-y-5">
      <TemplateMetaGrid columns={3}>
        <TemplateMetaItem label="修订版本">{data.revision ?? "—"}</TemplateMetaItem>
        <TemplateMetaItem label="渲染版本">{data.renderVersion ?? "—"}</TemplateMetaItem>
        <TemplateMetaItem label="模板格式">{data.templateKind ?? "—"}</TemplateMetaItem>
      </TemplateMetaGrid>

      {metrics.length === 0 ? (
        <TemplateEmptyState
          title="暂无可见指标"
          description="请先在扩展配置中添加并保存指标，再查看预览。"
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <p className="border-b border-gray-200 bg-gray-50/60 px-4 py-3 text-theme-sm font-medium text-gray-800 dark:border-gray-800 dark:bg-white/[0.02] dark:text-white/90">
            指标预览
          </p>
          <div className="p-4">
            <ReportResultTable
              columns={["显示名", "指标键", "查数模式", "配置摘要"]}
              rows={previewRows}
            />
          </div>
        </div>
      )}

      <Collapsible open={jsonOpen} onOpenChange={setJsonOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-theme-sm text-gray-600 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03]">
          <span className="flex items-center gap-2">
            <Braces className="size-4" aria-hidden />
            开发者 JSON
          </span>
          <ChevronDown className={`size-4 transition-transform ${jsonOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-2 max-h-[320px] overflow-auto rounded-xl border border-gray-200 bg-gray-50/50 p-4 font-mono text-theme-xs text-gray-700 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-300">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <TemplatePanelSection
      title="配置预览"
      description="展示当前扩展配置的指标摘要与版本信息。"
      icon={Eye}
    >
      {content}
    </TemplatePanelSection>
  );
}

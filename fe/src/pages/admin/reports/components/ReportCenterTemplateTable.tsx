import type { ReactNode } from "react";
import { Link } from "react-router";
import { FileBarChart, FileSpreadsheet, FileText, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ReportCatalogNode } from "@/lib/reportCatalogUtils";
import { catalogNodePath } from "@/lib/reportCatalogUtils";
import {
  isLiveTemplateReadiness,
  localizeTemplateReadiness,
  type TemplateReadiness,
} from "@/lib/reportTemplateReadiness";
import { cn } from "@/lib/utils";

const KIND_LABEL: Record<string, string> = {
  pdf: "PDF",
  excel: "Excel",
};

const KIND_ICON: Record<string, typeof FileText> = {
  excel: FileSpreadsheet,
  pdf: FileBarChart,
};

function FormatBadge({ kind }: { kind: string | null }) {
  const Icon = KIND_ICON[kind ?? ""] ?? FileBarChart;
  return (
    <Badge variant="outline" className="gap-1 font-normal">
      <Icon className="size-3" aria-hidden />
      {KIND_LABEL[kind ?? ""] ?? "报表"}
    </Badge>
  );
}

function ReadinessBadge({ readiness }: { readiness?: TemplateReadiness }) {
  if (!readiness) return <span className="text-theme-xs text-gray-400">—</span>;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-normal",
        isLiveTemplateReadiness(readiness)
          ? "border-success-200 text-success-700 dark:border-success-500/30 dark:text-success-400"
          : "border-amber-200 text-amber-700 dark:border-amber-500/30 dark:text-amber-400",
      )}
    >
      {localizeTemplateReadiness(readiness)}
    </Badge>
  );
}

export function buildReportCenterTemplateRows(
  items: ReportCatalogNode[],
  readinessByNodeId: Map<string, TemplateReadiness>,
  allNodes: ReportCatalogNode[] = [],
): ReactNode[][] {
  return items.map((node) => [
    <div key="name" className="min-w-0">
      <Link
        to={`/admin/reports/view/${node.id}`}
        className="font-medium text-gray-900 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400"
      >
        {node.name}
      </Link>
      {allNodes.length > 0 && node.parentId ? (
        <p className="mt-0.5 truncate text-[11px] text-gray-400">{catalogNodePath(node, allNodes)}</p>
      ) : null}
      {node.templateKey ? (
        <p className="mt-0.5 truncate font-mono text-[11px] text-gray-400">{node.templateKey}</p>
      ) : null}
    </div>,
    <FormatBadge key="kind" kind={node.templateKind} />,
    <ReadinessBadge key="ready" readiness={readinessByNodeId.get(node.id)} />,
    <Button key="run" type="button" variant="primary" size="sm" asChild>
      <Link to={`/admin/reports/view/${node.id}`}>
        <Play className="size-3.5" aria-hidden />
        运行
      </Link>
    </Button>,
  ]);
}

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TemplateBlock } from "../useReportTemplates";
import { MetricRefSelect } from "./MetricRefSelect";

type Props = {
  block: TemplateBlock;
  metricKeys?: string[];
  readOnly?: boolean;
  onPatch: (patch: Partial<TemplateBlock>) => void;
};

export function CrosstabBlockFields({ block, metricKeys = [], readOnly = false, onPatch }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <MetricRefSelect
          id={`crosstab-metric-${block.tableRef ?? "ref"}`}
          label="关联指标"
          hint="须与「扩展配置」中的指标键一致，用于匹配查数结果。"
          value={block.tableRef ?? ""}
          metricKeys={metricKeys}
          readOnly={readOnly}
          onChange={(tableRef) => onPatch({ tableRef })}
        />
      </div>
      <div className="grid gap-2">
        <Label>行维度字段</Label>
        <Input
          value={block.rowField ?? ""}
          onChange={(e) => onPatch({ rowField: e.target.value })}
          disabled={readOnly}
          placeholder="结果集中的列名"
        />
      </div>
      <div className="grid gap-2">
        <Label>列维度字段</Label>
        <Input
          value={block.colField ?? ""}
          onChange={(e) => onPatch({ colField: e.target.value })}
          disabled={readOnly}
          placeholder="结果集中的列名"
        />
      </div>
      <div className="grid gap-2">
        <Label>指标字段</Label>
        <Input
          value={block.valueField ?? ""}
          onChange={(e) => onPatch({ valueField: e.target.value })}
          disabled={readOnly}
          placeholder="用于聚合的数值列"
        />
      </div>
      <div className="grid gap-2">
        <Label>聚合方式</Label>
        <Select
          value={block.agg ?? "sum"}
          onValueChange={(v) => onPatch({ agg: v as TemplateBlock["agg"] })}
          disabled={readOnly}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sum">求和</SelectItem>
            <SelectItem value="count">计数</SelectItem>
            <SelectItem value="max">最大</SelectItem>
            <SelectItem value="min">最小</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

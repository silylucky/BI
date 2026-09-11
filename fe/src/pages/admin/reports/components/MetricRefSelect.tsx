import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  id: string;
  label: string;
  hint?: string;
  value: string;
  metricKeys: string[];
  readOnly?: boolean;
  onChange: (value: string) => void;
};

export function MetricRefSelect({
  id,
  label,
  hint,
  value,
  metricKeys,
  readOnly = false,
  onChange,
}: Props) {
  if (metricKeys.length > 0) {
    return (
      <div className="grid gap-2">
        <Label htmlFor={id}>{label}</Label>
        {hint ? <p className="text-theme-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
        <Select value={value || undefined} onValueChange={onChange} disabled={readOnly}>
          <SelectTrigger id={id}>
            <SelectValue placeholder="选择扩展配置中的指标" />
          </SelectTrigger>
          <SelectContent>
            {metricKeys.map((key) => (
              <SelectItem key={key} value={key}>
                {key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <p className="text-theme-xs text-gray-500 dark:text-gray-400">
        {hint ?? "请先在「扩展配置」中添加指标，保存后再选择关联指标。"}
      </p>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        placeholder="与扩展指标键一致"
      />
    </div>
  );
}

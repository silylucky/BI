import { Badge } from "@/components/ui/badge";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import {
  isSourceUnavailable,
  sourceHealthBadgeLabel,
  type SourceHealth,
} from "@/lib/sourceHealth";

type SourceHealthBadgeProps = {
  health?: SourceHealth | null;
  className?: string;
};

export function SourceHealthBadge({ health, className }: SourceHealthBadgeProps) {
  if (!isSourceUnavailable(health)) return null;
  const label = sourceHealthBadgeLabel(health);
  return (
    <HintTooltip label="绑定的数据连接已删除或不可见">
      <Badge variant="light" color="error" size="sm" className={className}>
        {label}
      </Badge>
    </HintTooltip>
  );
}

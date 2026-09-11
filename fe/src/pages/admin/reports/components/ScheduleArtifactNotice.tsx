import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LAYOUT_INVENTORY_NOTICE } from "@/lib/scheduleArtifactMeta";

export function ScheduleArtifactNotice({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Alert variant="info">
      <Info className="size-4" aria-hidden />
      <AlertDescription>{LAYOUT_INVENTORY_NOTICE}</AlertDescription>
    </Alert>
  );
}

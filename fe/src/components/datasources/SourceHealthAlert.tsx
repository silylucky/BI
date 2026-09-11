import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  isSourceUnavailable,
  sourceHealthAlertDescription,
  sourceHealthAlertTitle,
  type SourceHealth,
} from "@/lib/sourceHealth";

type SourceHealthAlertProps = {
  health?: SourceHealth | null;
  entity: "dataset" | "sync_job";
  className?: string;
};

export function SourceHealthAlert({ health, entity, className }: SourceHealthAlertProps) {
  if (!isSourceUnavailable(health)) return null;
  return (
    <Alert variant="warning" className={className}>
      <AlertCircle className="size-4" aria-hidden />
      <AlertTitle>{sourceHealthAlertTitle(health)}</AlertTitle>
      <AlertDescription>{sourceHealthAlertDescription(entity)}</AlertDescription>
    </Alert>
  );
}

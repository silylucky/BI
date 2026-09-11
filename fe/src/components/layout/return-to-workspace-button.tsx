import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/context/workspace-context";
import { cn } from "@/lib/utils";

export function ReturnToWorkspaceButton({ className }: { className?: string }) {
  const { canReturnToWorkspace, returnToWorkspace } = useWorkspace();

  if (!canReturnToWorkspace) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={returnToWorkspace}
      className={cn("hidden h-11 gap-2 px-4 sm:inline-flex", className)}
      aria-label="返回工作台"
    >
      <ArrowLeft className="size-4" aria-hidden />
      返回工作台
    </Button>
  );
}

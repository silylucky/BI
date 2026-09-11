import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GeoMapOverlayTone = "warning" | "error" | "info";

export type GeoMapOverlayHintProps = {
  message: string;
  tone?: GeoMapOverlayTone;
  className?: string;
  onRetry?: () => void;
  retryLabel?: string;
  "data-testid"?: string;
};

const toneClass: Record<GeoMapOverlayTone, string> = {
  warning: "text-warning-700 dark:text-warning-400",
  error: "text-error-600 dark:text-error-400",
  info: "text-gray-500 dark:text-gray-400",
};

/** 地图内轻量浮层提示：不占文档流，贴底居中，与占位 hint 一致 */
export function GeoMapOverlayHint({
  message,
  tone = "warning",
  className,
  onRetry,
  retryLabel = "重试",
  "data-testid": testId,
}: GeoMapOverlayHintProps) {
  if (onRetry) {
    return (
      <div
        role="alert"
        data-testid={testId}
        className={cn(
          "absolute inset-x-2 bottom-2 z-[1] flex flex-col items-center gap-1.5 text-center",
          className,
        )}
      >
        <p className={cn("dw-hint line-clamp-2", toneClass[tone])}>{message}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-theme-xs"
          onClick={onRetry}
          data-testid={testId ? `${testId}-retry` : undefined}
        >
          {retryLabel}
        </Button>
      </div>
    );
  }

  return (
    <p
      role="status"
      data-testid={testId}
      className={cn(
        "dw-hint pointer-events-none absolute inset-x-2 bottom-2 z-[1] line-clamp-2 text-center",
        toneClass[tone],
        className,
      )}
    >
      {message}
    </p>
  );
}

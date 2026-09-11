import { Component, type ErrorInfo, type ReactNode } from "react";
import { localizeApiMessage } from "@/lib/apiError";
import { AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { dwCaption } from "./dashboardWidgetTypography";
import { cn } from "@/lib/utils";

type WidgetErrorBoundaryProps = {
  widgetTitle?: string;
  onRetry?: () => void;
  onDelete?: () => void;
  children: ReactNode;
};

type WidgetErrorBoundaryState = {
  error: Error | null;
};

function formatWidgetErrorMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "未知错误";
  const localized = localizeApiMessage(trimmed);
  if (localized.length <= 120) return localized;
  return `${localized.slice(0, 117)}…`;
}

export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  state: WidgetErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[WidgetErrorBoundary]", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
    this.props.onRetry?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const label = this.props.widgetTitle ? `「${this.props.widgetTitle}」` : "该组件";
    const detail = formatWidgetErrorMessage(error.message || "未知错误");

    return (
      <div
        role="alert"
        data-testid="widget-error-boundary"
        className={cn(
          "flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-lg",
          "border border-error-200/80 bg-error-50/70 px-3 py-3 text-center",
          "dark:border-error-500/25 dark:bg-error-500/[0.08]",
        )}
      >
        <div className="flex size-8 items-center justify-center rounded-full bg-error-100 dark:bg-error-500/15">
          <AlertTriangle className="size-4 text-error-500" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-theme-xs font-medium text-gray-800 dark:text-white/90">
            {label}无法渲染
          </p>
          {error.message ? (
            <HintTooltip label={error.message}>
              <p
                className={cn(
                  "mx-auto max-w-full truncate text-[11px] leading-snug",
                  dwCaption,
                )}
              >
                {detail}
              </p>
            </HintTooltip>
          ) : (
            <p
              className={cn(
                "mx-auto max-w-full break-words text-[11px] leading-snug",
                dwCaption,
              )}
            >
              {detail}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 px-2.5 text-theme-xs"
            onClick={this.handleRetry}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            重试
          </Button>
          {this.props.onDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-7 gap-1 px-2.5 text-theme-xs"
              onClick={this.props.onDelete}
            >
              <Trash2 className="size-3.5" aria-hidden />
              删除
            </Button>
          ) : null}
        </div>
      </div>
    );
  }
}

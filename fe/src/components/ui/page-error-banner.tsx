import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DEFAULT_AUTO_HIDE_MS = 8_000;

export type PageErrorBannerProps = {
  message: string;
  onRetry: () => void;
  /** 关闭或自动消失时通知父级清理错误态 */
  onDismiss?: () => void;
  /** 自动消失毫秒数；0 表示不自动消失 */
  autoHideMs?: number;
  className?: string;
};

/** 页面级错误条：文档流内嵌、实底 Alert，可关闭且默认数秒后自动消失 */
export function PageErrorBanner({
  message,
  onRetry,
  onDismiss,
  autoHideMs = DEFAULT_AUTO_HIDE_MS,
  className,
}: PageErrorBannerProps) {
  const [visible, setVisible] = useState(Boolean(message));
  const dismissedRef = useRef(false);

  useEffect(() => {
    dismissedRef.current = false;
    setVisible(Boolean(message));
  }, [message]);

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setVisible(false);
    onDismiss?.();
  }, [onDismiss]);

  useEffect(() => {
    if (!message || !visible || autoHideMs <= 0) return;
    const timer = window.setTimeout(dismiss, autoHideMs);
    return () => window.clearTimeout(timer);
  }, [message, visible, autoHideMs, dismiss]);

  if (!message || !visible) return null;

  return (
    <Alert
      severity="error"
      appearance="subtle"
      closable
      onClose={dismiss}
      className={cn(
        "border-error-500 bg-white shadow-theme-sm dark:border-error-500/40 dark:bg-gray-900",
        className,
      )}
      action={
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          重试
        </Button>
      }
    >
      <AlertDescription className="text-theme-sm leading-relaxed text-error-700 dark:text-error-400">
        {message}
      </AlertDescription>
    </Alert>
  );
}

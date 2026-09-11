import { AlertCircle, CheckCircle2 } from "lucide-react";
import { localizeApiMessage, messageForErrorCode } from "@/lib/apiError";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TestConnectionResult = {
  ok: boolean;
  message: string;
  latencyMs?: number | null;
  code?: string | null;
  traceId?: string | null;
};

type DatasourceTestStatusProps = {
  error: string | null;
  result: TestConnectionResult | null;
  layout?: "inline" | "card";
};

function extractErrorCode(message: string) {
  const match = message.match(/^\[([A-Z0-9_]+)\]\s*/);
  return match?.[1] ?? null;
}

function stripErrorCode(message: string, code: string | null) {
  let cleaned = message;
  if (code) {
    cleaned = cleaned.replace(new RegExp(`\\[${code}\\]\\s*`, "gi"), "");
  }
  cleaned = cleaned.replace(/\[[A-Z0-9_]+\]\s*/g, "").trim();
  return cleaned;
}

function parseTestFeedback(error: string | null, result: TestConnectionResult | null) {
  const failed = Boolean(error) || (result != null && !result.ok);
  if (!failed) {
    const raw = (result?.message ?? "").trim();
    const message = raw ? localizeApiMessage(raw) : "数据库连接正常";
    return { failed: false, code: result?.code ?? null, message };
  }
  const raw = error ?? result?.message ?? "";
  const code = result?.code ?? extractErrorCode(raw);
  const codeMessage = messageForErrorCode(code);
  const message = codeMessage ?? localizeApiMessage(stripErrorCode(raw, code));
  return { failed: true, code, message };
}

export function DatasourceTestStatus({
  error,
  result,
  layout = "inline",
}: DatasourceTestStatusProps) {
  if (!error && !result) return null;

  const { failed, code, message } = parseTestFeedback(error, result);

  return (
    <div
      role={failed ? "alert" : "status"}
      className={cn(
        layout === "card" ? "rounded-xl border p-5 sm:p-6" : "border-t px-5 py-4",
        failed
          ? "border-error-500/20 bg-error-50/80 dark:border-error-500/20 dark:bg-error-500/10"
          : "border-success-500/20 bg-success-50/80 dark:border-success-500/20 dark:bg-success-500/10",
      )}
    >
      <div className="flex items-start gap-3">
        {failed ? (
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-error-600 dark:text-error-400" />
        ) : (
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success-600 dark:text-success-400" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p
              className={cn(
                "text-theme-sm font-medium",
                failed
                  ? "text-error-700 dark:text-error-400"
                  : "text-success-700 dark:text-success-400",
              )}
            >
              {failed ? "连接测试失败" : "连接测试成功"}
            </p>
            {code ? (
              <Badge variant="light" color={failed ? "error" : "success"} size="sm">
                {code}
              </Badge>
            ) : null}
          </div>
          {message ? (
            <p
              className={cn(
                "mt-1 text-theme-sm break-words",
                failed
                  ? "text-error-700/90 dark:text-error-400/90"
                  : "text-success-700/90 dark:text-success-400/90",
              )}
            >
              {message}
            </p>
          ) : null}
          {result?.ok && result.latencyMs != null ? (
            <p className="mt-2 text-theme-xs text-success-700/80 dark:text-success-400/80">
              响应延迟 {result.latencyMs} ms
            </p>
          ) : null}
          {result?.traceId ? (
            <details className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
              <summary className="cursor-pointer">技术详情</summary>
              <p className="mt-1 break-all font-mono">traceId: {result.traceId}</p>
            </details>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Copy, Link2, X } from "lucide-react";
import { toast } from "sonner";
import { EmbedToolCard, EmbedToolShell } from "@/components/embed/embed-tool-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";
import { buildEmbedShareUrl } from "@/lib/appBasePath";
import { localizeApiMessage, mapApiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";

const ORIGIN_RE = /^https?:\/\/[a-zA-Z0-9.-]+(:\d+)?$/;

export function isOriginAllowed(origin: string, allowed: string[]): boolean {
  if (!allowed.length) return true;
  if (!ORIGIN_RE.test(origin)) return false;
  return allowed.includes(origin);
}

export function EmbedSharePanel() {
  const [chartId, setChartId] = useState("");
  const [originInput, setOriginInput] = useState("");
  const [allowedOrigins, setAllowedOrigins] = useState<string[]>([]);
  const [originError, setOriginError] = useState<string | null>(null);
  const [alertError, setAlertError] = useState<string | null>(null);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  const addOrigin = () => {
    setOriginError(null);
    const trimmed = originInput.trim();
    if (!trimmed) return;
    if (!ORIGIN_RE.test(trimmed)) {
      setOriginError("来源 URL 格式无效，请使用 https://example.com 格式");
      return;
    }
    if (!allowedOrigins.includes(trimmed)) {
      setAllowedOrigins((prev) => [...prev, trimmed]);
    }
    setOriginInput("");
  };

  const removeOrigin = (origin: string) => {
    setAllowedOrigins((prev) => prev.filter((o) => o !== origin));
  };

  const validateAndGenerate = async () => {
    setAlertError(null);
    setEmbedUrl(null);
    if (!chartId.trim()) {
      setAlertError("请填写图表 ID");
      return;
    }
    try {
      await apiFetch("/api/v1/charts/embed/validate", {
        method: "POST",
        body: JSON.stringify({
          chartId: chartId.trim(),
          allowedOrigins,
        }),
      });
      const tokenResp = await apiFetch<{
        token: string;
        embedUrl: string;
      }>("/api/v1/embed/token", {
        method: "POST",
        body: JSON.stringify({
          chartId: chartId.trim(),
          allowedOrigins,
        }),
      });
      const url = buildEmbedShareUrl(tokenResp.embedUrl);
      setEmbedUrl(url);
    } catch (e) {
      const err = e as Error & { code?: string; fields?: Array<{ message: string }> };
      if (err.fields?.length) {
        setAlertError(err.fields.map((f) => localizeApiMessage(f.message)).join("；"));
      } else {
        setAlertError(mapApiError(e));
      }
    }
  };

  const copyEmbedUrl = async () => {
    if (!embedUrl) return;
    await navigator.clipboard.writeText(embedUrl);
    toast.success("已复制嵌入链接");
  };

  const iframeSrc = useMemo(() => embedUrl, [embedUrl]);

  return (
    <EmbedToolShell
      title="嵌入分享"
      description="配置图表 ID 与允许嵌入的来源域名，生成可在外部站点 iframe 引用的链接。"
      backHref="/admin/dashboards"
      backLabel="取消"
    >
      <EmbedToolCard
        title="嵌入配置"
        description="未配置来源时，仅允许本地开发域名访问。"
      >
        <div className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="chart-id">图表 ID</Label>
            <Input
              id="chart-id"
              className="h-11"
              value={chartId}
              onChange={(e) => setChartId(e.target.value)}
              placeholder="00000000-0000-4000-8000-000000000001"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="origin-input">允许的来源 Origin</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="origin-input"
                className="h-11"
                value={originInput}
                onChange={(e) => setOriginInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addOrigin();
                  }
                }}
                placeholder="https://example.com"
                fieldState={originError ? "error" : "default"}
              />
              <Button type="button" variant="outline" className="h-11 shrink-0 sm:px-6" onClick={addOrigin}>
                添加
              </Button>
            </div>
            {originError ? (
              <p className="text-theme-xs text-error-600 dark:text-error-400">{originError}</p>
            ) : (
              <p className="text-theme-xs text-gray-500 dark:text-gray-400">
                仅允许列出的域名通过 iframe 加载图表；留空则使用默认开发域名。
              </p>
            )}
          </div>

          {allowedOrigins.length > 0 ? (
            <ul className="flex flex-wrap gap-2" aria-label="已添加的来源">
              {allowedOrigins.map((o) => (
                <li key={o}>
                  <Badge
                    variant="light"
                    color="primary"
                    size="sm"
                    className="gap-1 pr-1 font-mono text-theme-xs"
                  >
                    <TruncateHint title={o} className="max-w-[200px] font-mono text-theme-xs">
                      {o}
                    </TruncateHint>
                    <button
                      type="button"
                      className={cn(
                        "rounded p-0.5 text-brand-500 hover:bg-brand-100 dark:hover:bg-brand-500/20",
                        "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
                      )}
                      aria-label={`移除 ${o}`}
                      onClick={() => removeOrigin(o)}
                    >
                      <X className="size-3" aria-hidden />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          ) : null}

          {alertError ? (
            <Alert severity="error">
              <AlertDescription>{alertError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-100 pt-5 dark:border-gray-800">
            <Button type="button" variant="outline" asChild>
              <Link to="/admin/dashboards">取消</Link>
            </Button>
            <Button type="button" variant="primary" onClick={() => void validateAndGenerate()}>
              校验并生成链接
            </Button>
          </div>
        </div>
      </EmbedToolCard>

      {embedUrl ? (
        <EmbedToolCard title="嵌入链接" description="复制链接或在下方的预览中检查展示效果。">
          <div className="space-y-4">
            <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-white/[0.02]">
              <Link2 className="mt-0.5 size-4 shrink-0 text-brand-500" aria-hidden />
              <p className="min-w-0 flex-1 break-all font-mono text-theme-xs text-gray-700 dark:text-gray-300">
                {embedUrl}
              </p>
              <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => void copyEmbedUrl()}>
                <Copy className="size-4" aria-hidden />
                复制
              </Button>
            </div>
            {iframeSrc ? (
              <iframe
                src={iframeSrc}
                title="嵌入图表预览"
                sandbox="allow-scripts"
                className="h-[300px] w-full rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
              />
            ) : null}
          </div>
        </EmbedToolCard>
      ) : null}
    </EmbedToolShell>
  );
}

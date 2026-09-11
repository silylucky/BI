import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { ChartRenderer } from "@/components/charts/ChartRenderer";
import { ChartDrillProvider } from "@/components/charts/ChartDrillContext";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import { isGeoMapChartType } from "@/lib/chartViewConfig";
import { localizeApiMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { isEmbedPageAuthorized } from "./embedAccess";

export function EmbedChartPage() {
  const { chartId } = useParams<{ chartId: string }>();
  const [searchParams] = useSearchParams();
  const parentOrigin = window.location.origin;
  const embedToken = searchParams.get("token");

  const theme = searchParams.get("theme") === "dark" ? "dark" : "light";
  const authorized = isEmbedPageAuthorized(searchParams, parentOrigin, Boolean(embedToken));

  const [config, setConfig] = useState<ChartViewConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(chartId && embedToken));

  useEffect(() => {
    if (!chartId) {
      setConfig(null);
      setLoadError(null);
      setLoading(false);
      return;
    }
    if (!embedToken) {
      setConfig(null);
      setLoadError("缺少嵌入令牌，请通过分享页签发链接");
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    const qs = new URLSearchParams({ token: embedToken, chartId });
    void fetch(`/api/v1/embed/chart-view?${qs.toString()}`)
      .then(async (resp) => {
        const body = (await resp.json().catch(() => ({}))) as {
          message?: string;
          chartType?: string;
        };
        if (!resp.ok) {
          throw new Error(localizeApiMessage(body.message || "加载图表配置失败"));
        }
        return body as ChartViewConfig;
      })
      .then((data) => {
        if (cancelled) return;
        setConfig(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setConfig(null);
        setLoadError(err instanceof Error ? localizeApiMessage(err.message) : "加载图表配置失败");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chartId, embedToken]);

  if (!authorized) {
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
      >
        <p className="text-theme-lg font-medium text-error-700 dark:text-error-400">
          当前来源未授权嵌入
        </p>
        <p className="text-theme-sm text-gray-500">来源：{parentOrigin}</p>
      </div>
    );
  }

  if (!chartId) {
    return (
      <div role="alert" className="p-6 text-theme-sm text-error-600">
        缺少图表 ID
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-6 text-theme-sm text-gray-500">
        正在加载图表…
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div role="alert" className="flex min-h-[240px] flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-theme-sm text-error-600">{loadError ?? "无法加载图表"}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
          重试
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex h-dvh min-h-[360px] w-full flex-col",
        theme === "dark" ? "dark bg-gray-950" : "bg-white",
      )}
      data-embed-chart
    >
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <ChartDrillProvider>
          <div className="relative min-h-0 flex-1">
            <ChartRenderer
              config={config}
              title="嵌入图表"
              embedded
              colorScheme={theme}
              widgetId={chartId}
              drillEnabled={isGeoMapChartType(config.chartType)}
              pixelSize={{ width: 960, height: 540 }}
            />
          </div>
        </ChartDrillProvider>
      </div>
    </div>
  );
}

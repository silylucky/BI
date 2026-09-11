import { useRef, useState } from "react";
import { Link } from "react-router";
import { Monitor } from "lucide-react";
import { EmbedToolCard, EmbedToolShell } from "@/components/embed/embed-tool-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { destroy, init, resize, type EmbedSdkHandle } from "@/sdk/embedSdk";

export function EmbedSdkDemoPage() {
  const [chartId, setChartId] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handleRef = useRef<EmbedSdkHandle | null>(null);

  const issueToken = async () => {
    setError(null);
    try {
      const data = await apiFetch<{ token: string }>("/api/v1/embed/token", {
        method: "POST",
        body: JSON.stringify({ chartId: chartId.trim() }),
      });
      setToken(data.token);
    } catch {
      setError("签发嵌入令牌失败，请检查图表 ID");
    }
  };

  const runInit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (handleRef.current) destroy(handleRef.current);
      handleRef.current = await init({
        container: "#embed-host",
        token: token.trim(),
        targetType: "chart",
        targetId: chartId.trim(),
        onError: (msg) => setError(msg),
      });
    } catch {
      setError("初始化嵌入失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <EmbedToolShell
      title="SDK 嵌入演示"
      description="开发环境下调试 VitalSpan 图表 SDK 的初始化、销毁与尺寸调整。"
      backHref="/admin/dashboards"
      backLabel="取消"
    >
      <EmbedToolCard title="连接参数" description="先模拟签发令牌，再初始化嵌入实例。">
        <div className="space-y-5">
          <div className="grid gap-2">
            <Label htmlFor="demo-chart-id">图表 ID</Label>
            <Input
              id="demo-chart-id"
              className="h-11"
              value={chartId}
              onChange={(e) => setChartId(e.target.value)}
              placeholder="00000000-0000-4000-8000-000000000001"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="demo-token">嵌入令牌</Label>
            <Input
              id="demo-token"
              type="password"
              className="h-11"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="点击「模拟签发」获取"
            />
          </div>

          {error ? (
            <Alert severity="error">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-5 dark:border-gray-800">
            <Button type="button" variant="outline" size="sm" onClick={() => void issueToken()}>
              模拟签发
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={loading || !chartId || !token}
              onClick={() => void runInit()}
            >
              {loading ? "初始化中…" : "初始化嵌入"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRef.current && destroy(handleRef.current)}
            >
              销毁嵌入
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleRef.current && resize(handleRef.current, 360, 320)}
            >
              调整尺寸
            </Button>
            <Button type="button" variant="outline" size="sm" className="ml-auto" asChild>
              <Link to="/admin/dashboards">取消</Link>
            </Button>
          </div>
        </div>
      </EmbedToolCard>

      <EmbedToolCard title="渲染容器" description="SDK 将在此区域挂载图表。">
        <div
          id="embed-host"
          className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 dark:border-gray-800 dark:bg-white/[0.02]"
        >
          <p className="flex items-center gap-2 text-theme-sm text-gray-500 dark:text-gray-400">
            <Monitor className="size-4" aria-hidden />
            初始化后图表将显示于此
          </p>
        </div>
      </EmbedToolCard>
    </EmbedToolShell>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChartInspector } from "./chartInspectorContext";
import {
  INSPECTOR_CTRL,
  INSPECTOR_SECTION_GAP,
  InspectorFieldLabel,
} from "./inspectorCompact";
import { readGisProject, writeGisProject } from "@/components/charts/engine/maplibre/gisProject";
import { withDevPmtilesArchiveUrl } from "@/components/charts/engine/maplibre/gisPmtilesUrl";
import { probeTileServiceBasemapAssets } from "@/lib/tileServiceAssetsHealth";
import { listTileServices, resolveTileService } from "@/lib/tileServices";
import { cn } from "@/lib/utils";

const TILE_SERVICE_HINT =
  "全球底图由运维登记的外部 PMTiles 服务提供；此处选择平台已登记的服务并连接，地址由平台解析接口返回，不可手写 URL。";

function tileServiceResolvePath(serviceId: string): string {
  return `/api/v1/tile-services/${encodeURIComponent(serviceId)}/resolve`;
}

function TileServiceEndpointRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-[9px] text-gray-400 dark:text-gray-500">{label}</span>
      <code className="block truncate rounded bg-black/5 px-1 py-0.5 font-mono text-[9px] text-gray-700 dark:bg-white/5 dark:text-gray-300">
        {value}
      </code>
    </div>
  );
}

/** GIS 地图 · 数据 Tab：连接全球 PMTiles 底图服务（须显式选择，不自动预选） */
export function ChartGisMapTileServiceSetup() {
  const { cfg, mutateChartConfig } = useChartInspector();
  const project = readGisProject(cfg);
  const connectedId = project.tileServiceId?.trim() || "";
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingId, setPendingId] = useState("");

  const {
    data: tileServices = [],
    isError: tileServicesError,
    isLoading: tileServicesLoading,
  } = useQuery({
    queryKey: ["tile-services"],
    queryFn: listTileServices,
    retry: false,
  });

  const enabledTileServices = tileServices.filter((service) => service.enabled);
  const connectedService = enabledTileServices.find((service) => service.id === connectedId);

  const {
    data: connectedResolve,
    isLoading: connectedResolveLoading,
    isError: connectedResolveError,
  } = useQuery({
    queryKey: ["tile-services", connectedId, "resolve"],
    queryFn: () => resolveTileService(connectedId),
    enabled: Boolean(connectedId) && !pickerOpen,
    retry: false,
  });

  const { data: pendingResolve, isLoading: pendingResolveLoading } = useQuery({
    queryKey: ["tile-services", pendingId, "resolve-preview"],
    queryFn: () => resolveTileService(pendingId),
    enabled: Boolean(pendingId) && pickerOpen,
    retry: false,
  });

  const {
    data: assetsProbe,
    isLoading: assetsProbeLoading,
    isError: assetsProbeError,
  } = useQuery({
    queryKey: [
      "tile-services",
      connectedId,
      "assets-probe",
      connectedResolve?.glyphsUrl,
      connectedResolve?.spriteUrl,
    ],
    queryFn: () => probeTileServiceBasemapAssets(withDevPmtilesArchiveUrl(connectedResolve!)),
    enabled: Boolean(connectedResolve) && !pickerOpen,
    retry: false,
  });

  const assetsUnavailable = assetsProbeError || assetsProbe?.ok === false;
  const showConnectedSuccess = assetsProbe?.ok === true;

  const patchTileServiceId = (tileServiceId: string | undefined) => {
    mutateChartConfig((current) => writeGisProject(current, { tileServiceId }));
    setPickerOpen(false);
    setPendingId("");
  };

  const connectPending = () => {
    if (!pendingId) return;
    patchTileServiceId(pendingId);
  };

  return (
    <div
      className={cn("rounded-lg border border-gray-200 p-2 dark:border-gray-800", INSPECTOR_SECTION_GAP)}
      data-testid="chart-gis-map-tile-service-setup"
    >
      <div className="space-y-1">
        <InspectorFieldLabel label="全球底图服务" hint={TILE_SERVICE_HINT} />
        <p className="text-[10px] leading-snug text-gray-500 dark:text-gray-400">{TILE_SERVICE_HINT}</p>
      </div>

      {tileServicesLoading ? (
        <p className="text-[10px] text-gray-400">正在加载已登记服务…</p>
      ) : tileServicesError ? (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          无法加载服务列表，请确认已登录且后端可用。
        </p>
      ) : enabledTileServices.length === 0 ? (
        <p className="text-[10px] text-amber-600 dark:text-amber-400">
          平台尚未登记 PMTiles 服务，请联系管理员完成部署与登记后再连接。
        </p>
      ) : connectedService && !pickerOpen ? (
        <div
          className={cn(
            "space-y-2 rounded-md border px-2 py-1.5",
            showConnectedSuccess
              ? "border-success-500/25 bg-success-500/5"
              : "border-amber-500/30 bg-amber-500/5",
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-start gap-1.5">
              {showConnectedSuccess ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success-600 dark:text-success-400" />
              ) : (
                <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-[10px] font-medium",
                    showConnectedSuccess
                      ? "text-success-800 dark:text-success-300"
                      : "text-amber-800 dark:text-amber-300",
                  )}
                >
                  {connectedResolveLoading
                    ? "正在解析服务地址…"
                    : assetsProbeLoading
                      ? "正在探测标注资源…"
                      : assetsUnavailable
                        ? "服务已登记，标注资源不可用"
                        : showConnectedSuccess
                          ? "已连接"
                          : "已登记瓦片服务"}
                </p>
                <p className="truncate text-[10px] text-gray-600 dark:text-gray-300">{connectedService.name}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px]"
                onClick={() => {
                  setPendingId(connectedId);
                  setPickerOpen(true);
                }}
              >
                切换服务
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-1.5 text-[10px] text-gray-500"
                aria-label="断开全球底图服务"
                onClick={() => patchTileServiceId(undefined)}
              >
                <Unlink className="size-3" />
              </Button>
            </div>
          </div>
          <TileServiceEndpointRow label="服务 ID" value={connectedId} />
          <TileServiceEndpointRow label="解析接口" value={tileServiceResolvePath(connectedId)} />
          {connectedResolveLoading ? (
            <p className="text-[10px] text-gray-400">正在解析服务地址…</p>
          ) : connectedResolveError ? (
            <p className="text-[10px] text-amber-600 dark:text-amber-400">
              服务地址解析失败，请确认登记配置或联系管理员。
            </p>
          ) : connectedResolve ? (
            <>
              <TileServiceEndpointRow label="PMTiles 地址" value={connectedResolve.pmtilesUrl} />
              {assetsUnavailable ? (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  同机 /basemaps-assets 字体或图标探测失败，绿标仅在瓦片与标注资源都可用时显示。
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <Select value={pendingId} onValueChange={setPendingId}>
            <SelectTrigger className={INSPECTOR_CTRL} aria-label="选择全球 PMTiles 服务">
              <SelectValue placeholder="选择已登记的全球底图服务" />
            </SelectTrigger>
            <SelectContent>
              {enabledTileServices.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.name}（{service.id}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pendingId ? (
            <div className="space-y-1 rounded-md border border-dashed border-gray-200 p-1.5 dark:border-gray-700">
              <TileServiceEndpointRow label="解析接口" value={tileServiceResolvePath(pendingId)} />
              {pendingResolveLoading ? (
                <p className="text-[10px] text-gray-400">正在预览服务地址…</p>
              ) : pendingResolve ? (
                <TileServiceEndpointRow label="PMTiles 地址" value={pendingResolve.pmtilesUrl} />
              ) : null}
            </div>
          ) : null}
          <div className="flex gap-2">
            {pickerOpen ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 flex-1 text-[10px]"
                onClick={() => {
                  setPickerOpen(false);
                  setPendingId("");
                }}
              >
                取消
              </Button>
            ) : null}
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="h-7 flex-1 text-[10px]"
              disabled={!pendingId || pendingResolveLoading}
              onClick={connectPending}
            >
              <Link2 className="mr-1 size-3" />
              连接服务
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

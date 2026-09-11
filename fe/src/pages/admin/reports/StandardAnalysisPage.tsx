import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Settings2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AdminPageShell, AdminPageHeaderIcon } from "@/components/layout/admin-page-shell";
import { ListPageSection } from "@/components/layout/list-page-kit";
import { Button } from "@/components/ui/button";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { ListGhostEmptyState } from "@/components/ui/panel-empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { matchesCapability, resolveEffectiveCapabilities } from "@/lib/capabilities";
import { mapApiError } from "@/lib/apiError";
import { useAuth } from "@/context/auth-context";
import { ReportCenterBackLink } from "./components/ReportCenterBackLink";
import { StandardAnalysisPackList } from "./components/StandardAnalysisPackList";
import { StandardAnalysisResultPanel } from "./components/StandardAnalysisResultPanel";
import { STANDARD_WORKBENCH_GRID_CLASS } from "./components/standardAnalysisUi";
import { isAnalysisTheme, readStoredTheme, writeStoredTheme } from "./standardAnalysisPrefs";
import { livePeriodKeyFromPreset } from "./components/standardAnalysisCompareUi";
import {
  COMPARE_AUTO_BASELINE,
  COMPARE_LIVE_VALUE,
  defaultMatrixPeriodKeys,
  readCompareLayout,
  readMatrixPeriodKeys,
  writeCompareLayout,
  writeMatrixPeriodKeys,
  type CompareLayout,
} from "./standardAnalysisComparePrefs";
import {
  type AnalysisTheme,
  isThemeAvailable,
  resolveFirstAvailableTheme,
  useCaptureStandardSnapshot,
  useStandardCapabilities,
  useStandardCompare,
  useStandardCompareMatrix,
  useStandardPacks,
  useStandardRun,
  useStandardSnapshots,
} from "./useStandardAnalysis";
import {
  STANDARD_PACK_QUERY,
  STANDARD_THEME_QUERY,
  standardAnalysisConfigPath,
} from "./standardRoutes";
import { groupStandardSchedulesByPackKey } from "./standardAnalysisDeliverySummary";
import { useReportSchedulesList } from "./useReportSchedules";

export function StandardAnalysisPage() {
  const { user } = useAuth();
  const caps = resolveEffectiveCapabilities(user);
  const canManage = matchesCapability(caps, "report:manage");
  const [searchParams, setSearchParams] = useSearchParams();
  const packsQuery = useStandardPacks();
  const packs = packsQuery.data?.items ?? [];
  const standardSchedulesQuery = useReportSchedulesList({ sourceType: "standard" });
  const deliveryByPackKey = useMemo(
    () => groupStandardSchedulesByPackKey(standardSchedulesQuery.data?.items),
    [standardSchedulesQuery.data?.items],
  );
  const packFromUrl = searchParams.get(STANDARD_PACK_QUERY);
  const [selectedPackKey, setSelectedPackKey] = useState<string | null>(packFromUrl);
  const [selectedTheme, setSelectedTheme] = useState<AnalysisTheme | null>(null);
  const [viewMode, setViewMode] = useState<"live" | "compare">("live");
  const [compareLayout, setCompareLayout] = useState<CompareLayout>("pair");
  const [currentPeriodValue, setCurrentPeriodValue] = useState(COMPARE_LIVE_VALUE);
  const [baselinePeriodValue, setBaselinePeriodValue] = useState(COMPARE_AUTO_BASELINE);
  const [matrixPeriodKeys, setMatrixPeriodKeys] = useState<string[]>([]);

  useEffect(() => {
    if (packFromUrl) {
      setSelectedPackKey(packFromUrl);
    }
  }, [packFromUrl]);

  const activePack = useMemo(
    () => packs.find((p) => p.packKey === selectedPackKey) ?? packs[0] ?? null,
    [packs, selectedPackKey],
  );

  const capabilitiesQuery = useStandardCapabilities(activePack?.packKey ?? null);
  const themeCapabilities = capabilitiesQuery.data?.themes;

  const themeFromUrl = searchParams.get(STANDARD_THEME_QUERY);

  useEffect(() => {
    if (!activePack) return;

    setSelectedTheme((current) => {
      if (
        current &&
        activePack.enabledThemes.includes(current) &&
        isThemeAvailable(current, themeCapabilities)
      ) {
        return current;
      }

      if (
        isAnalysisTheme(themeFromUrl) &&
        activePack.enabledThemes.includes(themeFromUrl) &&
        isThemeAvailable(themeFromUrl, themeCapabilities)
      ) {
        return themeFromUrl;
      }

      const stored = readStoredTheme(activePack.packKey);
      if (
        stored &&
        activePack.enabledThemes.includes(stored) &&
        isThemeAvailable(stored, themeCapabilities)
      ) {
        return stored;
      }

      return resolveFirstAvailableTheme(activePack, themeCapabilities);
    });
  }, [activePack, themeCapabilities, themeFromUrl]);

  const activeTheme = selectedTheme ?? resolveFirstAvailableTheme(activePack, themeCapabilities);

  const livePeriodKey = useMemo(
    () => (activePack ? livePeriodKeyFromPreset(activePack.snapshotCronPreset) : ""),
    [activePack],
  );

  const compareOptions = useMemo(
    () => ({
      baselinePeriodKey:
        baselinePeriodValue !== COMPARE_AUTO_BASELINE ? baselinePeriodValue : undefined,
      currentPeriodKey: currentPeriodValue !== COMPARE_LIVE_VALUE ? currentPeriodValue : undefined,
    }),
    [baselinePeriodValue, currentPeriodValue],
  );

  useEffect(() => {
    if (!activePack) return;
    setCompareLayout(readCompareLayout(activePack.packKey));
  }, [activePack?.packKey]);

  const runQuery = useStandardRun(viewMode === "live" ? activePack?.packKey ?? null : null, activeTheme);
  const snapshotsQuery = useStandardSnapshots(activePack?.packKey ?? null, activeTheme);

  useEffect(() => {
    if (!activePack || !activeTheme) return;
    const stored = readMatrixPeriodKeys(activePack.packKey, activeTheme);
    setMatrixPeriodKeys(
      stored.length >= 2
        ? stored
        : defaultMatrixPeriodKeys(snapshotsQuery.data?.items, activeTheme, livePeriodKey),
    );
    setCurrentPeriodValue(COMPARE_LIVE_VALUE);
    setBaselinePeriodValue(COMPARE_AUTO_BASELINE);
  }, [activePack?.packKey, activeTheme, livePeriodKey, snapshotsQuery.data?.items]);

  const compareQuery = useStandardCompare(
    viewMode === "compare" && compareLayout === "pair" ? activePack?.packKey ?? null : null,
    activeTheme,
    compareOptions,
  );
  const matrixQuery = useStandardCompareMatrix(
    viewMode === "compare" && compareLayout === "matrix" ? activePack?.packKey ?? null : null,
    activeTheme,
    matrixPeriodKeys,
  );
  const captureSnapshot = useCaptureStandardSnapshot();

  const handleCaptureCurrent = () => {
    if (!activePack || !activeTheme) return;
    captureSnapshot.mutate(
      { packKey: activePack.packKey, theme: activeTheme },
      {
        onSuccess: (saved) => {
          toast.success(`本期快照已保存（${saved.periodKey}）`);
        },
        onError: (err) => {
          toast.error(mapApiError(err));
        },
      },
    );
  };

  const handleCapturePreviousBaseline = () => {
    if (!activePack || !activeTheme) return;
    const targetPeriodKey =
      baselinePeriodValue !== COMPARE_AUTO_BASELINE
        ? baselinePeriodValue
        : compareQuery.data?.previousPeriodKey;
    if (!targetPeriodKey) {
      toast.error("无法确定对比周期，请先选择对比期");
      return;
    }
    captureSnapshot.mutate(
      { packKey: activePack.packKey, theme: activeTheme, periodKey: targetPeriodKey },
      {
        onSuccess: (saved) => {
          toast.success(`上期基准快照已保存（${saved.periodKey}），正在刷新对比结果…`);
        },
        onError: (err) => {
          toast.error(mapApiError(err));
        },
      },
    );
  };

  const handleCompareLayoutChange = (layout: CompareLayout) => {
    setCompareLayout(layout);
    if (activePack) writeCompareLayout(activePack.packKey, layout);
  };

  const handleMatrixPeriodKeysChange = (keys: string[]) => {
    setMatrixPeriodKeys(keys);
    if (activePack && activeTheme) {
      writeMatrixPeriodKeys(activePack.packKey, activeTheme, keys);
    }
  };

  const selectPack = (key: string) => {
    setSelectedPackKey(key);
    setSelectedTheme(null);
    const params = new URLSearchParams(searchParams);
    params.set(STANDARD_PACK_QUERY, key);
    params.delete(STANDARD_THEME_QUERY);
    setSearchParams(params, { replace: true });
  };

  const handleThemeChange = (theme: AnalysisTheme) => {
    setSelectedTheme(theme);
    if (activePack) {
      writeStoredTheme(activePack.packKey, theme);
    }
    const params = new URLSearchParams(searchParams);
    if (activePack) params.set(STANDARD_PACK_QUERY, activePack.packKey);
    params.set(STANDARD_THEME_QUERY, theme);
    setSearchParams(params, { replace: true });
  };

  return (
    <AdminPageShell
      layout="list"
      icon={
        <AdminPageHeaderIcon>
          <TrendingUp className="size-6" aria-hidden />
        </AdminPageHeaderIcon>
      }
      title="标准分析"
      description="查看分析结果并与上期快照对比；管理员可点击右上角「管理分析包」配置数据集与快照。"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <ReportCenterBackLink />
          {canManage ? (
            <Button variant="primary" size="sm" asChild>
              <Link to={standardAnalysisConfigPath(activePack?.packKey)}>
                <Settings2 className="size-4" aria-hidden />
                管理分析包
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      {packs.length === 0 && !packsQuery.isLoading ? (
        <ListGhostEmptyState
          title="暂无分析包"
          description={canManage ? "前往配置页创建第一个标准分析包。" : "请联系管理员配置标准分析包。"}
          action={
            canManage ? (
              <Button size="sm" asChild>
                <Link to={standardAnalysisConfigPath()}>去配置</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ListPageSection className="min-h-0 flex-1">
          {packsQuery.isError ? (
            <div className="shrink-0 border-b border-gray-100 px-5 py-3 dark:border-white/[0.06]">
              <PageErrorBanner message={mapApiError(packsQuery.error)} onRetry={() => packsQuery.refetch()} />
            </div>
          ) : null}

          <div className="border-b border-gray-200 px-4 py-3 xl:hidden dark:border-gray-800">
            <Select value={activePack?.packKey ?? ""} onValueChange={selectPack}>
              <SelectTrigger aria-label="选择分析包" className="h-11">
                <SelectValue placeholder="选择分析包" />
              </SelectTrigger>
              <SelectContent>
                {packs.map((pack) => (
                  <SelectItem key={pack.packKey} value={pack.packKey}>
                    {pack.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className={STANDARD_WORKBENCH_GRID_CLASS}>
            <div className="hidden min-h-0 min-w-0 overflow-hidden xl:flex">
              <StandardAnalysisPackList
                packs={packs}
                activePackKey={activePack?.packKey ?? null}
                isLoading={packsQuery.isLoading}
                onSelect={selectPack}
                deliveryByPackKey={deliveryByPackKey}
              />
            </div>
            {activePack && activeTheme ? (
              <StandardAnalysisResultPanel
                pack={activePack}
                activeTheme={activeTheme}
                viewMode={viewMode}
                canManage={canManage}
                capturePending={captureSnapshot.isPending}
                onCaptureCurrent={handleCaptureCurrent}
                onCapturePreviousBaseline={handleCapturePreviousBaseline}
                compareLayout={compareLayout}
                onCompareLayoutChange={handleCompareLayoutChange}
                livePeriodKey={livePeriodKey}
                currentPeriodValue={currentPeriodValue}
                baselinePeriodValue={baselinePeriodValue}
                matrixPeriodKeys={matrixPeriodKeys}
                onCurrentPeriodChange={setCurrentPeriodValue}
                onBaselinePeriodChange={setBaselinePeriodValue}
                onMatrixPeriodKeysChange={handleMatrixPeriodKeysChange}
                matrixQuery={matrixQuery}
                onThemeChange={handleThemeChange}
                onViewModeChange={setViewMode}
                runQuery={runQuery}
                compareQuery={compareQuery}
                snapshots={snapshotsQuery.data?.items}
                themeCapabilities={themeCapabilities}
                mapError={mapApiError}
              />
            ) : null}
          </div>
        </ListPageSection>
      )}
    </AdminPageShell>
  );
}

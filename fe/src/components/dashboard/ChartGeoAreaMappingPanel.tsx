import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { analyzeGeoMapMatch } from "@/components/charts/engine/geo/geoMapChart";
import { useChartExecute } from "@/components/charts/useChartExecute";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  patchChartDeStyleNested,
  readChartDeStyle,
  readChartGeoStyle,
} from "@/lib/chartDeStyle";
import {
  buildAreaMappingLookup,
  countEffectiveAreaMappings,
} from "@/lib/chartGeoAreaMapping";
import {
  autoSuggestAreaMappingEntries,
  buildGeoAreaMappingViewRows,
  listDistinctRegionFieldValues,
  mergeAreaMappingAttribute,
  paginateMapRegions,
} from "@/lib/geoAreaMappingTable";
import { listUnmatchedGeoRegionValues } from "@/lib/geoAreaMappingFromData";
import { isChartExecuteReady } from "@/lib/chartExecuteProbe";
import { listOfflineProvinceNames } from "@/lib/geoMapLevels";
import { cn } from "@/lib/utils";
import { randomId } from "@/lib/randomId";
import { useChartInspector } from "./chartInspectorContext";
import {
  INSPECTOR_CTRL,
  INSPECTOR_HINT,
  INSPECTOR_SECTION_GAP,
  InspectorSubtleEmpty,
} from "./inspectorCompact";

const MAP_REGIONS = listOfflineProvinceNames();

function newMappingId(): string {
  return randomId();
}

function MappingPagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 px-2 py-1.5">
      {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
        <Button
          key={pageNumber}
          type="button"
          variant={pageNumber === page ? "primary" : "outline"}
          size="sm"
          className="h-7 min-w-7 px-2 text-[10px]"
          onClick={() => onPageChange(pageNumber)}
        >
          {pageNumber}
        </Button>
      ))}
    </div>
  );
}

/** 2D/3D 区域地图 · 高级「地名映射」（对标 DataEase：图形=地图区域，属性=业务取值） */
export function ChartAdvancedMapAreaMappingSection() {
  const { cfg, onChange } = useChartInspector();
  const geo = readChartGeoStyle(readChartDeStyle(cfg));
  const entries = geo.areaMapping ?? [];
  const regionField = cfg.dimensions?.[0]?.field ?? "";
  const executeReady = isChartExecuteReady(cfg);
  const [page, setPage] = useState(1);
  const autoAppliedRef = useRef<string | null>(null);

  const { columns, rows, loading, error } = useChartExecute(cfg, { enabled: executeReady });

  const patchEntries = (next: typeof entries) =>
    onChange(patchChartDeStyleNested(cfg, "geo", { areaMapping: next }));

  const lookup = useMemo(() => buildAreaMappingLookup(entries), [entries]);

  const distinctValues = useMemo(() => {
    if (!regionField || !rows.length) return [];
    return listDistinctRegionFieldValues(rows, columns, regionField);
  }, [regionField, rows, columns]);

  const { pageRegions, totalPages, safePage } = useMemo(
    () => paginateMapRegions(MAP_REGIONS, page),
    [page],
  );

  useEffect(() => {
    if (safePage !== page) setPage(safePage);
  }, [safePage, page]);

  const viewRows = useMemo(
    () =>
      buildGeoAreaMappingViewRows(
        pageRegions,
        distinctValues,
        entries,
        regionField,
        lookup,
      ),
    [pageRegions, distinctValues, entries, regionField, lookup],
  );

  const matchStats = useMemo(() => {
    if (!regionField || !rows.length || columns.indexOf(regionField) < 0) return null;
    return analyzeGeoMapMatch(rows, columns, regionField, undefined, 0, lookup);
  }, [regionField, rows, columns, lookup]);

  const unmatchedValues = useMemo(() => {
    if (!regionField || !rows.length) return [];
    return listUnmatchedGeoRegionValues(rows, columns, regionField, lookup);
  }, [regionField, rows, columns, lookup]);

  const autoKey = `${regionField}:${rows.length}:${distinctValues.join("\0")}`;

  useEffect(() => {
    if (!executeReady || loading || !regionField || rows.length === 0) return;
    if (countEffectiveAreaMappings(entries) > 0) return;
    if (autoAppliedRef.current === autoKey) return;

    const suggested = autoSuggestAreaMappingEntries(
      MAP_REGIONS,
      distinctValues,
      regionField,
      entries,
      newMappingId,
    );
    autoAppliedRef.current = autoKey;
    if (suggested.length > 0) {
      patchEntries(suggested);
    }
  }, [autoKey, executeReady, loading, regionField, rows.length, distinctValues, entries]);

  const handleResyncFromData = () => {
    if (!regionField || distinctValues.length === 0) return;
    const suggested = autoSuggestAreaMappingEntries(
      MAP_REGIONS,
      distinctValues,
      regionField,
      [],
      newMappingId,
    );
    patchEntries(suggested);
  };

  return (
    <div className={INSPECTOR_SECTION_GAP}>
      <div className="flex items-start justify-between gap-2 rounded-md border border-gray-200 bg-gray-50/80 px-2 py-1.5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className={cn(INSPECTOR_HINT, "min-w-0 flex-1 pt-0.5")}>
          {!regionField
            ? "请先在数据 Tab 绑定地理维度字段"
            : loading
              ? "正在加载预览数据…"
              : error
                ? "预览数据不可用，仍可手动编辑映射"
                : matchStats
                  ? matchStats.total > 0
                    ? (
                        <>
                          已匹配 {matchStats.matched}/{matchStats.total} 条
                          {unmatchedValues.length > 0 ? (
                            <span className="text-amber-600 dark:text-amber-500">
                              {" "}
                              · {unmatchedValues.length} 个取值未匹配
                            </span>
                          ) : null}
                        </>
                      )
                    : "当前数据为空"
                  : executeReady
                    ? "等待预览数据"
                    : "配置数据源后可自动匹配"}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-[10px]"
          disabled={!regionField || loading || distinctValues.length === 0}
          onClick={handleResyncFromData}
        >
          <RefreshCw className="mr-1 size-3" aria-hidden />
          重新匹配
        </Button>
      </div>

      <p className={INSPECTOR_HINT}>
        对标 DataEase：左侧为离线地图标准区域（图形），右侧填写业务维度取值（属性）。配置数据后将自动按同名与
        join 规则建议匹配。
      </p>

      {!regionField ? (
        <InspectorSubtleEmpty message="绑定地理维度并配置数据源后，将自动列出省级区域并尝试匹配。" />
      ) : (
        <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-800">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-1.5 border-b border-gray-200 bg-gray-50/90 px-2 py-1.5 text-[10px] font-medium text-gray-500 dark:border-gray-800 dark:bg-white/[0.04] dark:text-gray-400">
            <span>图形</span>
            <span>属性</span>
          </div>
          {viewRows.map((row) => (
            <div
              key={row.mapRegion}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-center gap-1.5 border-b border-gray-100 px-2 py-1 last:border-b-0 dark:border-gray-800/80"
            >
              <span className="truncate text-[11px] text-gray-700 dark:text-gray-300">
                {row.mapRegion}
              </span>
              <Input
                className={cn(INSPECTOR_CTRL, "min-w-0")}
                value={row.dataValue}
                placeholder="业务取值"
                aria-label={`${row.mapRegion} 属性`}
                onChange={(e) =>
                  patchEntries(
                    mergeAreaMappingAttribute(
                      entries,
                      row.mapRegion,
                      e.target.value,
                      newMappingId,
                    ),
                  )
                }
              />
            </div>
          ))}
          <MappingPagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      {unmatchedValues.length > 0 ? (
        <p className={INSPECTOR_HINT}>
          未匹配取值：
          {unmatchedValues.slice(0, 5).join("、")}
          {unmatchedValues.length > 5 ? "…" : ""} — 在对应「图形」行的「属性」中填写即可。
        </p>
      ) : null}
    </div>
  );
}

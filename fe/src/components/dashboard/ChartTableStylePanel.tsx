import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WIDGET_BORDER_RECOMMENDED } from "./dashboardStyleConfig";
import { ChartDeAttrField, ChartDeSegmentField } from "./chartInspectorDeFields";
import { ChartDeSliderField } from "./deAttrSlider";
import { DeAttrToggleRow } from "./dashboardInspectorUi";
import { ChartInspectorSection, INSPECTOR_SELECT, InspectorInlineColorRow } from "./inspectorCompact";
import { useChartInspector } from "./ChartInspectorContext";
import {
  patchChartDeTableStyle,
  patchTableColumnWidthMode,
  readChartDeTableStyle,
  resolveChartFieldLabel,
  resolveTableStyleDisplayColumns,
  DEFAULT_TABLE_PAGE_SIZE,
  DEFAULT_TABLE_COLUMN_WIDTH_MODE,
} from "@/lib/chartDeTableStyle";
import { TABLE_DEFAULT_ROW_PX, TABLE_MIN_ROW_PX } from "@/components/charts/engine/d3/table/tableLayoutConstants";
import { tableInspectorProfile } from "@/lib/chartTableInspector";

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
const TABLE_MAX_ROW_PX = 120;

/** DataEase 表格 · 样式 Tab「基础样式」（按 table-info / normal / pivot 差异化） */
export function ChartTableStylePanel() {
  const { cfg, onChange, columns } = useChartInspector();
  const profile = tableInspectorProfile(cfg.chartType);
  const tableStyle = readChartDeTableStyle(cfg);
  const paginationMode = tableStyle.paginationMode ?? "page";
  const columnWidthMode = tableStyle.columnWidthMode ?? DEFAULT_TABLE_COLUMN_WIDTH_MODE;
  const hasMetrics = (cfg.metrics?.length ?? 0) > 0;
  const summaryChecked =
    tableStyle.showSummary === true ||
    (tableStyle.showSummary !== false && hasMetrics);

  if (!profile) return null;

  const patch = (next: Parameters<typeof patchChartDeTableStyle>[1]) =>
    onChange(patchChartDeTableStyle(cfg, next));

  const displayCols = resolveTableStyleDisplayColumns(cfg, columns);

  const patchColumnWidth = (col: string, pct: number) => {
    const prev = tableStyle.columnWidths ?? {};
    patch({
      columnWidthMode: "custom",
      columnWidths: { ...prev, [col]: Math.min(100, Math.max(1, pct)) },
      columnWidthsPx: undefined,
      seriesColumnWidthPx: undefined,
    });
  };

  return (
    <ChartInspectorSection
      title={`${profile.label} · 基础样式`}
      data-testid="table-style-basic"
    >
      <div className="pb-1">
        <ChartDeSliderField
          label="不透明度 %"
          value={tableStyle.opacity}
          fallback={100}
          min={0}
          max={100}
          step={1}
          unit="%"
          onChange={(opacity) => patch({ opacity })}
        />

        <InspectorInlineColorRow
          label="边框颜色"
          allowClear
          swatches={WIDGET_BORDER_RECOMMENDED}
          value={tableStyle.borderColor ?? ""}
          onChange={(borderColor) => patch({ borderColor: borderColor || undefined })}
        />

        <InspectorInlineColorRow
          label="滚动条颜色"
          allowClear
          swatches={WIDGET_BORDER_RECOMMENDED}
          value={tableStyle.scrollbarColor ?? ""}
          onChange={(scrollbarColor) => patch({ scrollbarColor: scrollbarColor || undefined })}
        />

        {profile.showPagination ? (
          <>
            <ChartDeSegmentField
              label="分页模式"
              value={paginationMode}
              columns={2}
              options={[
                { value: "page", label: "翻页" },
                { value: "scroll", label: "下拉" },
              ]}
              onChange={(value) => patch({ paginationMode: value as "page" | "scroll" })}
            />

            {paginationMode === "page" ? (
              <>
                <ChartDeSegmentField
                  label="分页器风格"
                  value={tableStyle.paginationVariant ?? "compact"}
                  columns={2}
                  options={[
                    { value: "compact", label: "精简" },
                    { value: "normal", label: "常规" },
                  ]}
                  onChange={(value) =>
                    patch({ paginationVariant: value as "compact" | "normal" })
                  }
                />

                <ChartDeAttrField label="分页">
                  <Select
                    value={String(tableStyle.pageSize ?? DEFAULT_TABLE_PAGE_SIZE)}
                    onValueChange={(value) =>
                      patch({ pageSize: Number(value) as 20 | 50 | 100 })
                    }
                  >
                    <SelectTrigger className={INSPECTOR_SELECT} aria-label="每页条数">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}条/页
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </ChartDeAttrField>
              </>
            ) : null}
          </>
        ) : null}

        {profile.showColumnWidth ? (
          <>
            <p className="px-1 pb-2 text-[10px] leading-snug text-gray-400 dark:text-gray-500">
              列宽与行高可在下方调节；编辑看板时也可在表头拖拽列宽/行高，松手自动保存。
            </p>
            <ChartDeSliderField
              label="行高"
              value={tableStyle.rowHeightPx}
              fallback={TABLE_DEFAULT_ROW_PX}
              min={TABLE_MIN_ROW_PX}
              max={TABLE_MAX_ROW_PX}
              step={1}
              unit="px"
              ariaLabel="表格行高"
              onChange={(rowHeightPx) => patch({ rowHeightPx: Math.round(rowHeightPx) })}
            />
            <ChartDeSegmentField
              label="列宽调整"
              value={columnWidthMode}
              columns={3}
              options={[
                { value: "auto", label: "自适应" },
                { value: "fixed", label: "固定列宽" },
                { value: "custom", label: "自定义" },
              ]}
              onChange={(value) =>
                onChange(patchTableColumnWidthMode(cfg, value as "auto" | "fixed" | "custom"))
              }
            />

            {columnWidthMode === "custom" && displayCols.length > 0 ? (
              <ChartDeAttrField label="列宽比例 %">
                <div className="space-y-2">
                  {displayCols.map((col) => (
                    <ChartDeSliderField
                      key={col}
                      className="border-b-0 py-0 last:border-b-0"
                      label={resolveChartFieldLabel(cfg, col)}
                      value={tableStyle.columnWidths?.[col]}
                      fallback={Math.floor(100 / displayCols.length)}
                      min={1}
                      max={100}
                      step={1}
                      unit="%"
                      ariaLabel={`${resolveChartFieldLabel(cfg, col)} 列宽`}
                      onChange={(pct) => patchColumnWidth(col, pct)}
                    />
                  ))}
                </div>
              </ChartDeAttrField>
            ) : null}
          </>
        ) : null}

        {profile.showWordWrap ? (
          <DeAttrToggleRow
            label="自动换行"
            checked={tableStyle.wordWrap === true}
            onCheckedChange={(wordWrap) => patch({ wordWrap })}
          />
        ) : null}

        {profile.showSummary ? (
          profile.showSubTotals && cfg.chartType === "table-pivot" ? (
            <>
              <DeAttrToggleRow
                label="显示行合计"
                checked={tableStyle.showRowTotal ?? tableStyle.showSummary !== false}
                onCheckedChange={(showRowTotal) => patch({ showRowTotal })}
              />
              <DeAttrToggleRow
                label="显示列合计"
                checked={tableStyle.showColTotal ?? tableStyle.showSummary !== false}
                onCheckedChange={(showColTotal) => patch({ showColTotal })}
              />
            </>
          ) : (
            <DeAttrToggleRow
              label={profile.showSubTotals ? "显示合计" : "显示汇总行"}
              checked={summaryChecked}
              onCheckedChange={(showSummary) => patch({ showSummary })}
            />
          )
        ) : null}

        {profile.showSeriesNumber ? (
          <DeAttrToggleRow
            label="显示序号列"
            checked={tableStyle.showSeriesNumber ?? true}
            onCheckedChange={(showSeriesNumber) => patch({ showSeriesNumber })}
          />
        ) : null}

        {profile.showRowHover ? (
          <DeAttrToggleRow
            label="显示鼠标悬浮样式"
            checked={tableStyle.rowHover !== false}
            onCheckedChange={(rowHover) => patch({ rowHover })}
          />
        ) : null}
      </div>
    </ChartInspectorSection>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pause, Play, Repeat, SkipBack, SkipForward } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useChartInspector } from "@/components/dashboard/chartInspectorContext";
import { InspectorSliderField } from "@/components/dashboard/deAttrSlider";
import {
  ChartInspectorSection,
  INSPECTOR_CTRL,
  INSPECTOR_SECTION_GAP,
  InspectorFieldLabel,
  InspectorSwitchRow,
} from "@/components/dashboard/inspectorCompact";
import { readGisProject, writeGisProject } from "@/components/charts/engine/maplibre/gisProject";
import {
  DEFAULT_GIS_SUN_DATE_MS,
  DEFAULT_GIS_SUN_SETTINGS,
  formatGisSunLocalDate,
  formatGisSunLocalTime,
  GIS_SUN_SHADE_MAX,
  GIS_SUN_SPEED_MAX,
  GIS_SUN_SPEED_MIN,
  localDayStart,
  localMinutesFromDateMs,
  MS_PER_MINUTE,
  resolveGisProjectSun,
  type GisProjectSun,
} from "@/components/charts/engine/maplibre/gisProjectSun";
import { applyGisMapSun, getGisMapSunSettings } from "@/components/charts/engine/maplibre/gisMapViewBridge";
import { cn } from "@/lib/utils";

const SUN_HINT =
  "对标 GeoLibre「太阳」：平面/球面均可用；canvas 夜半球遮罩 + map.setLight 驱动 3D 建筑光照。";
const MINUTES_PER_DAY = 1440;

function clampMinutes(minutes: number): number {
  return Math.max(0, Math.min(MINUTES_PER_DAY - 1, Math.round(minutes)));
}

function withMinutesOfLocalDay(dateMs: number, minutes: number): number {
  return localDayStart(dateMs) + clampMinutes(minutes) * MS_PER_MINUTE;
}

function fromLocalDateTimeParts(date: string, time: string): number | null {
  const ms = new Date(`${date}T${time}`).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function ChartGisMapSunPanel() {
  const { cfg, widget, mutateChartConfig } = useChartInspector();
  const project = readGisProject(cfg);
  const resolved = useMemo(() => resolveGisProjectSun(project.sun), [project.sun]);
  const [timelineMinutes, setTimelineMinutes] = useState(localMinutesFromDateMs(resolved.dateMs));

  useEffect(() => {
    setTimelineMinutes(localMinutesFromDateMs(resolved.dateMs));
  }, [resolved.dateMs]);

  const patchSun = useCallback(
    (patch: GisProjectSun) => {
      mutateChartConfig((current) => {
        const currentProject = readGisProject(current);
        return writeGisProject(current, { sun: { ...currentProject.sun, ...patch } });
      });
    },
    [mutateChartConfig],
  );

  const setSun = useCallback(
    (patch: GisProjectSun) => {
      patchSun(patch);
      applyGisMapSun(widget.id, { ...project.sun, ...patch }, patch);
    },
    [patchSun, project.sun, widget.id],
  );

  useEffect(() => {
    if (!resolved.playing || !resolved.enabled) return;
    let frameId = 0;
    const poll = () => {
      const live = getGisMapSunSettings(widget.id);
      if (live) {
        setTimelineMinutes(localMinutesFromDateMs(live.dateMs));
        if (!live.playing && resolved.playing) {
          patchSun({ dateMs: live.dateMs, playing: false });
        }
      }
      frameId = requestAnimationFrame(poll);
    };
    frameId = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frameId);
  }, [patchSun, resolved.enabled, resolved.playing, widget.id]);

  const date = formatGisSunLocalDate(resolved.dateMs);
  const time = formatGisSunLocalTime(resolved.dateMs);

  return (
    <ChartInspectorSection title="太阳" hint={SUN_HINT} data-testid="chart-gis-map-sun-panel">
      <div className={INSPECTOR_SECTION_GAP}>
        <InspectorSwitchRow
          label="启用太阳光照"
          checked={resolved.enabled}
          onCheckedChange={(enabled) => setSun({ enabled, playing: false })}
        />
        <div className="flex items-end gap-2">
          <div className="grid min-w-0 flex-1 gap-1">
            <InspectorFieldLabel label="日期" />
            <Input
              className={cn(INSPECTOR_CTRL, "min-w-0 w-full px-2")}
              size="sm"
              type="date"
              value={date}
              onChange={(event) => {
                const next = fromLocalDateTimeParts(event.target.value, time);
                if (next != null) setSun({ dateMs: next, playing: false });
              }}
              aria-label="日期"
            />
          </div>
          <div className="grid w-[7.5rem] shrink-0 gap-1">
            <InspectorFieldLabel label="时间" />
            <Input
              className={cn(INSPECTOR_CTRL, "min-w-0 w-full px-2 tabular-nums")}
              size="sm"
              type="time"
              value={time}
              onChange={(event) => {
                const next = fromLocalDateTimeParts(date, event.target.value);
                if (next != null) setSun({ dateMs: next, playing: false });
              }}
              aria-label="时间"
            />
          </div>
        </div>
        <InspectorSliderField
          label="日弧时间轴"
          value={timelineMinutes}
          min={0}
          max={MINUTES_PER_DAY - 1}
          step={1}
          onChange={(minutes) => setSun({ dateMs: withMinutesOfLocalDay(resolved.dateMs, minutes), playing: false })}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="rounded border border-gray-200 p-1 text-gray-600 hover:text-brand-500 dark:border-gray-700"
            aria-label="后退 1 小时"
            onClick={() => setSun({ dateMs: resolved.dateMs - 60 * MS_PER_MINUTE, playing: false })}
          >
            <SkipBack className="size-4" />
          </button>
          <button
            type="button"
            className="rounded border border-brand-500/40 bg-brand-500/10 p-1 text-brand-500"
            aria-label={resolved.playing ? "暂停" : "播放"}
            onClick={() => setSun({ playing: !resolved.playing })}
          >
            {resolved.playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            className="rounded border border-gray-200 p-1 text-gray-600 hover:text-brand-500 dark:border-gray-700"
            aria-label="前进 1 小时"
            onClick={() => setSun({ dateMs: resolved.dateMs + 60 * MS_PER_MINUTE, playing: false })}
          >
            <SkipForward className="size-4" />
          </button>
          <button
            type="button"
            className={`rounded border p-1 ${resolved.loop ? "border-brand-500/40 text-brand-500" : "border-gray-200 text-gray-600 dark:border-gray-700"}`}
            aria-label="循环"
            onClick={() => setSun({ loop: !resolved.loop })}
          >
            <Repeat className="size-4" />
          </button>
          <button
            type="button"
            className="ml-auto text-[10px] text-brand-500 hover:underline"
            onClick={() => setSun({ dateMs: Date.now(), playing: false })}
          >
            当前
          </button>
        </div>
        <InspectorSliderField
          label="动画速度"
          value={Math.round(resolved.speed)}
          min={GIS_SUN_SPEED_MIN}
          max={GIS_SUN_SPEED_MAX}
          step={5}
          unit="min/s"
          onChange={(speed) => setSun({ speed })}
        />
        <InspectorSliderField
          label="夜间阴影"
          value={Math.round(resolved.shadeOpacity * 100)}
          min={0}
          max={Math.round(GIS_SUN_SHADE_MAX * 100)}
          step={5}
          unit="%"
          onChange={(next) => setSun({ shadeOpacity: next / 100 })}
        />
        <p className="text-[10px] text-gray-400">
          默认 {formatGisSunLocalDate(DEFAULT_GIS_SUN_DATE_MS)} ·{" "}
          {formatGisSunLocalTime(DEFAULT_GIS_SUN_DATE_MS)} · {DEFAULT_GIS_SUN_SETTINGS.speed} min/s ·
          阴影 {Math.round(DEFAULT_GIS_SUN_SETTINGS.shadeOpacity * 100)}%
        </p>
      </div>
    </ChartInspectorSection>
  );
}

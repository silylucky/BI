import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChartInspector } from "@/components/dashboard/chartInspectorContext";
import { InspectorSliderField } from "@/components/dashboard/deAttrSlider";
import { defaultBasemapPaletteForFlavor } from "@/components/charts/engine/maplibre/gisBasemapPalette";
import {
  ChartInspectorSection,
  INSPECTOR_CTRL,
  INSPECTOR_SECTION_GAP,
  InspectorFieldLabel,
  InspectorInlineColorRow,
  InspectorSwitchRow,
} from "@/components/dashboard/inspectorCompact";
import {
  DEFAULT_GIS_GLOBE_VIEW,
  finalizeGisViewDraftField,
  formatGisViewDraftFromView,
  GIS_VIEW_BOUNDS,
  GIS_VIEW_DECIMALS,
  GIS_ATMOSPHERE_PRESETS,
  GIS_BASEMAP_FLAVORS,
  normalizeGisProjectView,
  parseGisViewDraft,
  readGisProject,
  resolveGisMapControls,
  writeGisProject,
  type GisBasemapFlavor,
  type GisLabelLang,
  type GisMapControls,
  type GisViewDraftFields,
} from "@/components/charts/engine/maplibre/gisProject";
import { captureGisMapViewCamera, applyGisMapViewCamera, applyGisMapBasemapPatch, applyGisMapControls } from "@/components/charts/engine/maplibre/gisMapViewBridge";
import {
  buildGisConfiguredViewKey,
  GLOBE_IDLE_ROTATION_DEG_PER_SEC,
} from "@/components/charts/engine/maplibre/gisMapRuntime";

const GIS_VIEW_STEP = 10 ** -GIS_VIEW_DECIMALS;

const GIS_VIEW_HINT =
  "经度 −180–180、纬度 −85–85、缩放 0–22、旋转 −180–180°、倾斜 0–85°；保留两位小数。拖拽地图后点「读取当前视角」写回；改视角会关闭球面自转。";

const FLAVOR_LABELS: Record<GisBasemapFlavor, string> = {
  light: "浅色",
  dark: "深色",
  grayscale: "灰度",
  white: "留白",
  black: "纯黑",
};

const GIS_SECTION_HINT =
  "底图风格、投影与视角；全球 PMTiles 服务请在数据 Tab 连接。";

export function ChartGisMapProjectPanel() {
  const { cfg, widget, mutateChartConfig } = useChartInspector();
  const project = readGisProject(cfg);
  const view = project.view ?? DEFAULT_GIS_GLOBE_VIEW;
  const flavorPalette = useMemo(
    () => defaultBasemapPaletteForFlavor(project.basemapFlavor ?? "light"),
    [project.basemapFlavor],
  );

  const patchProject = useCallback(
    (patch: Parameters<typeof writeGisProject>[1]) => {
      mutateChartConfig((current) => writeGisProject(current, patch));
    },
    [mutateChartConfig],
  );

  const initialViewDraft = formatGisViewDraftFromView(view);
  const [centerLng, setCenterLng] = useState(initialViewDraft.centerLng);
  const [centerLat, setCenterLat] = useState(initialViewDraft.centerLat);
  const [zoom, setZoom] = useState(initialViewDraft.zoom);
  const [bearing, setBearing] = useState(initialViewDraft.bearing);
  const [pitch, setPitch] = useState(initialViewDraft.pitch);
  const viewDraftRef = useRef({ centerLng, centerLat, zoom, bearing, pitch });
  viewDraftRef.current = { centerLng, centerLat, zoom, bearing, pitch };
  const committedViewKeyRef = useRef("");

  const commitView = useCallback(
    (next: {
      center?: [number, number];
      zoom?: number;
      bearing?: number;
      pitch?: number;
    }) => {
      mutateChartConfig((current) => {
        const currentProject = readGisProject(current);
        const currentView = currentProject.view ?? DEFAULT_GIS_GLOBE_VIEW;
        return writeGisProject(current, {
          ...(currentProject.autoRotate ? { autoRotate: false } : {}),
          view: {
            center: next.center ?? currentView.center,
            zoom: next.zoom ?? currentView.zoom,
            bearing: next.bearing ?? currentView.bearing ?? 0,
            pitch: next.pitch ?? currentView.pitch ?? 0,
          },
        });
      });
    },
    [mutateChartConfig],
  );

  const applyViewDraft = useCallback(() => {
    const nextView = parseGisViewDraft(viewDraftRef.current);
    if (!nextView) return;
    const nextKey = buildGisConfiguredViewKey(nextView);
    if (nextKey === committedViewKeyRef.current) return;
    applyGisMapViewCamera(widget.id, nextView);
    committedViewKeyRef.current = nextKey;
    commitView(nextView);
  }, [commitView, widget.id]);

  const patchViewDraft = useCallback(
    (patch: Partial<typeof viewDraftRef.current>) => {
      viewDraftRef.current = { ...viewDraftRef.current, ...patch };
      applyViewDraft();
    },
    [applyViewDraft],
  );

  const blurViewField = useCallback(
    (field: keyof GisViewDraftFields, setter: (value: string) => void) => {
      const formatted = finalizeGisViewDraftField(field, viewDraftRef.current[field]);
      setter(formatted);
      patchViewDraft({ [field]: formatted });
    },
    [patchViewDraft],
  );

  const committedViewKey = useMemo(
    () => buildGisConfiguredViewKey(view),
    [view.bearing, view.center[0], view.center[1], view.pitch, view.zoom],
  );
  committedViewKeyRef.current = committedViewKey;

  useEffect(() => {
    const draft = formatGisViewDraftFromView(view);
    setCenterLng(draft.centerLng);
    setCenterLat(draft.centerLat);
    setZoom(draft.zoom);
    setBearing(draft.bearing);
    setPitch(draft.pitch);
    viewDraftRef.current = draft;
  }, [committedViewKey]);

  const commitCenterLng = () => blurViewField("centerLng", setCenterLng);
  const commitCenterLat = () => blurViewField("centerLat", setCenterLat);
  const commitZoom = () => blurViewField("zoom", setZoom);
  const commitBearing = () => blurViewField("bearing", setBearing);
  const commitPitch = () => blurViewField("pitch", setPitch);

  const captureCurrentView = () => {
    const captured = captureGisMapViewCamera(widget.id);
    if (!captured) return;
    const normalized = normalizeGisProjectView(captured);
    mutateChartConfig((current) => {
      const currentProject = readGisProject(current);
      return writeGisProject(current, {
        view: normalized,
        ...(currentProject.autoRotate ? { autoRotate: false } : {}),
      });
    });
  };

  const onEnterCommit = (commit: () => void) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commit();
    event.currentTarget.blur();
  };

  const patchBasemapRuntime = (patch: Parameters<typeof applyGisMapBasemapPatch>[1]) => {
    applyGisMapBasemapPatch(widget.id, patch);
    patchProject(patch);
  };

  const applyEarthOpacity = (opacityPercent: number) => {
    const earthOpacity = Math.max(0, Math.min(100, opacityPercent)) / 100;
    applyGisMapBasemapPatch(widget.id, { earthOpacity });
    patchProject({ earthOpacity });
  };

  const patchBasemapLayers = (key: keyof NonNullable<typeof project.basemapLayers>, checked: boolean) => {
    const next = { ...project.basemapLayers };
    if (checked) delete next[key];
    else next[key] = false;
    const basemapLayers = Object.keys(next).length > 0 ? next : undefined;
    applyGisMapBasemapPatch(widget.id, { basemapLayers });
    patchProject({ basemapLayers });
  };

  const mapControls = useMemo(() => resolveGisMapControls(project), [project]);

  const patchMapControl = useCallback(
    (key: keyof GisMapControls, enabled: boolean) => {
      const next: GisMapControls = { ...project.mapControls };
      if (key === "attribution") {
        if (enabled) delete next.attribution;
        else next.attribution = false;
      } else if (enabled) {
        next[key] = true;
      } else {
        delete next[key];
      }
      const resolved = resolveGisMapControls({ mapControls: next, showControls: false });
      applyGisMapControls(widget.id, resolved);
      patchProject({
        mapControls: Object.keys(next).length > 0 ? next : undefined,
        showControls: false,
      });
    },
    [patchProject, project.mapControls, widget.id],
  );

  return (
    <ChartInspectorSection
      title="GIS 底图"
      hint={GIS_SECTION_HINT}
      data-testid="chart-gis-map-project-panel"
    >
      <div className={INSPECTOR_SECTION_GAP}>
        <div className="grid gap-1.5">
          <div className="grid gap-1.5">
            <InspectorFieldLabel
              label="底图风格"
              hint="预设含道路、边界与标注；可单独改海洋/陆地色或隐藏图层。"
            />
            <Select
              value={project.basemapFlavor ?? "light"}
              onValueChange={(basemapFlavor) =>
                patchProject({
                  basemapFlavor: basemapFlavor as GisBasemapFlavor,
                  landColor: undefined,
                  waterColor: undefined,
                })
              }
            >
              <SelectTrigger className={INSPECTOR_CTRL} aria-label="底图风格">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GIS_BASEMAP_FLAVORS.map((flavor) => (
                  <SelectItem key={flavor} value={flavor}>
                    {FLAVOR_LABELS[flavor]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <InspectorInlineColorRow
            label="陆地底色"
            hint="覆写 earth 与陆地细节；关闭「陆地细节」时仅保留纯色底。"
            value={project.landColor ?? ""}
            fallbackValue={flavorPalette.landColor}
            onChange={(landColor) => patchProject({ landColor })}
          />
          <InspectorInlineColorRow
            label="海洋颜色"
            value={project.waterColor ?? ""}
            fallbackValue={flavorPalette.waterColor}
            onChange={(waterColor) => patchProject({ waterColor })}
          />
          {project.landColor || project.waterColor ? (
            <button
              type="button"
              className="text-theme-xs text-brand-500 hover:underline"
              onClick={() => patchProject({ landColor: undefined, waterColor: undefined })}
            >
              恢复预设配色
            </button>
          ) : null}

          <div className="grid gap-2 rounded-md border border-gray-200 p-2 dark:border-gray-800">
            <InspectorFieldLabel label="底图图层" />
            {(
              [
                ["roads", "道路"],
                ["labels", "标注"],
                ["boundaries", "边界"],
                ["landDetail", "陆地细节"],
              ] as const
            ).map(([key, label]) => (
              <InspectorSwitchRow
                key={key}
                label={label}
                checked={project.basemapLayers?.[key] !== false}
                onCheckedChange={(checked) => patchBasemapLayers(key, checked)}
              />
            ))}
          </div>

          <div className="grid gap-1.5">
            <InspectorFieldLabel label="标注语言" />
            <Select
              value={project.labelLang ?? "zh-Hans"}
              onValueChange={(labelLang) => patchProject({ labelLang: labelLang as GisLabelLang })}
            >
              <SelectTrigger className={INSPECTOR_CTRL} aria-label="标注语言">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-Hans">简体中文</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <InspectorFieldLabel label="投影" />
            <Select
              value={project.projection ?? "mercator"}
              onValueChange={(projection) => {
                if (projection === "globe") {
                  patchProject({
                    projection: "globe",
                    atmospherePreset: "night",
                    fog: project.fog ?? GIS_ATMOSPHERE_PRESETS.night,
                    view: project.view ?? DEFAULT_GIS_GLOBE_VIEW,
                  });
                  return;
                }
                patchProject({ projection: "mercator", fog: undefined, atmospherePreset: undefined });
              }}
            >
              <SelectTrigger className={INSPECTOR_CTRL} aria-label="投影">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mercator">平面墨卡托</SelectItem>
                <SelectItem value="globe">球面地球</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {project.projection === "globe" ? (
            <InspectorSliderField
              label="地球不透明度"
              layout="stacked"
              hint="仅作用于地球表面层，可透出后方星空；默认 100%。"
              value={project.earthOpacity != null ? Math.round(project.earthOpacity * 100) : undefined}
              fallback={100}
              min={0}
              max={100}
              step={1}
              unit="%"
              ariaLabel="地球不透明度"
              onChange={(opacityPercent) => applyEarthOpacity(opacityPercent)}
              onPreviewChange={(opacityPercent) => {
                if (opacityPercent == null) return;
                applyEarthOpacity(opacityPercent);
              }}
            />
          ) : null}
        </div>

        <div className="grid gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-800">
          <div className="flex items-center justify-between gap-2">
            <InspectorFieldLabel label="初始视角" hint={GIS_VIEW_HINT} />
            <button
              type="button"
              className="shrink-0 text-[10px] text-brand-500 hover:underline"
              onClick={captureCurrentView}
            >
              读取当前视角
            </button>
          </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <InspectorFieldLabel label="中心经度" />
            <Input
              className={INSPECTOR_CTRL}
              inputMode="decimal"
              type="number"
              min={GIS_VIEW_BOUNDS.lng.min}
              max={GIS_VIEW_BOUNDS.lng.max}
              step={GIS_VIEW_STEP}
              aria-label="中心经度"
              value={centerLng}
              onChange={(e) => {
                setCenterLng(e.target.value);
                patchViewDraft({ centerLng: e.target.value });
              }}
              onBlur={commitCenterLng}
              onKeyDown={onEnterCommit(commitCenterLng)}
            />
          </div>
          <div className="grid gap-1.5">
            <InspectorFieldLabel label="中心纬度" />
            <Input
              className={INSPECTOR_CTRL}
              inputMode="decimal"
              type="number"
              min={GIS_VIEW_BOUNDS.lat.min}
              max={GIS_VIEW_BOUNDS.lat.max}
              step={GIS_VIEW_STEP}
              aria-label="中心纬度"
              value={centerLat}
              onChange={(e) => {
                setCenterLat(e.target.value);
                patchViewDraft({ centerLat: e.target.value });
              }}
              onBlur={commitCenterLat}
              onKeyDown={onEnterCommit(commitCenterLat)}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="grid gap-1.5">
            <InspectorFieldLabel label="缩放" />
            <Input
              className={INSPECTOR_CTRL}
              inputMode="decimal"
              type="number"
              min={GIS_VIEW_BOUNDS.zoom.min}
              max={GIS_VIEW_BOUNDS.zoom.max}
              step={GIS_VIEW_STEP}
              aria-label="缩放"
              value={zoom}
              onChange={(e) => {
                setZoom(e.target.value);
                patchViewDraft({ zoom: e.target.value });
              }}
              onBlur={commitZoom}
              onKeyDown={onEnterCommit(commitZoom)}
            />
          </div>
          <div className="grid gap-1.5">
            <InspectorFieldLabel label="旋转°" />
            <Input
              className={INSPECTOR_CTRL}
              inputMode="decimal"
              type="number"
              min={GIS_VIEW_BOUNDS.bearing.min}
              max={GIS_VIEW_BOUNDS.bearing.max}
              step={GIS_VIEW_STEP}
              aria-label="旋转"
              value={bearing}
              onChange={(e) => {
                setBearing(e.target.value);
                patchViewDraft({ bearing: e.target.value });
              }}
              onBlur={commitBearing}
              onKeyDown={onEnterCommit(commitBearing)}
            />
          </div>
          <div className="grid gap-1.5">
            <InspectorFieldLabel label="倾斜°" />
            <Input
              className={INSPECTOR_CTRL}
              inputMode="decimal"
              type="number"
              min={GIS_VIEW_BOUNDS.pitch.min}
              max={GIS_VIEW_BOUNDS.pitch.max}
              step={GIS_VIEW_STEP}
              aria-label="倾斜"
              value={pitch}
              onChange={(e) => {
                setPitch(e.target.value);
                patchViewDraft({ pitch: e.target.value });
              }}
              onBlur={commitPitch}
              onKeyDown={onEnterCommit(commitPitch)}
            />
          </div>
        </div>
        </div>

        <div className="grid gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-800">
          <InspectorFieldLabel
            label="地图控件"
            hint="对标 GeoLibre「地图控件」：开启后在地图角显示导航、比例尺等 UI；经纬网为 overlay 图层。"
          />
          {(
            [
              ["navigation", "导航与指南针"],
              ["scale", "比例尺"],
              ["attribution", "归属信息"],
              ["graticule", "经纬网"],
            ] as const
          ).map(([key, label]) => (
            <InspectorSwitchRow
              key={key}
              label={label}
              checked={mapControls[key]}
              onCheckedChange={(checked) => patchMapControl(key, checked)}
            />
          ))}
        </div>

        <div className="grid gap-2 rounded-lg border border-gray-200 p-2 dark:border-gray-800">
          <InspectorSwitchRow
            label="建筑 3D 挤出"
            hint="zoom ≥ 15；OSM 高度缺失时默认 10m；建议 pitch 45°–60°。"
            checked={project.buildings3d !== false}
            onCheckedChange={(checked) => patchBasemapRuntime({ buildings3d: checked })}
          />
          {project.projection === "globe" ? (
            <InspectorSwitchRow
              label="球面自转"
              hint="沿地轴自西向东慢速旋转。"
              checked={project.autoRotate === true}
              onCheckedChange={(checked) => patchProject({ autoRotate: checked })}
            />
          ) : null}
          {project.projection === "globe" && project.autoRotate ? (
            <InspectorSliderField
              label="自转速度"
              hint={`默认约 8 分钟/圈（${GLOBE_IDLE_ROTATION_DEG_PER_SEC.toFixed(4)}°/s）`}
              value={Math.round((project.autoRotateSpeed ?? GLOBE_IDLE_ROTATION_DEG_PER_SEC) * 10000) / 10000}
              min={0.01}
              max={2}
              step={0.01}
              unit="°/s"
              onChange={(autoRotateSpeed) => patchProject({ autoRotateSpeed })}
            />
          ) : null}
        </div>
      </div>
    </ChartInspectorSection>
  );
}

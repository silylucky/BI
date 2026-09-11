import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChartEngineViewProps } from "@/components/charts/engine/types";
import { buildGisOverlayGeoJson } from "@/components/charts/engine/maplibre/gisMapOverlay";
import {
  readGisProject,
  listGisProjectLayers,
  resolveGisOverlayStyle,
  resolveGisMapControls,
  resolveGisRenderableBasemap,
  DEFAULT_GIS_GLOBE_VIEW,
  type ResolvedGisMapControls,
  type GisProjectOverlay,
} from "@/components/charts/engine/maplibre/gisProject";
import {
  applyGisGraticule,
  applyGisGraticuleImmediate,
} from "@/components/charts/engine/maplibre/gisGraticule";
import { applyBasemapRuntimePatch } from "@/components/charts/engine/maplibre/gisBasemapPalette";
import { buildPmtilesStyle } from "@/components/charts/engine/maplibre/gisMapStyle";
import {
  appendGisProjectLayersToStyle,
  buildGisLayersStructuralKey,
  buildGisLayersStyleKey,
  gisScatterInteractionLayerIds,
  syncGisProjectLayerStyle,
  syncGisProjectLayers,
  type GisLayerRuntimeEntry,
} from "@/components/charts/engine/maplibre/gisMapLayerStyle";
import { buildGeoJsonBoundsKey, fitGisOverlayBounds } from "@/components/charts/engine/maplibre/gisMapOverlayFit";
import { mountGisOverlayInteraction } from "@/components/charts/engine/maplibre/gisMapOverlayInteraction";
import {
  applyGisGlobeToStyle,
  spaceBackdropForPreset,
} from "@/components/charts/engine/maplibre/gisAtmosphereSky";
import { resolveGisEffectsSettings } from "@/components/charts/engine/maplibre/gisProjectEffects";
import {
  applyGisGeolibreEffectsSettings,
  createGisGeolibreEffectsEngine,
} from "@/components/charts/engine/maplibre/gisGeolibreEffectsRuntime";
import type { GisGeolibreEffectsEngine } from "@/components/charts/engine/maplibre/gisGeolibreEffectsEngine";
import {
  applyGlobeAtmosphere,
  applyGisMapStylePreservingCamera,
  buildGisConfiguredViewKey,
  captureGisMapCamera,
  classifyGisMapErrorHint,
  mountGisLiveCameraTracking,
  mountGisMapControls,
  GLOBE_IDLE_ROTATION_DEG_PER_SEC,
  restoreGisMapCamera,
  startGisGlobeAutoRotate,
  syncGisMapView,
  whenGisMapStyleReady,
  type GisMapCamera,
} from "@/components/charts/engine/maplibre/gisMapRuntime";
import { resolveGisProjectSun } from "@/components/charts/engine/maplibre/gisProjectSun";
import { createGisSunEngine } from "@/components/charts/engine/maplibre/gisSunRuntime";
import type { GisSunEngine } from "@/components/charts/engine/maplibre/gisSunEngine";
import { mountGisGlobeHaloOverlay } from "@/components/charts/engine/maplibre/gisGlobeHalo";
import { registerGisMapViewLiveControl } from "@/components/charts/engine/maplibre/gisMapViewBridge";
import { VIZ_WHEEL_ZOOM_SURFACE_ATTR } from "@/components/dashboard/pixelCanvas/pixelCanvasWheelScroll";
import { ensurePmtilesArchiveRegistered, loadMapLibreRuntime } from "@/components/charts/engine/maplibre/maplibreBootstrap";
import { withDevPmtilesArchiveUrl } from "@/components/charts/engine/maplibre/gisPmtilesUrl";
import { gisMapTransformRequest } from "@/components/charts/engine/maplibre/gisMapTransformRequest";
import { GIS_MAP_CAPTURE_PREP_EVENT } from "@/lib/captureDashboardThumbnail";
import { GeoMapOverlayHint } from "@/components/charts/engine/geo/GeoMapOverlayHint";
import { resolveGisMapDataHint, shouldShowGisMapOverlayHint } from "@/lib/gisMapDataHint";
import { resolveTileService } from "@/lib/tileServices";
import { cn } from "@/lib/utils";
import "maplibre-gl/dist/maplibre-gl.css";

type MapLibreMap = InstanceType<Awaited<ReturnType<typeof loadMapLibreRuntime>>["Map"]>;
type StyleSpecification = import("maplibre-gl").StyleSpecification;

const DEFAULT_AUTO_ROTATE_SPEED = GLOBE_IDLE_ROTATION_DEG_PER_SEC;

type GisPaintState = "pending" | "loading" | "ready" | "error";

function GisMapViewInner(props: ChartEngineViewProps) {
  const {
    viewModel,
    style: styleContext,
    fill = false,
    height = 180,
    width,
    ariaLabel,
    onPaintReady,
    instanceKey,
    layoutFootprint,
    onLinkageClick,
  } = props;
  const chartConfig = props.chartConfig ?? null;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onPaintReadyRef = useRef(onPaintReady);
  onPaintReadyRef.current = onPaintReady;
  const appliedStyleKeyRef = useRef<string | null>(null);
  const syncedViewKeyRef = useRef<string | null>(null);
  const liveCameraRef = useRef<GisMapCamera | null>(null);
  const overlayFitKeyRef = useRef<string | null>(null);
  const sunEngineRef = useRef<GisSunEngine | null>(null);
  const effectsEngineRef = useRef<GisGeolibreEffectsEngine | null>(null);
  const haloRequestPaintRef = useRef<(() => void) | null>(null);
  const mapControlsDisposeRef = useRef<(() => void) | null>(null);
  const project = useMemo(() => readGisProject(chartConfig), [chartConfig]);
  const projectRef = useRef(project);
  projectRef.current = project;
  const mapControls = useMemo(
    () => resolveGisMapControls(project),
    [project.mapControls, project.showControls],
  );
  const mapControlsKey = useMemo(() => JSON.stringify(mapControls), [mapControls]);
  const mapControlsRef = useRef(mapControls);
  mapControlsRef.current = mapControls;
  const mapControlsApplySerialRef = useRef(0);

  const remountMapControls = useCallback(async (controls: ResolvedGisMapControls) => {
    const map = mapRef.current;
    if (!map) return false;
    const applySerial = ++mapControlsApplySerialRef.current;
    mapControlsRef.current = controls;
    applyGisGraticuleImmediate(map, controls.graticule);
    mapControlsDisposeRef.current?.();
    mapControlsDisposeRef.current = null;
    let dispose: (() => void) | null = null;
    try {
      dispose = await mountGisMapControls(map, controls);
    } finally {
      if (applySerial !== mapControlsApplySerialRef.current) return false;
      mapControlsDisposeRef.current = dispose;
      applyGisGraticuleImmediate(map, controls.graticule);
    }
    return true;
  }, []);
  const sunKey = useMemo(
    () => JSON.stringify(resolveGisProjectSun(project.sun)),
    [project.sun],
  );
  const sunEnabled = resolveGisProjectSun(project.sun).enabled;

  const ensureSunEngine = useCallback((map: MapLibreMap | null = mapRef.current) => {
    if (!map) return;
    const mountSun = () => {
      const resolved = resolveGisProjectSun(projectRef.current.sun);
      if (!resolved.enabled) {
        sunEngineRef.current?.destroy();
        sunEngineRef.current = null;
        return;
      }
      const { enabled: _enabled, ...settings } = resolved;
      if (!sunEngineRef.current) {
        sunEngineRef.current = createGisSunEngine(map, projectRef.current.sun);
      } else {
        sunEngineRef.current.applySettings(settings);
      }
      sunEngineRef.current?.render();
      map.once("idle", () => {
        sunEngineRef.current?.render();
      });
    };
    whenGisMapStyleReady(map, mountSun);
  }, []);

  const [pmtilesStyle, setPmtilesStyle] = useState<StyleSpecification | null>(null);
  const [pmtilesLoading, setPmtilesLoading] = useState(false);
  const [pmtilesErrorHint, setPmtilesErrorHint] = useState<string | null>(null);
  const [mapErrorHint, setMapErrorHint] = useState<string | null>(null);
  const [gisPaintState, setGisPaintState] = useState<GisPaintState>("pending");
  const gisPaintStateRef = useRef<GisPaintState>(gisPaintState);
  gisPaintStateRef.current = gisPaintState;
  const [mapRuntimeEpoch, setMapRuntimeEpoch] = useState(0);

  const tileServiceId = project.tileServiceId;
  const flavor = project.basemapFlavor ?? "light";
  const view = project.view ?? DEFAULT_GIS_GLOBE_VIEW;
  const mapBootstrapKey = `${tileServiceId}:${project.projection ?? "globe"}`;

  useEffect(() => {
    if (!tileServiceId) {
      setGisPaintState("error");
      return;
    }
    if (pmtilesLoading || !pmtilesStyle) {
      setGisPaintState("loading");
    }
  }, [pmtilesLoading, pmtilesStyle, tileServiceId]);

  useEffect(() => {
    if (pmtilesErrorHint || mapErrorHint) {
      setGisPaintState("error");
    }
  }, [mapErrorHint, pmtilesErrorHint]);

  useEffect(() => {
    hostRef.current?.setAttribute("data-gis-paint-state", gisPaintState);
  }, [gisPaintState]);

  useEffect(() => {
    if (gisPaintState !== "error") return;
    onPaintReadyRef.current?.();
  }, [gisPaintState]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const onPrep = () => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;
      map.triggerRepaint();
      map.once("idle", () => {
        mapRef.current?.triggerRepaint();
      });
    };
    host.addEventListener(GIS_MAP_CAPTURE_PREP_EVENT, onPrep);
    return () => host.removeEventListener(GIS_MAP_CAPTURE_PREP_EVENT, onPrep);
  }, [mapBootstrapKey]);

  useEffect(() => {
    if (!tileServiceId) {
      setPmtilesStyle(null);
      setPmtilesLoading(false);
      setPmtilesErrorHint("尚未选择 PMTiles 外部底图服务");
      return;
    }
    let cancelled = false;
    setPmtilesLoading(true);
    setPmtilesErrorHint(null);
    void resolveTileService(tileServiceId)
      .then(async (resolved) => {
        if (cancelled) return;
        const devResolved = withDevPmtilesArchiveUrl(resolved);
        await ensurePmtilesArchiveRegistered(devResolved.pmtilesUrl);
        if (cancelled) return;
        setPmtilesStyle(
          buildPmtilesStyle(devResolved, project.labelLang ?? "zh-Hans", {
            flavor,
            buildings3d: project.buildings3d,
            landColor: project.landColor,
            waterColor: project.waterColor,
            basemapLayers: project.basemapLayers,
          }),
        );
        setPmtilesErrorHint(null);
      })
      .catch(() => {
        if (cancelled) return;
        setPmtilesStyle(null);
        setPmtilesErrorHint("全球 PMTiles 底图暂不可用，请确认外部服务与平台登记");
      })
      .finally(() => {
        if (!cancelled) setPmtilesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    flavor,
    project.labelLang,
    project.landColor,
    project.waterColor,
    tileServiceId,
  ]);

  const basemapPatchKey = useMemo(
    () =>
      JSON.stringify({
        basemapLayers: project.basemapLayers,
        buildings3d: project.buildings3d,
        earthOpacity: project.earthOpacity ?? 1,
      }),
    [project.basemapLayers, project.buildings3d, project.earthOpacity],
  );

  const renderBasemap = useMemo(
    () => resolveGisRenderableBasemap(project, Boolean(pmtilesStyle)),
    [pmtilesStyle, project],
  );

  const requestHaloPaint = useCallback(() => {
    haloRequestPaintRef.current?.();
  }, []);

  const ensureGisEffectsEngine = useCallback(
    (map: MapLibreMap | null = mapRef.current) => {
      if (!map) return;
      const current = projectRef.current;
      const settings = resolveGisEffectsSettings(current);
      if (
        renderBasemap !== "pmtiles" ||
        current.projection !== "globe" ||
        gisPaintStateRef.current !== "ready" ||
        !settings.enabled
      ) {
        effectsEngineRef.current?.destroy();
        effectsEngineRef.current = null;
        return;
      }
      const mount = () => {
        const settings = resolveGisEffectsSettings(projectRef.current);
        if (effectsEngineRef.current) {
          applyGisGeolibreEffectsSettings(effectsEngineRef.current, settings);
        } else {
          effectsEngineRef.current = createGisGeolibreEffectsEngine(map, settings);
        }
        ensureSunEngine(map);
      };
      whenGisMapStyleReady(map, mount);
    },
    [ensureSunEngine, renderBasemap],
  );

  const gisLayers = useMemo(() => listGisProjectLayers(project), [project]);
  const layerEntries = useMemo((): GisLayerRuntimeEntry[] => {
    if (!chartConfig) return [];
    return gisLayers.map((layer) => ({
      layer,
      geoJson: buildGisOverlayGeoJson(
        chartConfig,
        viewModel.dataset.columns,
        viewModel.dataset.rows,
        styleContext.chartColors,
        { binding: layer.binding, overlayStyle: layer.style },
      ),
      options: {
        flavor,
        overlay: layer.style,
        chartColors: styleContext.chartColors,
      },
    }));
  }, [
    chartConfig,
    flavor,
    gisLayers,
    styleContext.chartColors,
    viewModel.dataset.columns,
    viewModel.dataset.rows,
  ]);
  const overlayGeoJson = useMemo(() => {
    for (const entry of layerEntries) {
      if (entry.geoJson?.features.length) return entry.geoJson;
    }
    return null;
  }, [layerEntries]);
  const layerEntriesRef = useRef(layerEntries);
  layerEntriesRef.current = layerEntries;
  const layersStyleKey = useMemo(() => buildGisLayersStyleKey(layerEntries), [layerEntries]);
  const layersStructuralKey = useMemo(
    () => buildGisLayersStructuralKey(layerEntries),
    [layerEntries],
  );

  const applyOverlayPatch = useCallback((layerId: string, patch: GisProjectOverlay) => {
    const map = mapRef.current;
    if (!map) return false;
    const entries = layerEntriesRef.current;
    const index = entries.findIndex((entry) => entry.layer.id === layerId);
    if (index < 0) return false;
    const entry = entries[index]!;
    const mergedStyle = { ...(entry.layer.style ?? {}), ...patch };
    const patched: GisLayerRuntimeEntry = {
      ...entry,
      layer: { ...entry.layer, style: mergedStyle },
      options: { ...entry.options, overlay: mergedStyle },
    };
    const nextEntries = [...entries];
    nextEntries[index] = patched;
    layerEntriesRef.current = nextEntries;
    syncGisProjectLayerStyle(map, patched);
    map.triggerRepaint();
    return true;
  }, []);

  const syncLayersRuntime = useCallback((map: MapLibreMap) => {
    syncGisProjectLayers(map, layerEntriesRef.current);
    applyGisGraticule(map, mapControlsRef.current.graticule);
    const fitCollections: GeoJSON.FeatureCollection[] = [];
    for (const entry of layerEntriesRef.current) {
      const resolved = resolveGisOverlayStyle(entry.layer.style, entry.options.chartColors);
      if (resolved.autoFit && entry.geoJson) {
        fitCollections.push(entry.geoJson);
      }
    }
    if (fitCollections.length > 0) {
      const boundsKey = buildGeoJsonBoundsKey(fitCollections[0]!);
      if (boundsKey && overlayFitKeyRef.current !== boundsKey) {
        fitGisOverlayBounds(map, fitCollections);
        overlayFitKeyRef.current = boundsKey;
      }
    } else if (!layerEntriesRef.current.some((entry) => entry.geoJson)) {
      overlayFitKeyRef.current = null;
    }
  }, []);

  const mapStyleKey = useMemo(
    () =>
      JSON.stringify({
        tileServiceId,
        flavor,
        labelLang: project.labelLang,
        landColor: project.landColor,
        waterColor: project.waterColor,
        projection: project.projection,
        layersStructuralKey,
      }),
    [
      flavor,
      layersStructuralKey,
      project.labelLang,
      project.landColor,
      project.projection,
      project.waterColor,
      tileServiceId,
    ],
  );

  const style = useMemo(() => {
    if (!pmtilesStyle) return null;
    const withLayers = appendGisProjectLayersToStyle(pmtilesStyle, layerEntries);
    return applyGisGlobeToStyle(withLayers, project.projection, project.atmospherePreset);
  }, [layerEntries, pmtilesStyle, project.atmospherePreset, project.projection]);

  const styleKey = mapStyleKey;
  const atmosphereKey = useMemo(
    () =>
      JSON.stringify({
        projection: project.projection ?? "globe",
        preset: project.atmospherePreset ?? "night",
        fog: project.fog,
        halo: project.halo,
        effects: project.effects,
      }),
    [project.atmospherePreset, project.effects, project.fog, project.halo, project.projection],
  );
  const configuredViewKey = useMemo(
    () => buildGisConfiguredViewKey(view),
    [view.bearing, view.center[0], view.center[1], view.pitch, view.zoom],
  );
  const earthOpacity = project.earthOpacity ?? 1;
  const projection = project.projection ?? "globe";
  const effectsSettings = useMemo(
    () => resolveGisEffectsSettings(project),
    [project.effects, project.fog, project.halo],
  );
  const globeSpaceBackdrop = useMemo(
    () =>
      projection === "globe"
        ? spaceBackdropForPreset(project.atmospherePreset ?? "night")
        : undefined,
    [projection, project.atmospherePreset],
  );

  const applyConfiguredView = useCallback((map: MapLibreMap) => {
    const currentView = projectRef.current.view ?? DEFAULT_GIS_GLOBE_VIEW;
    const key = buildGisConfiguredViewKey(currentView);
    if (syncedViewKeyRef.current === key) return;
    if (!syncGisMapView(map, currentView)) return;
    syncedViewKeyRef.current = key;
    liveCameraRef.current = captureGisMapCamera(map);
  }, []);

  const resolveInitialView = useCallback(() => {
    if (liveCameraRef.current) return liveCameraRef.current;
    const configured = projectRef.current.view ?? DEFAULT_GIS_GLOBE_VIEW;
    return {
      center: configured.center,
      zoom: configured.zoom,
      bearing: configured.bearing ?? 0,
      pitch: configured.pitch ?? 0,
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !style || renderBasemap !== "pmtiles") return;

    let cancelled = false;
    let map: MapLibreMap | null = null;
    let resyncDataLayers: (() => void) | undefined;
    let resyncSun: (() => void) | undefined;
    let resyncEffects: (() => void) | undefined;
    let disposeLiveCamera: (() => void) | undefined;
    setGisPaintState("loading");

    void (async () => {
      const maplibregl = await loadMapLibreRuntime();
      if (cancelled || !hostRef.current) return;

      const initialView = resolveInitialView();

      map = new maplibregl.Map({
        container: host,
        style,
        center: initialView.center,
        zoom: initialView.zoom,
        bearing: initialView.bearing,
        pitch: initialView.pitch,
        attributionControl: false,
        transformRequest: gisMapTransformRequest,
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
      mapRef.current = map;
      appliedStyleKeyRef.current = styleKey;
      syncedViewKeyRef.current = liveCameraRef.current
        ? buildGisConfiguredViewKey(initialView)
        : null;
      disposeLiveCamera = mountGisLiveCameraTracking(map, (camera) => {
        liveCameraRef.current = camera;
      });

      // style.load 仅重挂散点层（8/25 febfba53 模式）；勿在此 reload PMTiles 或重复 patch 底图。
      resyncDataLayers = () => {
        if (cancelled || !map) return;
        syncLayersRuntime(map);
      };
      resyncSun = () => {
        if (cancelled || !map) return;
        ensureSunEngine(map);
      };
      resyncEffects = () => {
        if (cancelled || !map) return;
        ensureGisEffectsEngine(map);
        requestHaloPaint();
      };
      map.on("style.load", resyncDataLayers);
      map.on("style.load", resyncSun);
      map.on("style.load", resyncEffects);

      map.on("error", (event) => {
        if (cancelled) return;
        const raw =
          event.error instanceof Error
            ? event.error.message
            : typeof event.error === "string"
              ? event.error
              : "";
        const message = raw.trim() || "地图渲染失败";
        const hint = classifyGisMapErrorHint(message);
        if (hint) setMapErrorHint(hint);
      });

      let initialLoadDone = false;
      const finishInitialLoad = () => {
        if (initialLoadDone || cancelled || !map) return;
        initialLoadDone = true;
        setMapErrorHint(null);
        const current = projectRef.current;
        applyBasemapRuntimePatch(map, {
          basemapLayers: current.basemapLayers,
          buildings3d: current.buildings3d !== false,
          earthOpacity: current.earthOpacity ?? 1,
        });
        applyGlobeAtmosphere(map, {
          projection: current.projection,
          fog: current.fog,
          atmospherePreset: current.atmospherePreset,
        });
        if (liveCameraRef.current) {
          restoreGisMapCamera(map, liveCameraRef.current);
        } else {
          applyConfiguredView(map);
        }
        syncLayersRuntime(map);
        map.once("idle", () => {
          if (!cancelled && map) syncLayersRuntime(map);
        });
        setMapRuntimeEpoch((epoch) => epoch + 1);
        map.resize();
        gisPaintStateRef.current = "ready";
        setGisPaintState("ready");
        ensureGisEffectsEngine(map);
        requestHaloPaint();
        onPaintReadyRef.current?.();
      };

      map.once("load", finishInitialLoad);
      map.once("style.load", finishInitialLoad);
      queueMicrotask(() => {
        if (map.isStyleLoaded()) finishInitialLoad();
      });
    })();

    return () => {
      cancelled = true;
      setMapErrorHint(null);
      setGisPaintState("pending");
      if (map) {
        liveCameraRef.current = captureGisMapCamera(map);
        disposeLiveCamera?.();
      }
      if (map && resyncDataLayers) {
        map.off("style.load", resyncDataLayers);
      }
      if (map && resyncSun) {
        map.off("style.load", resyncSun);
      }
      if (map && resyncEffects) {
        map.off("style.load", resyncEffects);
      }
      effectsEngineRef.current?.destroy();
      effectsEngineRef.current = null;
      sunEngineRef.current?.destroy();
      sunEngineRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      appliedStyleKeyRef.current = null;
      syncedViewKeyRef.current = null;
    };
  }, [applyConfiguredView, ensureGisEffectsEngine, ensureSunEngine, mapBootstrapKey, renderBasemap, requestHaloPaint, resolveInitialView]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || renderBasemap !== "pmtiles" || gisPaintState !== "ready") return;

    let cancelled = false;

    const syncControls = () => {
      if (cancelled) return;
      void remountMapControls(mapControls);
    };

    const onStyleLoad = () => syncControls();

    if (map.isStyleLoaded()) syncControls();
    else map.once("load", syncControls);
    map.on("style.load", onStyleLoad);

    return () => {
      cancelled = true;
      map.off("load", syncControls);
      map.off("style.load", onStyleLoad);
      mapControlsDisposeRef.current?.();
      mapControlsDisposeRef.current = null;
    };
  }, [gisPaintState, mapBootstrapKey, mapControls, mapControlsKey, mapRuntimeEpoch, remountMapControls, renderBasemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !style) return;
    if (appliedStyleKeyRef.current === styleKey) return;

    applyGisMapStylePreservingCamera(
      map,
      style,
      () => {
        applyBasemapRuntimePatch(map, {
          basemapLayers: project.basemapLayers,
          buildings3d: project.buildings3d !== false,
          earthOpacity,
        });
        applyGlobeAtmosphere(
          map,
          {
            projection: project.projection,
            fog: project.fog,
            atmospherePreset: project.atmospherePreset,
          },
          { preserveCamera: true },
        );
        syncLayersRuntime(map);
        map.once("idle", () => syncLayersRuntime(map));
        setMapRuntimeEpoch((epoch) => epoch + 1);
        map.resize();
        gisPaintStateRef.current = "ready";
        setGisPaintState("ready");
        ensureGisEffectsEngine(map);
        requestHaloPaint();
        onPaintReadyRef.current?.();
      },
      liveCameraRef.current,
    );
    appliedStyleKeyRef.current = styleKey;
  }, [
    earthOpacity,
    project.atmospherePreset,
    project.basemapLayers,
    project.buildings3d,
    project.fog,
    project.projection,
    style,
    styleKey,
    syncLayersRuntime,
    ensureGisEffectsEngine,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const applyPatch = () => {
      applyBasemapRuntimePatch(map, {
        basemapLayers: project.basemapLayers,
        buildings3d: project.buildings3d !== false,
        earthOpacity,
      });
    };
    if (map.isStyleLoaded()) applyPatch();
    else map.once("load", applyPatch);
  }, [basemapPatchKey, earthOpacity, project.basemapLayers, project.buildings3d, styleKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    applyGlobeAtmosphere(
      map,
      {
        projection: project.projection,
        fog: project.fog,
        atmospherePreset: project.atmospherePreset,
      },
      { preserveCamera: true },
    );
  }, [atmosphereKey, project.atmospherePreset, project.fog, project.projection]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || gisPaintState !== "ready") return;
    ensureSunEngine(map);
  }, [ensureSunEngine, gisPaintState, mapRuntimeEpoch, sunEnabled, sunKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (syncedViewKeyRef.current === configuredViewKey) return;

    const apply = () => applyConfiguredView(map);
    if (map.isStyleLoaded()) {
      apply();
      return;
    }
    map.once("load", apply);
  }, [applyConfiguredView, configuredViewKey]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const handle = mountGisGlobeHaloOverlay(shell, () => mapRef.current, () => ({
      preset: projectRef.current.atmospherePreset,
      projection: projectRef.current.projection,
      effects: projectRef.current.effects,
      halo: projectRef.current.halo,
      fog: projectRef.current.fog,
    }));
    haloRequestPaintRef.current = handle.requestPaint;
    return () => {
      haloRequestPaintRef.current = null;
      handle.dispose();
    };
  }, [atmosphereKey, project.atmospherePreset, project.effects, project.fog, project.halo, project.projection]);

  useEffect(() => {
    if (gisPaintState !== "ready") return;
    requestHaloPaint();
  }, [gisPaintState, mapRuntimeEpoch, requestHaloPaint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const syncEffects = () => {
      ensureGisEffectsEngine(map);
      requestHaloPaint();
    };
    syncEffects();
    const onStyleLoad = () => syncEffects();
    map.on("style.load", onStyleLoad);
    return () => {
      map.off("style.load", onStyleLoad);
      effectsEngineRef.current?.destroy();
      effectsEngineRef.current = null;
    };
  }, [
    atmosphereKey,
    effectsSettings.enabled,
    ensureGisEffectsEngine,
    gisPaintState,
    mapRuntimeEpoch,
    project.projection,
    renderBasemap,
    requestHaloPaint,
  ]);

  useEffect(() => {
    applyGisGeolibreEffectsSettings(effectsEngineRef.current, effectsSettings);
  }, [effectsSettings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !project.autoRotate || project.projection !== "globe") return;
    const speed = project.autoRotateSpeed ?? DEFAULT_AUTO_ROTATE_SPEED;
    return startGisGlobeAutoRotate(map, speed);
  }, [project.autoRotate, project.autoRotateSpeed, project.projection]);

  const remeasureShell = useCallback(() => {
    mapRef.current?.resize();
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    remeasureShell();
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(remeasureShell) : null;
    observer?.observe(shell);
    return () => observer?.disconnect();
  }, [remeasureShell]);

  useLayoutEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    syncLayersRuntime(map);
    if (map.isStyleLoaded()) {
      map.once("idle", () => syncLayersRuntime(map));
    }
  }, [chartConfig, mapBootstrapKey, mapRuntimeEpoch, layerEntries, layersStyleKey, style, styleKey, syncLayersRuntime]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const runFit = () => {
      const fitCollections: GeoJSON.FeatureCollection[] = [];
      for (const entry of layerEntries) {
        const resolved = resolveGisOverlayStyle(entry.layer.style, styleContext.chartColors);
        if (resolved.autoFit && entry.geoJson) {
          fitCollections.push(entry.geoJson);
        }
      }
      if (fitCollections.length === 0) {
        if (!overlayGeoJson) overlayFitKeyRef.current = null;
        return;
      }
      const boundsKey = buildGeoJsonBoundsKey(fitCollections[0]!);
      if (boundsKey && overlayFitKeyRef.current !== boundsKey) {
        fitGisOverlayBounds(map, fitCollections);
        overlayFitKeyRef.current = boundsKey;
      }
    };
    if (map.isStyleLoaded()) runFit();
    else map.once("load", runFit);
  }, [layerEntries, overlayGeoJson, styleContext.chartColors]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let dispose: (() => void) | undefined;
    const scatterLayer = layerEntries.find((entry) => entry.layer.kind === "scatter");
    const cluster = resolveGisOverlayStyle(scatterLayer?.layer.style, styleContext.chartColors).cluster;
    const interactionIds = scatterLayer
      ? gisScatterInteractionLayerIds(scatterLayer.layer.id, cluster)
      : undefined;
    const mount = () => {
      dispose?.();
      dispose = mountGisOverlayInteraction(
        map,
        cluster,
        (payload) => {
          onLinkageClick?.({ name: payload.name, value: payload.value });
        },
        interactionIds,
      );
    };
    if (map.isStyleLoaded()) mount();
    else map.once("load", mount);
    return () => {
      map.off("load", mount);
      dispose?.();
    };
  }, [layerEntries, layersStyleKey, onLinkageClick, styleContext.chartColors]);

  useEffect(() => {
    remeasureShell();
  }, [layoutFootprint?.width, layoutFootprint?.height, remeasureShell]);

  useEffect(() => {
    if (!instanceKey) return;
    return registerGisMapViewLiveControl(instanceKey, {
      capture: () => {
        const map = mapRef.current;
        if (!map || !map.isStyleLoaded()) return null;
        const center = map.getCenter();
        return {
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          bearing: map.getBearing(),
          pitch: map.getPitch(),
        };
      },
      applyView: (nextView) => {
        const map = mapRef.current;
        if (!map || !syncGisMapView(map, nextView)) return false;
        syncedViewKeyRef.current = buildGisConfiguredViewKey(nextView);
        liveCameraRef.current = {
          center: nextView.center,
          zoom: nextView.zoom,
          bearing: nextView.bearing ?? 0,
          pitch: nextView.pitch ?? 0,
        };
        return true;
      },
      applyAtmosphere: (ctx) => {
        const map = mapRef.current;
        if (!map) return false;
        const current = projectRef.current;
        if (ctx.effects) {
          projectRef.current = { ...current, effects: ctx.effects };
        }
        if (ctx.halo) {
          projectRef.current = { ...projectRef.current, halo: ctx.halo };
        }
        if (ctx.fog) {
          projectRef.current = { ...projectRef.current, fog: ctx.fog };
        }
        applyGisGeolibreEffectsSettings(
          effectsEngineRef.current,
          resolveGisEffectsSettings(projectRef.current),
        );
        ensureGisEffectsEngine(map);
        requestHaloPaint();
        applyGlobeAtmosphere(
          map,
          {
            projection: ctx.projection ?? current.projection,
            fog: ctx.fog ?? current.fog,
            atmospherePreset: ctx.atmospherePreset ?? current.atmospherePreset,
          },
          { preserveCamera: true },
        );
        map.triggerRepaint();
        return true;
      },
      applyBasemapPatch: (patch) => {
        const map = mapRef.current;
        if (!map) return false;
        const current = projectRef.current;
        applyBasemapRuntimePatch(map, {
          basemapLayers: patch.basemapLayers ?? current.basemapLayers,
          buildings3d: patch.buildings3d ?? current.buildings3d !== false,
          earthOpacity: patch.earthOpacity ?? current.earthOpacity ?? 1,
        });
        return true;
      },
      applyMapControls: (controls) => {
        mapControlsRef.current = controls;
        const map = mapRef.current;
        if (map) applyGisGraticuleImmediate(map, controls.graticule);
        void remountMapControls(controls);
        return map != null;
      },
      syncLayers: () => {
        const map = mapRef.current;
        if (!map) return false;
        syncLayersRuntime(map);
        return true;
      },
      applyOverlayPatch,
      applySun: (sun, patch) => {
        const map = mapRef.current;
        if (!map) return false;
        if (sun) {
          projectRef.current = { ...projectRef.current, sun: { ...projectRef.current.sun, ...sun } };
        }
        if (patch) {
          projectRef.current = {
            ...projectRef.current,
            sun: { ...projectRef.current.sun, ...patch },
          };
        }
        ensureSunEngine(map);
        return true;
      },
      getSunSettings: () => sunEngineRef.current?.getSettings() ?? null,
    });
  }, [applyOverlayPatch, ensureGisEffectsEngine, ensureSunEngine, instanceKey, remountMapControls, requestHaloPaint, syncLayersRuntime]);

  const statusHint = pmtilesErrorHint ?? mapErrorHint;
  const dataHint = useMemo(
    () => (chartConfig ? resolveGisMapDataHint(chartConfig, viewModel.dataset.columns) : null),
    [chartConfig, viewModel.dataset.columns],
  );
  const showDataOverlayHint =
    !statusHint &&
    dataHint != null &&
    shouldShowGisMapOverlayHint(dataHint, Boolean(overlayGeoJson));

  return (
    <div
      className={cn("relative overflow-hidden rounded-md", fill ? "h-full w-full" : undefined)}
      style={fill ? undefined : { width: width ?? "100%", height }}
    >
      <div
        ref={shellRef}
        className="relative h-full w-full"
        style={globeSpaceBackdrop ? { background: globeSpaceBackdrop } : undefined}
        {...(fill ? { [VIZ_WHEEL_ZOOM_SURFACE_ATTR]: "true" } : {})}
      >
        <div
          ref={hostRef}
          data-testid="gis-map-view"
          data-basemap={renderBasemap ?? "pending"}
          data-requested-basemap="pmtiles"
          data-atmosphere={project.atmospherePreset ?? "night"}
          data-projection={projection}
          data-earth-opacity={earthOpacity}
          data-overlay-features={overlayGeoJson?.features.length ?? 0}
          data-gis-paint-state={gisPaintState}
          className="relative z-[4] h-full w-full"
          role="img"
          aria-label={ariaLabel ?? "GIS 地图"}
        />
      </div>
      {pmtilesLoading ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 bg-black/40 px-2 py-1 text-center text-[10px] text-white">
          正在加载全球底图…
        </div>
      ) : null}
      {showDataOverlayHint && dataHint?.overlayMessage ? (
        <GeoMapOverlayHint
          data-testid="gis-map-data-overlay-hint"
          message={dataHint.overlayMessage}
          tone="warning"
          className="z-[5]"
        />
      ) : null}
      {statusHint ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] bg-red-600/90 px-2 py-1 text-center text-[10px] text-white">
          {statusHint}
        </div>
      ) : null}
    </div>
  );
}

export const GisMapView = memo(GisMapViewInner);

import {
  applyCapHoverVisual,
  applyCapVisual,
  snapshotCapVisual,
  type CapVisualSnapshot,
} from "@/components/charts/engine/three/capVisualSnapshot";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  type GeoMapRenderResult,
  resolveGeoMapFallbackBanner,
} from "@/components/charts/engine/geo/geoMapRenderResult";
import {
  getOfflineGeoMap,
  joinOfflineMapFeatures,
  resolveOfflineGeoMapId,
} from "@/components/charts/engine/geo/OfflineGeoPort";
import { loadOfflineGeoMap, listBundledCityProvinceAdcodes } from "@/components/charts/engine/geo/geoMapLevels";
import { isDecorativeGeoFeature } from "@/components/charts/engine/geo/geoProjection";
import { colorForGeoHover } from "@/components/charts/engine/geo/geoSurfaceColors";
import { createTooltipLayer, hideTooltip, showMergedTooltipAtViewport } from "@/components/charts/engine/d3/core/tooltipLayer";
import type { D3Theme } from "@/components/charts/engine/d3/core/themeEngine";
import type { D3GeoRenderConfig } from "@/components/charts/engine/d3/types";
import {
  colorForValue,
  geoSurfaceColorsForPreset,
  geometryToShapes,
} from "@/components/charts/engine/three/geoToThreeShapes";
import { probeWebGL, type WebGLApi } from "@/components/charts/engine/three/webglProbe";
import {
  buildNationalTerrainProject,
  buildTerrainAlignedGeoProject,
} from "@/components/charts/engine/three/geo/threeGeoProject";
import { loadChinaTerrainPack, resolveProvinceTerrainUvBounds, shouldLoadProvinceTerrainPack } from "@/components/charts/engine/three/geo/chinaTerrainLoader";
import { computeCapTintColor, type TerrainCapSource } from "@/components/charts/engine/three/geo/applyGeoTerrainSurface";
import {
  isProvinceTerrainPackUsable,
  resolveProvinceTerrainProbeUv,
} from "@/components/charts/engine/three/geo/provinceTerrainProbe";
import {
  buildGeoFlatPlateMesh, resolveGeoPlateDepth, GEO_BORDER_ABOVE_CAP_Z, resolveGeoCapTopZ } from "@/components/charts/engine/three/buildGeoFlatPlateMesh";
import { resolveRegionAnchorProjected } from "@/components/charts/engine/three/geo3dRegionCentroid";
import { mountThreeGeoVisualMap } from "@/components/charts/engine/three/threeGeoVisualMap";
import {
  configureThreeGeoOrbitControls,
  layoutThreeGeoMapGroup,
  applyGeo3dOrbitSnapshot,
  captureGeo3dOrbitSnapshot,
} from "@/components/charts/engine/three/threeGeoOrbit";
import {
  GEO3D_ORBIT_STATE_VERSION,
  readGeo3dOrbitState,
  writeGeo3dOrbitState,
} from "@/components/charts/engine/three/geo3dOrbitState";
import { projectWorldToViewport, provinceWorldCenter } from "@/components/charts/engine/three/threeGeoScreen";
import { resolveEmbeddedGeoRoam, VS_REGIONS_MAP_ID } from "@/components/charts/engine/geo/geoConstants";
import { DEFAULT_GEO3D_EXTRUDE_INTENSITY, resolveGeoVisualMapEnabled } from "@/lib/chartDeStyle";
import {
  releaseWebGLSlot,
  releaseWebGLSlotIfCurrent,
  resolveTerrainTextureEnabled,
  setWebGLSlotDispose,
  tryAcquireWebGLSlot,
  type Geo3dRenderTier,
} from "@/components/charts/engine/three/geo3dRuntime";
import {
  advanceGeoMapDoubleTap,
  isPointerTapMove,
  type GeoMapTapState,
} from "@/components/charts/engine/three/geoMapDoubleTap";
import { resolveGeoRegionBorder } from "@/components/charts/engine/geo/geoRegionBorderStyle";
import { prefersNativeReducedMotion } from "@/components/charts/engine/d3/core/animate";
import { resolveGeo3dVisualStyle, applyGeo3dSceneClouds, applyGeo3dPlatformEffectsLayer, applyGeo3dPointEffectsLayer, hasCustomGeo3dShellColor, resolveGeo3dShellColorNumber, resolveGeo3dShellOpacity, resolveGeo3dPointEffects, resolveGeo3dPlatformEffects, resolveGeo3dSceneClouds, resolveGeo3dStylePreset } from "@/components/charts/engine/three/geo3dVisualStyle";
import { buildHeatBlobSamplesForMap } from "@/components/charts/engine/three/geo3dHeatSamples";
import { resolvePointEffectsStyle } from "@/components/charts/engine/three/geo3dPointEffectsStyle";
import {
  applyGeo3dVisualStylePatch,
  compareGeo3dStyleUpdate,
} from "@/components/charts/engine/three/geo3dStylePatch";
import { buildGeo3dLayerStructureSigs } from "@/components/charts/engine/three/geo3dStyleContentSig";

function noopDispose(): void {
  /* empty */
}

function showDevTerrainFailureHint(container: HTMLElement): () => void {
  if (!import.meta.env.DEV) return () => undefined;
  const hint = document.createElement("div");
  hint.className =
    "pointer-events-none absolute bottom-1 left-1 z-10 rounded bg-warning-500/90 px-1.5 py-0.5 text-[10px] text-white";
  hint.setAttribute("role", "status");
  hint.textContent = "地形贴图加载失败，已使用纯色顶面";
  if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
  }
  container.appendChild(hint);
  return () => hint.remove();
}

function logDevTerrainDiagnostics(
  terrainOn: boolean,
  terrainPack: Awaited<ReturnType<typeof loadChinaTerrainPack>> | null,
  firstCap: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial | undefined,
  mapId: string | undefined,
  drillDepth: number,
  webglApi?: WebGLApi | "none",
): void {
  if (!import.meta.env.DEV) return;
  if (terrainOn && !terrainPack) {
    console.warn("[map-3d] terrain pack missing", { mapId, drillDepth, webglApi });
    return;
  }
  if (!terrainPack) return;
  const mapImage = firstCap?.map?.image;
  console.debug("[map-3d] terrain pack loaded", {
    level: terrainPack.level,
    adcode: terrainPack.adcode,
    debugUrl: terrainPack.debugUrl,
    capHasMap: Boolean(firstCap?.map),
    capMaterialType: firstCap?.type,
    capMapImage: mapImage instanceof HTMLImageElement ? `${mapImage.width}x${mapImage.height}` : mapImage,
    webglApi,
    renderEngine: "three",
  });
}

function attachOrbitGrabCursor(
  domElement: HTMLElement,
  controls: OrbitControls,
  roam: boolean,
): () => void {
  if (!roam) return () => undefined;
  domElement.style.cursor = "grab";
  const onStart = () => {
    domElement.style.cursor = "grabbing";
  };
  const onEnd = () => {
    domElement.style.cursor = "grab";
  };
  controls.addEventListener("start", onStart);
  controls.addEventListener("end", onEnd);
  return () => {
    controls.removeEventListener("start", onStart);
    controls.removeEventListener("end", onEnd);
    domElement.style.cursor = "";
  };
}

function provinceGroupOf(obj: THREE.Object3D): THREE.Object3D | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    if (cur.userData?.name != null) return cur;
    cur = cur.parent;
  }
  return null;
}

function capMaterialOf(
  target: THREE.Object3D,
): THREE.MeshBasicMaterial | THREE.MeshStandardMaterial {
  const group = provinceGroupOf(target) ?? target;
  return group.userData.capMaterial as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
}

function disposePlateGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
      child.geometry?.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) m.dispose();
    }
  });
}

function applyProvinceBorderVisual(
  border: THREE.LineSegments,
  regionBorder: ReturnType<typeof resolveGeoRegionBorder>,
  groupUserData: Record<string, unknown>,
  hover: boolean,
): void {
  const baseColor = hover
    ? regionBorder.hoverColorHex
    : (groupUserData.borderColor as number) ?? regionBorder.colorHex;
  const opacity = hover
    ? 1
    : ((groupUserData.borderOpacity as number) ?? regionBorder.opacity);

  const mat = border.material as THREE.LineBasicMaterial;
  mat.color.setHex(baseColor);
  mat.opacity = opacity;
  border.visible = true;
}

function geo3dFailure(container: HTMLElement, reason: string): GeoMapRenderResult {
  container.replaceChildren();
  container.dataset.webglApi = "none";
  const msg = document.createElement("div");
  msg.className =
    "flex h-full items-center justify-center px-3 text-center text-theme-sm text-warning-600 dark:text-warning-400";
  msg.setAttribute("role", "alert");
  msg.textContent = resolveGeoMapFallbackBanner(reason);
  container.appendChild(msg);
  return {
    dispose: () => container.replaceChildren(),
    engine: "three",
    fallbackReason: reason,
  };
}

export async function renderThreeChoroplethChart(
  container: HTMLElement,
  config: D3GeoRenderConfig,
): Promise<GeoMapRenderResult> {
  const {
    width,
    height,
    rows,
    columns,
    regionField,
    metricField,
    theme,
    showTooltip,
    tooltipPresentation,
    valueFormat,
    knownRegionNames,
    mapId,
    isDark = false,
    geoStyle = {},
    geo3dStyle = {},
    drillDepth = 0,
    onPointClick,
    renderTier = "full",
    instanceKey,
    areaMapping,
    onOrbitViewChange,
  } = config;

  if (width <= 0 || height <= 0) {
    container.replaceChildren();
    return { dispose: noopDispose, engine: "three" };
  }

  // 对标上周/今早：渲染前加载当前层级离线资产；禁止用全国 GeoJSON 顶替下钻 mapId
  const resolvedMapId = resolveOfflineGeoMapId(mapId);
  const geo = await loadOfflineGeoMap(resolvedMapId);
  if (!geo?.features?.length) {
    container.replaceChildren();
    const message =
      resolvedMapId === VS_REGIONS_MAP_ID
        ? "离线地图资产缺失，无法渲染"
        : `下钻地图资产未就绪（${resolvedMapId}），请返回上一级或稍后重试`;
    if (import.meta.env.DEV) {
      const adcodeMatch = /^vs-geo-(\d{6})$/.exec(resolvedMapId);
      const adcode = adcodeMatch ? Number(adcodeMatch[1]) : null;
      console.error("[map-3d] drill geo missing after loadOfflineGeoMap", {
        mapId: resolvedMapId,
        drillDepth,
        bundledHasAdcode:
          adcode != null ? listBundledCityProvinceAdcodes().includes(adcode) : undefined,
      });
    }
    throw new Error(message);
  }

  const features = joinOfflineMapFeatures(
    rows,
    columns,
    regionField,
    metricField,
    resolvedMapId,
    knownRegionNames,
    drillDepth,
    areaMapping,
  ).filter((f) => f.geometry != null);

  container.replaceChildren();
  Object.assign(container.style, {
    position: "relative",
    overflow: "hidden",
  });
  if (features.length === 0) {
    const msg = document.createElement("div");
    msg.className =
      "flex h-full items-center justify-center px-3 text-center text-theme-sm text-warning-600 dark:text-warning-400";
    msg.setAttribute("role", "status");
    msg.textContent = "暂无匹配地区数据，请检查维度字段与地图区域是否对应";
    container.appendChild(msg);
    return { dispose: () => container.replaceChildren(), engine: "three" };
  }

  const webglSlotKey =
    instanceKey ??
    `geo3d-${resolvedMapId}-${String(container.dataset.widgetId ?? (container.id || "anon"))}`;
  const orbitStateKey = instanceKey ? `${instanceKey}:${resolvedMapId}` : undefined;
  let slotReleased = false;
  const releaseSlot = () => {
    if (slotReleased) return;
    slotReleased = true;
    releaseWebGLSlot(webglSlotKey);
  };
  if (!tryAcquireWebGLSlot(webglSlotKey, { evictOldest: true })) {
    return geo3dFailure(container, "webgl-cap-exceeded");
  }

  const webglProbe = probeWebGL();
  container.dataset.webglApi = webglProbe.api ?? "none";
  if (!webglProbe.ok) {
    releaseSlot();
    return geo3dFailure(container, "webgl-unavailable");
  }

  try {
    const visualStyle = resolveGeo3dVisualStyle(geo3dStyle, isDark);
    const pointEffectsStyle = resolvePointEffectsStyle(
      geo3dStyle,
      visualStyle.preset,
      isDark,
      resolveGeo3dPointEffects(geo3dStyle),
    );
    const enablePointEffects = renderTier !== "thumbnail" && pointEffectsStyle.enabled;
    const heatBlobActive = enablePointEffects && pointEffectsStyle.layers.heatBlob;
    const capTintMixScale =
      visualStyle.capTintMixScale *
      (heatBlobActive ? pointEffectsStyle.heatBlobDimChoropleth : 1);
    const surface = geoSurfaceColorsForPreset(isDark, visualStyle.preset);
    const values = features.map((f) => f.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values, 1);
    const plateScale = Math.max(0.35, geo3dStyle.extrudeIntensity ?? DEFAULT_GEO3D_EXTRUDE_INTENSITY);
    const regionBorder = resolveGeoRegionBorder(geoStyle, isDark, { preset: visualStyle.preset });
    const borderColor = regionBorder.colorHex;
    const borderOpacity = regionBorder.opacity;
    const customShell = hasCustomGeo3dShellColor(geo3dStyle);
    const shellColor = resolveGeo3dShellColorNumber(geo3dStyle, isDark);
    const shellOpacity = resolveGeo3dShellOpacity(geo3dStyle);
    const shellEmissive = customShell
      ? 0x000000
      : isDark
        ? visualStyle.shellEmissiveDark
        : visualStyle.shellEmissiveLight;
    const shellEmissiveIntensity = customShell ? 0 : visualStyle.shellEmissiveIntensity;
    const capEmissiveIntensity = isDark ? visualStyle.capEmissiveDark : visualStyle.capEmissiveLight;
    const showVisualMap = resolveGeoVisualMapEnabled(geoStyle, "map-3d");
    const terrainOn = resolveTerrainTextureEnabled(
      renderTier as Geo3dRenderTier,
      geo3dStyle,
    );

    const geoProject = buildTerrainAlignedGeoProject(width, height, resolvedMapId, drillDepth, geo);
    const { project, projBounds } = geoProject;
    let provinceTerrain = terrainOn && shouldLoadProvinceTerrainPack(resolvedMapId, drillDepth);
    const plateDepth = resolveGeoPlateDepth(projBounds, plateScale, drillDepth);

    let terrainPack: Awaited<ReturnType<typeof loadChinaTerrainPack>> | null = null;
    let renderDisposed = false;

    let detachTerrainHint = () => undefined;

    if (terrainOn) {
      try {
        if (provinceTerrain) {
          terrainPack = await loadChinaTerrainPack({ mapId: resolvedMapId, drillDepth, isDark });
          const probeUv = resolveProvinceTerrainProbeUv(resolvedMapId, drillDepth, geo);
          if (terrainPack && !isProvinceTerrainPackUsable(terrainPack, probeUv)) {
            if (import.meta.env.DEV) {
              console.warn("[map-3d] province diffuse misaligned, fallback to national bridge", {
                mapId: resolvedMapId,
                drillDepth,
                probeUv,
              });
            }
            terrainPack.dispose();
            terrainPack = null;
            provinceTerrain = false;
          }
        }
        if (!terrainPack) {
          const useNationalBridge = drillDepth > 0;
          terrainPack = await loadChinaTerrainPack({
            mapId: useNationalBridge ? VS_REGIONS_MAP_ID : resolvedMapId,
            drillDepth: useNationalBridge ? 0 : drillDepth,
            isDark,
          });
        }
      } catch (err) {
        detachTerrainHint = showDevTerrainFailureHint(container);
        if (import.meta.env.DEV) {
          console.warn("[map-3d] terrain pack load failed", err);
        }
      }
    }

    const drillNationalUv = terrainOn && drillDepth > 0 && !provinceTerrain;
    const nationalGeoProject = drillNationalUv
      ? buildNationalTerrainProject(getOfflineGeoMap(VS_REGIONS_MAP_ID) ?? { features: [] })
      : null;
    const terrainUvBounds = provinceTerrain
      ? (resolveProvinceTerrainUvBounds(resolvedMapId, drillDepth) ?? geoProject.projBounds)
      : resolveProvinceTerrainUvBounds(resolvedMapId, drillDepth) ?? projBounds;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 5000);
    const maxPixelRatio = renderTier === "full" ? 2 : 1;
    const renderer = new THREE.WebGLRenderer({
      antialias: renderTier === "full",
      alpha: true,
      powerPreference: "high-performance",
      // 封面截图要 toDataURL；默认 false 会在合成后清空缓冲，html-to-image 读到空画布或抛 SecurityError
      preserveDrawingBuffer: true,
    });
    if (!renderer.getContext()) {
      renderer.dispose();
      releaseSlot();
      return geo3dFailure(container, "webgl-unavailable");
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    renderer.setSize(width, height);
    Object.assign(renderer.domElement.style, {
      display: "block",
      width: "100%",
      height: "100%",
    });
    container.appendChild(renderer.domElement);

    const ambientIntensity = isDark ? visualStyle.ambientDark : visualStyle.ambientLight;
    scene.add(new THREE.AmbientLight(0x9eb4c8, ambientIntensity));

    const keyBase = isDark ? visualStyle.keyDark : visualStyle.keyLight;
    const fillBase = isDark ? visualStyle.fillDark : visualStyle.fillLight;
    const keyIntensity = terrainOn ? keyBase * (isDark ? 0.85 : 0.9) : keyBase;
    const fillIntensity = terrainOn ? fillBase * (isDark ? 0.75 : 0.8) : fillBase;
    const keyLight = new THREE.DirectionalLight(0xf0f6fc, keyIntensity);
    keyLight.position.set(-1.2, 2.4, 1.0);
    const fillLight = new THREE.DirectionalLight(0x5a8ab0, fillIntensity);
    fillLight.position.set(1.4, 1.2, -0.8);
    scene.add(keyLight, fillLight);

    const mapGroup = new THREE.Group();
    const meshes: THREE.Group[] = [];
    const perShapeTerrainOpts = terrainPack
      ? {
          terrainColorMap: terrainPack.colorMap,
          ...(drillNationalUv && nationalGeoProject
            ? {
                uvBridge: { local: geoProject, national: nationalGeoProject },
              }
            : { projBounds: terrainUvBounds }),
          terrainSource: terrainPack.source,
        }
      : {};

    let firstCapMaterial: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial | undefined;

    for (const feature of features) {
      if (!feature.geometry) continue;
      const shapes = geometryToShapes(feature.geometry, project);
      if (shapes.length === 0) continue;

      const color = colorForValue(feature.value, minVal, maxVal, surface);
      const valueT = maxVal <= minVal ? 1 : (feature.value - minVal) / (maxVal - minVal);
      const anchorXY = resolveRegionAnchorProjected(feature, project);

      for (const shape of shapes) {
        const built = buildGeoFlatPlateMesh(shape, plateDepth, color, borderColor, isDark, {
          ...perShapeTerrainOpts,
          dataTint: color,
          valueT,
          shellColor,
          shellOpacity,
          shellEmissive,
          shellEmissiveIntensity,
          shellMetalness: visualStyle.shellMetalness,
          shellRoughness: visualStyle.shellRoughness,
          capEmissiveIntensity,
          capMetalness: visualStyle.capMetalness,
          capRoughness: visualStyle.capRoughness,
          capTintMixScale,
          techSatelliteOverlay: visualStyle.techSatelliteOverlay,
          borderOpacity,
          showBorderLines: regionBorder.show,
        });
        if (!firstCapMaterial) firstCapMaterial = built.capMaterial;
        const capRestingVisual = snapshotCapVisual(built.capMaterial);
        const capTopZForAnchor = resolveGeoCapTopZ(plateDepth, Boolean(terrainPack?.colorMap));
        const capBox2 = new THREE.Box2();
        for (const pt of shape.getPoints()) {
          capBox2.expandByPoint(pt);
        }
        const capAnchorLocal = anchorXY
          ? new THREE.Vector3(anchorXY[0], anchorXY[1], capTopZForAnchor)
          : new THREE.Vector3(
              (capBox2.min.x + capBox2.max.x) * 0.5,
              (capBox2.min.y + capBox2.max.y) * 0.5,
              capTopZForAnchor,
            );
        const capExtent = Math.max(
          capBox2.max.x - capBox2.min.x,
          capBox2.max.y - capBox2.min.y,
          1e-4,
        );
        built.mesh.userData = {
          name: feature.name,
          value: feature.value,
          adcode: feature.adcode,
          valueT,
          terrainApplied: Boolean(terrainPack?.colorMap),
          capMaterial: built.capMaterial,
          capRestingVisual,
          borderLines: built.borderLines,
          borderColor,
          borderOpacity,
          capAnchorLocal,
          capExtent,
        };
        mapGroup.add(built.mesh);
        meshes.push(built.mesh);
      }
    }

    const borderZ =
      resolveGeoCapTopZ(plateDepth, Boolean(terrainPack?.colorMap)) + GEO_BORDER_ABOVE_CAP_Z;

    logDevTerrainDiagnostics(terrainOn, terrainPack, firstCapMaterial, resolvedMapId, drillDepth, webglProbe.api ?? "none");

    if (meshes.length === 0) {
      renderer.dispose();
      container.replaceChildren();
      const msg = document.createElement("div");
      msg.className =
        "flex h-full items-center justify-center px-3 text-center text-theme-sm text-warning-600 dark:text-warning-400";
      msg.setAttribute("role", "status");
      msg.textContent = "3D 地图几何构建失败，请检查地区维度与 GeoJSON";
      container.appendChild(msg);
      return { dispose: () => container.replaceChildren(), engine: "three" };
    }

    scene.add(mapGroup);
    const orbitLayout = layoutThreeGeoMapGroup(mapGroup, { preCentered: true });

    let sceneClouds: ReturnType<typeof applyGeo3dSceneClouds> = null;
    let platformEffects: ReturnType<typeof applyGeo3dPlatformEffectsLayer> = null;
    let pointEffects: ReturnType<typeof applyGeo3dPointEffectsLayer> = null;
    try {
      sceneClouds = applyGeo3dSceneClouds(scene, orbitLayout, visualStyle, geo3dStyle);
    } catch (cloudErr) {
      if (import.meta.env.DEV) {
        console.warn("[map-3d] scene clouds disabled after init failure", cloudErr);
      }
    }
    try {
      platformEffects = applyGeo3dPlatformEffectsLayer(
        scene,
        orbitLayout,
        visualStyle,
        geo3dStyle,
        isDark,
      );
    } catch (platformErr) {
      if (import.meta.env.DEV) {
        console.warn("[map-3d] platform effects disabled after init failure", platformErr);
      }
    }
    if (enablePointEffects) {
      try {
        const heatBlobSamples = heatBlobActive
          ? await buildHeatBlobSamplesForMap(
              rows,
              columns,
              regionField,
              metricField,
              features,
              project,
              areaMapping,
            )
          : [];
        pointEffects = applyGeo3dPointEffectsLayer({
          container,
          domElement: renderer.domElement,
          mapGroup,
          meshes,
          heatBlobSamples,
          features,
          project,
          projBounds,
          minVal,
          maxVal,
          plateDepth,
          terrainCap: Boolean(terrainPack?.colorMap),
          layout: orbitLayout,
          geo3dStyle,
          isDark,
        });
      } catch (pointErr) {
        if (import.meta.env.DEV) {
          console.warn("[map-3d] point effects disabled after init failure", pointErr);
        }
      }
    }

    const hasSceneDecor = () => Boolean(sceneClouds || platformEffects || pointEffects);

    const roam = resolveEmbeddedGeoRoam(geoStyle.roam);
    const controls = new OrbitControls(camera, renderer.domElement);
    const orbitDamping = roam && renderTier === "full";
    const detachOrbitPan = configureThreeGeoOrbitControls(camera, controls, orbitLayout, roam, {
      enableDamping: orbitDamping,
    });
    const savedOrbit = readGeo3dOrbitState(orbitStateKey);
    const persistedOrbitView = geo3dStyle.orbitViews?.[resolvedMapId];
    if (persistedOrbitView) {
      applyGeo3dOrbitSnapshot(camera, controls, {
        v: GEO3D_ORBIT_STATE_VERSION,
        target: persistedOrbitView.target,
        position: persistedOrbitView.position,
      });
    } else if (savedOrbit) {
      applyGeo3dOrbitSnapshot(camera, controls, savedOrbit);
    }
    const persistOrbit = () => {
      const snapshot = captureGeo3dOrbitSnapshot(camera, controls);
      writeGeo3dOrbitState(orbitStateKey, snapshot);
      onOrbitViewChange?.({
        target: snapshot.target,
        position: snapshot.position,
      });
    };
    const detachGrabCursor = attachOrbitGrabCursor(renderer.domElement, controls, roam);

    let orbitDragging = false;
    let dampingFrameId = 0;
    let hoverFrameId = 0;
    let renderFrameId = 0;
    let cloudFrameId = 0;
    let cloudLoopActive = false;
    let cloudStartMs = performance.now();
    let lastCloudTickMs = cloudStartMs;
    let lastHoverEvent: PointerEvent | null = null;
    let visibleInViewport = true;
    const enableHoverPick = renderTier !== "thumbnail";
    /** 悬停抬升：约为挤出厚度的 16%，与底板厚度解耦 */
    const HOVER_LIFT_Z = Math.max(plateDepth * 0.16, 0.2);
    const LIFT_SMOOTH_BASE = 0.2;

    const provinceParts = (name: string) =>
      meshes.filter((part) => String(part.userData?.name) === name);

    let liftRafId = 0;
    let lastLiftTs = 0;

    const setLiftTargets = (hoveredName: string | null) => {
      for (const part of meshes) {
        const name = String(part.userData?.name ?? "");
        part.userData.liftTarget = hoveredName && name === hoveredName ? HOVER_LIFT_Z : 0;
      }
    };

    const resolveHoverAnchorWorld = (): THREE.Vector3 | null => {
      if (lastHoverEvent && !orbitDragging) {
        const hit = raycastProvinceGroup(lastHoverEvent);
        if (hit) return hit.point;
      }
      if (!hoveredProvince) return null;
      const parts = provinceParts(hoveredProvince);
      if (parts.length === 0) return null;
      return provinceWorldCenter(parts);
    };

    const syncHoverTooltip = () => {
      if (!tooltip || !showTooltip || !hoveredProvince) return;
      const parts = provinceParts(hoveredProvince);
      if (parts.length === 0) return;
      const sample = parts[0].userData;
      const worldAnchor = resolveHoverAnchorWorld();
      if (!worldAnchor) return;
      const anchor = projectWorldToViewport(worldAnchor, camera, renderer.domElement);
      showMergedTooltipAtViewport(
        tooltip,
        anchor,
        String(sample.name),
        [{ name: metricField || "值", color: surface.rangeHighCss, value: Number(sample.value ?? 0) }],
        valueFormat,
      );
    };

    const tickLiftSmooth = (ts: number) => {
      const dt = lastLiftTs ? Math.min(48, ts - lastLiftTs) : 16;
      lastLiftTs = ts;
      const factor = 1 - (1 - LIFT_SMOOTH_BASE) ** (dt / 16.67);
      let moving = false;

      for (const part of meshes) {
        const target = (part.userData.liftTarget as number | undefined) ?? 0;
        const cur = part.position.z;
        const delta = target - cur;
        if (Math.abs(delta) > 0.003) {
          part.position.z = cur + delta * factor;
          moving = true;
        } else if (cur !== target) {
          part.position.z = target;
        }
      }

      renderFrame();
      if (hoveredProvince) syncHoverTooltip();

      if (moving) {
        liftRafId = requestAnimationFrame(tickLiftSmooth);
      } else {
        liftRafId = 0;
        lastLiftTs = 0;
      }
    };

    const requestLiftTick = () => {
      if (!liftRafId) liftRafId = requestAnimationFrame(tickLiftSmooth);
    };

    const renderFrame = () => {
      if (pointEffects?.pillarLayer) {
        pointEffects.update(0, true, camera);
      }
      if (pointEffects?.floatingLabels) {
        pointEffects.syncLabels(camera, renderer.domElement, container);
      }
      renderer.render(scene, camera);
    };

    const scheduleRender = () => {
      if (!visibleInViewport || renderFrameId) return;
      renderFrameId = requestAnimationFrame(() => {
        renderFrameId = 0;
        if (!visibleInViewport) return;
        renderFrame();
        runDampingTail();
      });
    };

    const runDampingTail = () => {
      if (!orbitDamping || dampingFrameId || !visibleInViewport) return;
      const tick = () => {
        dampingFrameId = 0;
        if (!visibleInViewport || !roam) return;
        if (controls.update()) {
          renderFrame();
          dampingFrameId = requestAnimationFrame(tick);
        }
      };
      dampingFrameId = requestAnimationFrame(tick);
    };

    const stopClouds = () => {
      cloudLoopActive = false;
      if (cloudFrameId) {
        cancelAnimationFrame(cloudFrameId);
        cloudFrameId = 0;
      }
    };

    const tickClouds = () => {
      cloudFrameId = 0;
      if (
        !cloudLoopActive ||
        renderDisposed ||
        !hasSceneDecor() ||
        prefersNativeReducedMotion()
      ) {
        return;
      }
      const now = performance.now();
      const deltaSec = Math.min(0.05, (now - lastCloudTickMs) / 1000);
      lastCloudTickMs = now;
      sceneClouds?.update(deltaSec, camera);
      platformEffects?.update(deltaSec);
      pointEffects?.update(deltaSec, prefersNativeReducedMotion(), camera);
      renderFrame();
      if (
        cloudLoopActive &&
        !renderDisposed &&
        hasSceneDecor() &&
        !prefersNativeReducedMotion()
      ) {
        cloudFrameId = requestAnimationFrame(tickClouds);
      }
    };

    const startClouds = () => {
      if (renderDisposed || !hasSceneDecor() || prefersNativeReducedMotion()) return;
      cloudLoopActive = true;
      if (!cloudFrameId) {
        cloudStartMs = performance.now();
        lastCloudTickMs = cloudStartMs;
        cloudFrameId = requestAnimationFrame(tickClouds);
      }
    };

    const resumeClouds = () => {
      stopClouds();
      startClouds();
    };

    const syncViewportVisibility = (intersecting: boolean) => {
      const wasVisible = visibleInViewport;
      visibleInViewport = intersecting;
      if (!intersecting) {
        stopDampingTail();
        stopClouds();
        return;
      }
      if (!wasVisible && hasSceneDecor()) {
        resumeClouds();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        resumeClouds();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    const onControlsChange = () => {
      scheduleRender();
      if (hoveredProvince) syncHoverTooltip();
    };
    controls.addEventListener("change", onControlsChange);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let hoveredProvince: string | null = null;
    let lastTap: GeoMapTapState = null;
    let pointerDown: { x: number; y: number } | null = null;

    const raycastProvinceGroup = (
      event: PointerEvent | MouseEvent,
    ): { group: THREE.Object3D; point: THREE.Vector3 } | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(meshes, true);
      for (const hit of hits) {
        if (!(hit.object instanceof THREE.Mesh)) continue;
        const group = provinceGroupOf(hit.object);
        if (group?.userData?.name) return { group, point: hit.point.clone() };
      }
      return null;
    };

    const handleMapDoubleActivate = (event: PointerEvent | MouseEvent, group: THREE.Object3D) => {
      if (!group.userData?.name || !onPointClick) return false;
      onPointClick({
        name: String(group.userData.name),
        value: Number(group.userData.value ?? 0),
        adcode: group.userData.adcode as number | undefined,
      });
      event.preventDefault();
      event.stopPropagation();
      return true;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointerDown = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const down = pointerDown;
      pointerDown = null;
      if (!down || !isPointerTapMove(down.x, down.y, event.clientX, event.clientY)) {
        lastTap = null;
        return;
      }

      const hit = raycastProvinceGroup(event);
      const tapKey = hit?.group.userData?.name ? String(hit.group.userData.name) : "__empty__";
      const { isDouble, next } = advanceGeoMapDoubleTap(lastTap, event.timeStamp, tapKey);
      lastTap = next;
      if (!isDouble) return;

      if (tapKey !== "__empty__" && hit) {
        handleMapDoubleActivate(event, hit.group);
      }
    };

    const onClick = (event: MouseEvent) => {
      if (event.detail !== 2) return;
      const hit = raycastProvinceGroup(event);
      if (hit?.group.userData?.name) {
        handleMapDoubleActivate(event, hit.group);
      }
    };

    const tooltip = showTooltip
      ? createTooltipLayer(container, theme as D3Theme, tooltipPresentation)
      : null;
    const detachVisualMap = showVisualMap
      ? mountThreeGeoVisualMap(container, { min: minVal, max: maxVal, surface, valueFormat, isDark })
      : () => undefined;

    const terrainCapSource: TerrainCapSource = terrainPack?.source ?? "satellite";

    const restoreProvinceVisual = (group: THREE.Object3D) => {
      const border = group.userData.borderLines as THREE.LineSegments | undefined;
      if (border && regionBorder.show) {
        applyProvinceBorderVisual(
          border,
          regionBorder,
          group.userData as Record<string, unknown>,
          false,
        );
      } else if (border) {
        border.visible = false;
      }
      const cap = capMaterialOf(group);
      const resting = group.userData.capRestingVisual as CapVisualSnapshot | undefined;
      if (resting) applyCapVisual(cap, resting);
    };

    const setHover = (group: THREE.Object3D | null) => {
      const nextName = group?.userData?.name ? String(group.userData.name) : null;
      if (hoveredProvince !== nextName) {
        if (hoveredProvince) {
          for (const part of provinceParts(hoveredProvince)) {
            restoreProvinceVisual(part);
          }
        }

        hoveredProvince = nextName;

        if (hoveredProvince) {
          for (const part of provinceParts(hoveredProvince)) {
            const border = part.userData.borderLines as THREE.LineSegments | undefined;
            if (border && regionBorder.show) {
              applyProvinceBorderVisual(
                border,
                regionBorder,
                part.userData as Record<string, unknown>,
                true,
              );
            }
            const cap = capMaterialOf(part);
            const resting = part.userData.capRestingVisual as CapVisualSnapshot | undefined;
            if (!resting) continue;
            const partValue = Number(part.userData.value ?? 0);
            const partValueT = Number(part.userData.valueT ?? 0);
            const hoverData = new THREE.Color(
              colorForGeoHover(partValue, minVal, maxVal, surface.palette),
            );
            const hoverTint = part.userData.terrainApplied
              ? computeCapTintColor(
                  hoverData,
                  partValueT,
                  isDark,
                  terrainCapSource,
                  capTintMixScale,
                )
              : hoverData;
            applyCapHoverVisual(cap, resting, hoverTint, isDark);
          }
        }

        setLiftTargets(hoveredProvince);
        requestLiftTick();
      }

      if (!hoveredProvince) {
        hideTooltip(tooltip);
      }
    };

    let chartWidth = width;
    let chartHeight = height;

    const onMove = (event: PointerEvent) => {
      if (!enableHoverPick || orbitDragging || event.buttons !== 0) {
        setHover(null);
        hideTooltip(tooltip);
        return;
      }
      lastHoverEvent = event;
      if (hoverFrameId) return;
      hoverFrameId = requestAnimationFrame(() => {
        hoverFrameId = 0;
        const moveEvent = lastHoverEvent;
        if (!moveEvent || orbitDragging) return;
        const hit = raycastProvinceGroup(moveEvent);
        if (!hit?.group.userData?.name) {
          setHover(null);
          hideTooltip(tooltip);
          renderer.domElement.style.cursor = roam ? "grab" : "default";
          return;
        }
        renderer.domElement.style.cursor = "pointer";
        setHover(hit.group);
        syncHoverTooltip();
      });
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("click", onClick);
    if (enableHoverPick) {
      renderer.domElement.addEventListener("pointermove", onMove);
      renderer.domElement.addEventListener("pointerleave", () => {
        setHover(null);
        hideTooltip(tooltip);
      });
    }

    const stopDampingTail = () => {
      if (dampingFrameId) {
        cancelAnimationFrame(dampingFrameId);
        dampingFrameId = 0;
      }
    };

    const onOrbitStart = () => {
      orbitDragging = true;
      if (hoverFrameId) {
        cancelAnimationFrame(hoverFrameId);
        hoverFrameId = 0;
      }
      setHover(null);
      hideTooltip(tooltip);
    };
    const onOrbitEnd = () => {
      orbitDragging = false;
      persistOrbit();
    };
    controls.addEventListener("start", onOrbitStart);
    controls.addEventListener("end", onOrbitEnd);

    renderFrame();

    const viewportObserver = new IntersectionObserver(
      ([entry]) => {
        syncViewportVisibility(entry?.isIntersecting ?? false);
      },
      { threshold: 0.01 },
    );
    viewportObserver.observe(container);
    if (hasSceneDecor()) {
      resumeClouds();
    }

    const resize = (nextWidth: number, nextHeight: number) => {
      if (nextWidth <= 0 || nextHeight <= 0) return false;
      chartWidth = nextWidth;
      chartHeight = nextHeight;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
      renderer.setSize(nextWidth, nextHeight);
      renderFrame();
      if (hasSceneDecor()) resumeClouds();
      return true;
    };

    const disposeImpl = () => {
      renderDisposed = true;
      viewportObserver.disconnect();
      stopDampingTail();
      stopClouds();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (hoverFrameId) {
        cancelAnimationFrame(hoverFrameId);
        hoverFrameId = 0;
      }
      if (renderFrameId) {
        cancelAnimationFrame(renderFrameId);
        renderFrameId = 0;
      }
      if (liftRafId) {
        cancelAnimationFrame(liftRafId);
        liftRafId = 0;
        lastLiftTs = 0;
      }
      persistOrbit();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("click", onClick);
      if (enableHoverPick) {
        renderer.domElement.removeEventListener("pointermove", onMove);
      }
      controls.removeEventListener("change", onControlsChange);
      controls.removeEventListener("start", onOrbitStart);
      controls.removeEventListener("end", onOrbitEnd);
      controls.dispose();
      detachOrbitPan();
      detachGrabCursor();
      detachTerrainHint();
      sceneClouds?.dispose();
      platformEffects?.dispose();
      pointEffects?.dispose();
      terrainPack?.dispose();
      terrainPack = null;
      for (const mesh of meshes) disposePlateGroup(mesh);
      renderer.dispose();
      hideTooltip(tooltip);
      detachVisualMap();
      const ownsContainerDom = renderer.domElement.parentElement === container;
      if (ownsContainerDom) {
        container.replaceChildren();
      } else {
        renderer.domElement.remove();
      }
      releaseWebGLSlotIfCurrent(webglSlotKey, disposeImpl);
      slotReleased = true;
    };

    setWebGLSlotDispose(webglSlotKey, disposeImpl);

    let currentGeo3dStyle = geo3dStyle;
    let currentGeoStyle = geoStyle;
    let currentIsDark = isDark;

    const mountPointEffectsLayer = async (style: typeof geo3dStyle) => {
      if (!enablePointEffects) {
        pointEffects?.dispose();
        pointEffects = null;
        return;
      }
      const preset = resolveGeo3dStylePreset(style);
      const peStyle = resolvePointEffectsStyle(
        style,
        preset,
        currentIsDark,
        resolveGeo3dPointEffects(style),
      );
      const heatActive = peStyle.enabled && peStyle.layers.heatBlob;
      const heatBlobSamples = heatActive
        ? await buildHeatBlobSamplesForMap(
            rows,
            columns,
            regionField,
            metricField,
            features,
            project,
            areaMapping,
          )
        : [];
      pointEffects?.dispose();
      pointEffects = applyGeo3dPointEffectsLayer({
        container,
        domElement: renderer.domElement,
        mapGroup,
        meshes,
        heatBlobSamples,
        features,
        project,
        projBounds,
        minVal,
        maxVal,
        plateDepth,
        terrainCap: Boolean(terrainPack?.colorMap),
        layout: orbitLayout,
        geo3dStyle: style,
        isDark: currentIsDark,
      });
    };

    const rebuildCloudLayer = () => {
      sceneClouds?.dispose();
      sceneClouds = null;
      if (!resolveGeo3dSceneClouds(currentGeo3dStyle)) return;
      try {
        sceneClouds = applyGeo3dSceneClouds(
          scene,
          orbitLayout,
          resolveGeo3dVisualStyle(currentGeo3dStyle, currentIsDark),
          currentGeo3dStyle,
        );
      } catch (cloudErr) {
        if (import.meta.env.DEV) {
          console.warn("[map-3d] scene clouds rebuild failed", cloudErr);
        }
      }
    };

    const rebuildPlatformLayer = () => {
      platformEffects?.dispose();
      platformEffects = null;
      if (!resolveGeo3dPlatformEffects(currentGeo3dStyle)) return;
      try {
        platformEffects = applyGeo3dPlatformEffectsLayer(
          scene,
          orbitLayout,
          resolveGeo3dVisualStyle(currentGeo3dStyle, currentIsDark),
          currentGeo3dStyle,
          currentIsDark,
        );
      } catch (platformErr) {
        if (import.meta.env.DEV) {
          console.warn("[map-3d] platform effects rebuild failed", platformErr);
        }
      }
    };

    const patchGeo3dStyle = async (input: {
      geo3dStyle?: typeof geo3dStyle;
      geoStyle?: typeof geoStyle;
      isDark?: boolean;
    }): Promise<boolean> => {
      const nextGeo3d = input.geo3dStyle ?? currentGeo3dStyle;
      const nextGeo = input.geoStyle ?? currentGeoStyle;
      const nextDark = input.isDark ?? currentIsDark;
      const action = compareGeo3dStyleUpdate(
        currentGeo3dStyle,
        currentGeoStyle,
        nextGeo3d,
        nextGeo,
      );
      if (action === "full-rebuild") return false;

      if (action === "noop") return true;

      if (action === "layer-rebuilt") {
        const prevLayers = buildGeo3dLayerStructureSigs(currentGeo3dStyle, currentGeoStyle);
        const nextLayers = buildGeo3dLayerStructureSigs(nextGeo3d, nextGeo);
        currentGeo3dStyle = nextGeo3d;
        currentGeoStyle = nextGeo;
        currentIsDark = nextDark;
        if (prevLayers.cloud !== nextLayers.cloud) rebuildCloudLayer();
        if (prevLayers.platform !== nextLayers.platform) rebuildPlatformLayer();
        if (prevLayers.point !== nextLayers.point) {
          await mountPointEffectsLayer(nextGeo3d);
        }
      } else {
        currentGeo3dStyle = nextGeo3d;
        currentGeoStyle = nextGeo;
        currentIsDark = nextDark;
      }

      applyGeo3dVisualStylePatch(
        { meshes, sceneClouds, platformEffects, pointEffects },
        currentGeo3dStyle,
        currentGeoStyle,
        currentIsDark,
      );
      renderFrame();
      if (hasSceneDecor()) resumeClouds();
      return true;
    };

    return {
      engine: "three",
      webglApi: webglProbe.api ?? "none",
      resize,
      patchGeo3dStyle,
      setAnimationActive: () => {
        /* 云/点特效生命周期由 resumeClouds / dispose 管理 */
      },
      dispose: disposeImpl,
    };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error("[map-3d] three init failed", err);
    }
    releaseSlot();
    return geo3dFailure(container, "three-init-failed");
  }
}

export { webglAvailable } from "@/components/charts/engine/three/webglProbe";

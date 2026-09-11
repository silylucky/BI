import {
  GIS_OVERLAY_CIRCLE_LAYER_ID,
  GIS_OVERLAY_CLUSTER_LAYER_ID,
} from "@/components/charts/engine/maplibre/gisMapStyle";

type MapLibreMap = import("maplibre-gl").Map;
type Popup = import("maplibre-gl").Popup;

export type GisOverlayClickPayload = {
  name: string;
  value: string;
  lng: number;
  lat: number;
  label?: string;
};

function overlayLayerIds(clusterEnabled: boolean): string[] {
  return clusterEnabled
    ? [GIS_OVERLAY_CLUSTER_LAYER_ID, GIS_OVERLAY_CIRCLE_LAYER_ID]
    : [GIS_OVERLAY_CIRCLE_LAYER_ID];
}

function formatPopupHtml(props: Record<string, unknown>, lng: number, lat: number): string {
  const label = props.label != null ? String(props.label) : "散点";
  const value = props.value != null ? String(props.value) : "—";
  return `<div style="font:12px/1.4 sans-serif;padding:2px 0">
    <div style="font-weight:600">${label}</div>
    <div>数值：${value}</div>
    <div style="opacity:.7">${lng.toFixed(4)}, ${lat.toFixed(4)}</div>
  </div>`;
}

export function mountGisOverlayInteraction(
  map: MapLibreMap,
  clusterEnabled: boolean,
  onPointClick?: (payload: GisOverlayClickPayload) => void,
  layerIds?: string[],
): () => void {
  const ids = layerIds ?? overlayLayerIds(clusterEnabled);
  let popup: Popup | null = null;

  const handleClick = (event: import("maplibre-gl").MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
    const feature = event.features?.[0];
    if (!feature || feature.geometry?.type !== "Point") return;
    const [lng, lat] = feature.geometry.coordinates;
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    const props = feature.properties ?? {};
    const label = props.label != null ? String(props.label) : undefined;
    const valueRaw = props.value ?? props.point_count;
    const value = valueRaw != null ? String(valueRaw) : "";
    onPointClick?.({
      name: label ?? (value || "散点"),
      value: value || label || "散点",
      lng,
      lat,
      label,
    });
    void import("maplibre-gl").then(({ Popup }) => {
      popup?.remove();
      popup = new Popup({ closeButton: true, closeOnClick: true, offset: 12 })
        .setLngLat([lng, lat])
        .setHTML(formatPopupHtml(props, lng, lat))
        .addTo(map);
    });
  };

  const enterHandlers = new Map<string, () => void>();
  const leaveHandlers = new Map<string, () => void>();

  for (const layerId of ids) {
    map.on("click", layerId, handleClick);
    const onEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    enterHandlers.set(layerId, onEnter);
    leaveHandlers.set(layerId, onLeave);
    map.on("mouseenter", layerId, onEnter);
    map.on("mouseleave", layerId, onLeave);
  }

  return () => {
    popup?.remove();
    popup = null;
    for (const layerId of ids) {
      map.off("click", layerId, handleClick);
      const onEnter = enterHandlers.get(layerId);
      const onLeave = leaveHandlers.get(layerId);
      if (onEnter) map.off("mouseenter", layerId, onEnter);
      if (onLeave) map.off("mouseleave", layerId, onLeave);
    }
  };
}

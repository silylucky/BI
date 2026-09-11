import type { GisProject, GisProjectOverlay } from "@/components/charts/engine/maplibre/gisProject";

export type GisLayerKind = "scatter" | "heatmap";

/** 图层级字段覆写；留空则回退 chartConfig 数据 Tab 槽位。 */
export type GisProjectLayerBinding = {
  lngField?: string;
  latField?: string;
  metricField?: string;
  labelField?: string;
};

export type GisProjectLayer = {
  id: string;
  name: string;
  visible?: boolean;
  opacity?: number;
  kind: GisLayerKind;
  binding?: GisProjectLayerBinding;
  style?: GisProjectOverlay;
};

const DEFAULT_LAYER_NAME = "散点层";

export function createGisProjectLayerId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `layer-${Date.now().toString(36)}`;
}

export function defaultGisProjectLayer(kind: GisLayerKind = "scatter"): GisProjectLayer {
  return {
    id: createGisProjectLayerId(),
    name: kind === "heatmap" ? "热力层" : DEFAULT_LAYER_NAME,
    visible: true,
    opacity: 1,
    kind,
  };
}

export function normalizeGisProjectLayer(input: unknown): GisProjectLayer | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<GisProjectLayer>;
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id.trim() : createGisProjectLayerId();
  const name = typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : DEFAULT_LAYER_NAME;
  const kind = raw.kind === "heatmap" || raw.kind === "scatter" ? raw.kind : "scatter";
  const opacityRaw = Number(raw.opacity);
  const layer: GisProjectLayer = { id, name, kind };
  if (raw.visible === false) layer.visible = false;
  if (Number.isFinite(opacityRaw) && opacityRaw >= 0 && opacityRaw <= 1) {
    layer.opacity = opacityRaw;
  }
  if (raw.style && typeof raw.style === "object") {
    layer.style = raw.style;
  }
  const binding = normalizeGisProjectLayerBinding(raw.binding);
  if (binding) layer.binding = binding;
  return layer;
}

function normalizeGisProjectLayerBinding(input: unknown): GisProjectLayerBinding | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as GisProjectLayerBinding;
  const next: GisProjectLayerBinding = {};
  if (typeof raw.lngField === "string" && raw.lngField.trim()) next.lngField = raw.lngField.trim();
  if (typeof raw.latField === "string" && raw.latField.trim()) next.latField = raw.latField.trim();
  if (typeof raw.metricField === "string" && raw.metricField.trim()) {
    next.metricField = raw.metricField.trim();
  }
  if (typeof raw.labelField === "string" && raw.labelField.trim()) {
    next.labelField = raw.labelField.trim();
  }
  return Object.keys(next).length > 0 ? next : undefined;
}

export function normalizeGisProjectLayers(input: unknown): GisProjectLayer[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const layers = input
    .map((item) => normalizeGisProjectLayer(item))
    .filter((layer): layer is GisProjectLayer => layer != null);
  return layers.length > 0 ? layers : undefined;
}

/** 读取图层栈：优先 layers[]，否则从 legacy overlay 迁移单层。 */
export function listGisProjectLayers(project: GisProject): GisProjectLayer[] {
  if (project.layers && project.layers.length > 0) {
    return project.layers.map((layer) => ({ ...layer }));
  }
  if (project.overlay && Object.keys(project.overlay).length > 0) {
    return [
      {
        id: "default-overlay",
        name: DEFAULT_LAYER_NAME,
        visible: true,
        opacity: 1,
        kind: "scatter",
        style: { ...project.overlay },
      },
    ];
  }
  return [
    {
      id: "default-overlay",
      name: DEFAULT_LAYER_NAME,
      visible: true,
      opacity: 1,
      kind: "scatter",
    },
  ];
}

export function writeGisProjectLayers(
  project: GisProject,
  layers: GisProjectLayer[],
): Partial<GisProject> {
  return {
    layers,
    overlay: undefined,
  };
}

export function patchGisProjectLayer(
  project: GisProject,
  layerId: string,
  patch: Partial<GisProjectLayer>,
): GisProjectLayer[] {
  return listGisProjectLayers(project).map((layer) =>
    layer.id === layerId ? { ...layer, ...patch, id: layer.id } : layer,
  );
}

export function resolveActiveGisProjectLayer(project: GisProject): GisProjectLayer {
  const layers = listGisProjectLayers(project);
  if (project.activeLayerId) {
    const active = layers.find((layer) => layer.id === project.activeLayerId);
    if (active) return active;
  }
  return layers[0]!;
}

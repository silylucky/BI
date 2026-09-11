import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { drillStackRevision, useChartDrill } from "@/components/charts/ChartDrillContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { patchChartDeStyleNested } from "@/lib/chartDeStyle";
import {
  isMunicipalityAdcode,
  listOfflineCityNames,
  listOfflineDistrictNames,
  listOfflineProvinceNames,
  lookupProvinceAdcode,
} from "@/components/charts/engine/geo/geoMapLevels";
import {
  buildGeoMapDrillStackFromSelection,
  formatGeoMapRegionSelectionLabel,
  geoMapRegionMaxDepth,
  parseGeoMapDrillStackSelection,
  readManualGeoMapDrillStack,
  resolveGeoMapCityAdcode,
  resolveGeoMapDrillChain,
  validateManualGeoMapDrillStack,
  type GeoMapRegionSelection,
} from "@/lib/geoMapRegionPicker";
import { useChartInspector } from "./chartInspectorContext";
import { INSPECTOR_HINT, INSPECTOR_SELECT_TRIGGER } from "./inspectorCompact";

type RegionNode = {
  key: string;
  label: string;
  depth: 0 | 1 | 2;
  selection: GeoMapRegionSelection | null;
  hasChildren: boolean;
};

function nodeMatchesSelection(node: RegionNode, selection: GeoMapRegionSelection | null): boolean {
  if (!node.selection) return !selection;
  if (!selection) return false;
  if (node.selection.province !== selection.province) return false;
  if (node.depth === 1) {
    const city = node.selection.city ?? node.selection.district;
    const selected = selection.city ?? selection.district;
    return city === selected && !selection.district;
  }
  if (node.depth === 2) {
    return node.selection.district === selection.district;
  }
  return !selection.city && !selection.district;
}

export function ChartMapRegionPicker() {
  const { widget, cfg, onChange } = useChartInspector();
  const drill = useChartDrill(widget.id);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [childrenByKey, setChildrenByKey] = useState<Map<string, RegionNode[]>>(() => new Map());
  const [loadingKeys, setLoadingKeys] = useState<Set<string>>(() => new Set());
  const loadedKeysRef = useRef<Set<string>>(new Set());

  const manualDrillStack = useMemo(() => readManualGeoMapDrillStack(cfg), [cfg]);

  const activeStack = useMemo(() => {
    if (drill.active && drill.stack.length) return drill.stack;
    if (manualDrillStack !== undefined) return manualDrillStack;
    return [];
  }, [drill.active, drill.stack, manualDrillStack]);

  const stackRevision = drillStackRevision(activeStack);

  useEffect(() => {
    if (!drill.active || manualDrillStack === undefined) return;
    if (drillStackRevision(drill.stack) === drillStackRevision(manualDrillStack)) return;
    if (manualDrillStack.length) drill.setStack(manualDrillStack);
    else drill.reset();
  }, [drill.active, drill.reset, drill.setStack, drill.stack, manualDrillStack]);
  const chain = resolveGeoMapDrillChain(cfg);
  const maxDepth = geoMapRegionMaxDepth(cfg);
  const selection = useMemo(
    () => parseGeoMapDrillStackSelection(activeStack),
    [activeStack],
  );
  const displayLabel = formatGeoMapRegionSelectionLabel(selection);

  const rootNodes = useMemo<RegionNode[]>(() => {
    const national: RegionNode = {
      key: "national",
      label: "全国",
      depth: 0,
      selection: null,
      hasChildren: false,
    };
    const provinces = listOfflineProvinceNames().map((name) => {
      const adcode = lookupProvinceAdcode(name);
      const municipality = adcode ? isMunicipalityAdcode(adcode) : false;
      const canDrillDeeper = maxDepth >= 2;
      const hasChildren =
        maxDepth >= 1 &&
        Boolean(adcode) &&
        (municipality ? canDrillDeeper && chain.length >= 3 : chain.length >= 2);
      return {
        key: `p:${name}`,
        label: name,
        depth: 0 as const,
        selection: { province: name },
        hasChildren,
      };
    });
    return [national, ...provinces];
  }, [chain.length, maxDepth]);

  const loadChildren = useCallback(
    async (node: RegionNode) => {
      if (!node.selection?.province || loadedKeysRef.current.has(node.key)) return;
      const provinceAdcode = lookupProvinceAdcode(node.selection.province);
      if (!provinceAdcode) return;

      setLoadingKeys((prev) => new Set(prev).add(node.key));
      try {
        const names = await listOfflineCityNames(provinceAdcode);
        const municipality = isMunicipalityAdcode(provinceAdcode);
        const childDepth = municipality && chain.length >= 3 ? 2 : 1;
        const nodes: RegionNode[] = names.map((label) => {
          const childSelection: GeoMapRegionSelection = municipality
            ? { province: node.selection!.province, district: label }
            : { province: node.selection!.province, city: label };
          const hasChildren =
            !municipality && maxDepth >= 2 && chain.length >= 3 && Boolean(provinceAdcode);
          return {
            key: municipality
              ? `d:${node.selection!.province}:${label}`
              : `c:${node.selection!.province}:${label}`,
            label,
            depth: childDepth,
            selection: childSelection,
            hasChildren,
          };
        });
        loadedKeysRef.current.add(node.key);
        setChildrenByKey((prev) => new Map(prev).set(node.key, nodes));
      } finally {
        setLoadingKeys((prev) => {
          const next = new Set(prev);
          next.delete(node.key);
          return next;
        });
      }
    },
    [chain.length, maxDepth],
  );

  const loadDistricts = useCallback(async (node: RegionNode) => {
    if (!node.selection?.province || !node.selection.city || loadedKeysRef.current.has(node.key)) {
      return;
    }
    setLoadingKeys((prev) => new Set(prev).add(node.key));
    try {
      const cityAdcode = await resolveGeoMapCityAdcode(node.selection.province, node.selection.city);
      if (!cityAdcode) return;
      const names = await listOfflineDistrictNames(cityAdcode);
      const nodes: RegionNode[] = names.map((label) => ({
        key: `d:${node.selection!.province}:${node.selection!.city}:${label}`,
        label,
        depth: 2,
        selection: {
          province: node.selection!.province,
          city: node.selection!.city,
          district: label,
        },
        hasChildren: false,
      }));
      loadedKeysRef.current.add(node.key);
      setChildrenByKey((prev) => new Map(prev).set(node.key, nodes));
    } finally {
      setLoadingKeys((prev) => {
        const next = new Set(prev);
        next.delete(node.key);
        return next;
      });
    }
  }, []);

  const toggleExpand = useCallback(
    (node: RegionNode) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(node.key)) next.delete(node.key);
        else next.add(node.key);
        return next;
      });
      if (node.hasChildren && node.depth === 0) void loadChildren(node);
      if (node.hasChildren && node.depth === 1 && node.selection?.city) void loadDistricts(node);
    },
    [loadChildren, loadDistricts],
  );

  const persistStack = useCallback(
    (stack: GeoMapRegionSelection | null) => {
      const frames = stack ? buildGeoMapDrillStackFromSelection(cfg, stack) : [];
      const nextCfg = patchChartDeStyleNested(cfg, "geo", {
        // 与 ChartRenderer 一致：空栈用 undefined，避免 [] 与滞后 config 互踩
        manualDrillStack: frames.length ? frames : undefined,
      });
      onChange(nextCfg);
      if (drill.active) {
        if (frames.length) drill.setStack(frames);
        else drill.reset();
      }
    },
    [cfg, drill, onChange],
  );

  const applySelection = useCallback(
    async (nextSelection: GeoMapRegionSelection | null) => {
      setError(null);
      if (!nextSelection) {
        persistStack(null);
        setOpen(false);
        return;
      }
      const stack = buildGeoMapDrillStackFromSelection(cfg, nextSelection);
      const result = await validateManualGeoMapDrillStack(cfg, stack);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      persistStack(nextSelection);
      setOpen(false);
    },
    [cfg, persistStack],
  );

  useEffect(() => {
    if (!open) return;
    if (!selection?.province) return;
    const provinceKey = `p:${selection.province}`;
    setExpanded((prev) => new Set(prev).add(provinceKey));
    const provinceNode = rootNodes.find((node) => node.key === provinceKey);
    if (provinceNode?.hasChildren) void loadChildren(provinceNode);
  }, [loadChildren, open, rootNodes, selection?.province]);

  useEffect(() => {
    if (!open || !selection?.province || !selection.city) return;
    const cityKey = `c:${selection.province}:${selection.city}`;
    setExpanded((prev) => new Set(prev).add(cityKey));
    const provinceKey = `p:${selection.province}`;
    const cityNode = childrenByKey.get(provinceKey)?.find((node) => node.key === cityKey);
    if (cityNode?.hasChildren) void loadDistricts(cityNode);
  }, [childrenByKey, loadDistricts, open, selection?.city, selection?.province]);

  const renderNode = (node: RegionNode, indent: number) => {
    const selected = nodeMatchesSelection(node, selection);
    const isExpanded = expanded.has(node.key);
    const loading = loadingKeys.has(node.key);
    const children = childrenByKey.get(node.key) ?? [];

    return (
      <div key={node.key}>
        <div
          className={cn(
            "flex min-h-8 items-center gap-0.5 rounded-md pr-1 text-[11px]",
            selected
              ? "bg-gray-100 text-gray-900 dark:bg-white/10 dark:text-white"
              : "text-gray-700 dark:text-gray-300",
          )}
          style={{ paddingLeft: `${indent * 12 + 4}px` }}
        >
          {node.hasChildren ? (
            <button
              type="button"
              className="inline-flex size-6 shrink-0 items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-white/10"
              aria-label={isExpanded ? "收起" : "展开"}
              onClick={() => toggleExpand(node)}
            >
              {loading ? (
                <Loader2 className="size-3 animate-spin opacity-60" />
              ) : isExpanded ? (
                <ChevronDown className="size-3.5 opacity-70" />
              ) : (
                <ChevronRight className="size-3.5 opacity-70" />
              )}
            </button>
          ) : (
            <span className="inline-block size-6 shrink-0" aria-hidden />
          )}
          <button
            type="button"
            className="min-w-0 flex-1 truncate py-1 text-left hover:underline"
            onClick={() => void applySelection(node.selection)}
          >
            {node.label}
          </button>
        </div>
        {node.hasChildren && isExpanded
          ? children.map((child) => renderNode(child, indent + 1))
          : null}
      </div>
    );
  };

  return (
    <div className="grid gap-1.5" data-testid="chart-map-region-picker">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
          地区
          <span className="ml-0.5 text-error-500" aria-hidden>
            *
          </span>
        </Label>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">手动下钻</span>
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              INSPECTOR_SELECT_TRIGGER,
              "flex h-9 items-center justify-between border-brand-200 bg-brand-50/40 text-left dark:border-brand-500/30 dark:bg-brand-500/10",
            )}
            aria-label="选择地图地区"
            aria-expanded={open}
            data-testid="chart-map-region-picker-trigger"
          >
            <span className="truncate font-medium text-gray-900 dark:text-white/90">{displayLabel}</span>
            <ChevronDown
              className={cn("size-3.5 shrink-0 opacity-60 transition-transform", open && "rotate-180")}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          avoidCollisions
          className="z-[100000] w-[var(--radix-popover-trigger-width)] p-1"
        >
          <div className="max-h-64 overflow-y-auto py-0.5" data-testid="chart-map-region-tree">
            {rootNodes.map((node) => renderNode(node, 0))}
          </div>
        </PopoverContent>
      </Popover>
      <p className={INSPECTOR_HINT}>
        从中国省级起选（无「世界」层）；与双击地图下钻等效，画布会同步切换层级
      </p>
      {error ? <p className="text-[10px] text-error-600 dark:text-error-400">{error}</p> : null}
      <span className="sr-only" data-testid="chart-map-region-stack-revision">
        {stackRevision}
      </span>
    </div>
  );
}

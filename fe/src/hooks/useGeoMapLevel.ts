import { useEffect, useRef, useState } from "react";
import type { ChartDrillFrame } from "@/lib/chartDrill";
import type { ChartViewConfig } from "@/lib/chartViewConfig";
import {
  resolveGeoMapLevelContext,
  type GeoMapLevelContext,
} from "@/lib/geoMapLevels";
import { VS_REGIONS_MAP_ID, listVsRegionNames } from "@/lib/geoMapChart";
import { withMapLoadTimeout } from "@/components/charts/engine/geo/geoConstants";

export const GEO_MAP_LEVEL_LOAD_FAILED_MSG =
  "地图层级加载失败，请返回上一级或重试";

function createProvinceContext(): GeoMapLevelContext {
  return {
    mapId: VS_REGIONS_MAP_ID,
    knownRegionNames: listVsRegionNames(),
    drillDepth: 0,
    levelLabel: "省级",
  };
}

type Options = {
  enabled: boolean;
  config?: ChartViewConfig;
  drillStack: ChartDrillFrame[];
};

/** 地图层级已解析且与下钻栈深度一致（失败时带 missingAsset 也算就绪） */
export function isGeoMapLevelReady(
  drillStack: ChartDrillFrame[],
  level: GeoMapLevelContext,
  resolving: boolean,
): boolean {
  if (resolving) return false;
  if (drillStack.length === 0) return level.drillDepth === 0;
  if (level.missingAsset) return true;
  return level.drillDepth === drillStack.length;
}

export function useGeoMapLevel({ enabled, config, drillStack }: Options) {
  const [context, setContext] = useState<GeoMapLevelContext>(createProvinceContext);
  const [version, setVersion] = useState(0);
  const stackKey = drillStack.map((frame) => `${frame.field}:${frame.value}`).join("|");
  const [resolvedStackKey, setResolvedStackKey] = useState("");
  const configRef = useRef(config);
  const stackRef = useRef(drillStack);
  const requestSeqRef = useRef(0);
  configRef.current = config;
  stackRef.current = drillStack;

  const resolving = Boolean(enabled && config && stackKey !== resolvedStackKey);

  useEffect(() => {
    if (!enabled || !configRef.current) {
      setContext(createProvinceContext());
      setResolvedStackKey("");
      return;
    }

    let cancelled = false;
    const requestKey = stackKey;
    const seq = ++requestSeqRef.current;
    void withMapLoadTimeout(
      resolveGeoMapLevelContext({
        config: configRef.current,
        drillStack: stackRef.current,
      }),
    )
      .then((next) => {
        if (cancelled || seq !== requestSeqRef.current) return;
        setContext(next);
        setResolvedStackKey(requestKey);
        setVersion((v) => v + 1);
      })
      .catch(() => {
        if (cancelled || seq !== requestSeqRef.current) return;
        setContext({
          ...createProvinceContext(),
          missingAsset: GEO_MAP_LEVEL_LOAD_FAILED_MSG,
        });
        setResolvedStackKey(requestKey);
        setVersion((v) => v + 1);
      });

    return () => {
      cancelled = true;
    };
    // 仅跟 stackKey / enabled：避免父组件每次新建 config 对象导致 resolve 被反复 cancel
  }, [enabled, stackKey]);

  return { context, loading: resolving, version };
}

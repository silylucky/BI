import { useCallback, useMemo, useRef, useState } from "react";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import { componentDetailToLayoutWidget } from "@/lib/vizComponentPageUtils";
import { listVizComponentsMissingThumbnail } from "@/lib/listVizComponentsMissingThumbnail";
import { vizComponentPreviewDashboardStyle } from "@/lib/vizComponentPreviewStyle";
import { fetchVizComponent } from "@/lib/vizComponents";
import { persistVizComponentThumbnailBestEffort } from "@/lib/uploadVizComponentThumbnail";
import {
  findVizComponentThumbnailCaptureRoot,
  waitForGisMapCaptureReady,
  waitForThumbnailCaptureReady,
} from "@/lib/captureDashboardThumbnail";

export type VizComponentThumbnailBatchProgress = {
  current: number;
  total: number;
  name: string;
};

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitForStudioThumbnailReady(): Promise<void> {
  await waitForPaint();
  const root = await waitForThumbnailCaptureReady(findVizComponentThumbnailCaptureRoot, 15_000);
  await waitForGisMapCaptureReady(root, 35_000);
}

export function useVizComponentThumbnailBatch(includeDrafts: boolean) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<VizComponentThumbnailBatchProgress | null>(null);
  const [activeWidget, setActiveWidget] = useState<LayoutWidget | null>(null);
  const [studioKey, setStudioKey] = useState(0);
  const cancelRef = useRef(false);
  const dashboardStyle = useMemo(() => vizComponentPreviewDashboardStyle(), []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const run = useCallback(async (): Promise<{ ok: number; failed: number }> => {
    if (running) return { ok: 0, failed: 0 };
    cancelRef.current = false;
    setRunning(true);
    let ok = 0;
    let failed = 0;

    try {
      const ids = await listVizComponentsMissingThumbnail(includeDrafts);
      if (ids.length === 0) return { ok: 0, failed: 0 };

      for (let index = 0; index < ids.length; index += 1) {
        if (cancelRef.current) break;
        const id = ids[index]!;
        const detail = await fetchVizComponent(id);
        setProgress({ current: index + 1, total: ids.length, name: detail.name });
        setActiveWidget(componentDetailToLayoutWidget(detail));
        setStudioKey((key) => key + 1);
        await waitForStudioThumbnailReady();

        const result = await persistVizComponentThumbnailBestEffort(id);
        if (result.ok) ok += 1;
        else failed += 1;
      }
    } finally {
      setRunning(false);
      setProgress(null);
      setActiveWidget(null);
      cancelRef.current = false;
    }

    return { ok, failed };
  }, [includeDrafts, running]);

  return {
    running,
    progress,
    activeWidget,
    studioKey,
    dashboardStyle,
    run,
    cancel,
  };
}

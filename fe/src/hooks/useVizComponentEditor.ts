import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { LayoutWidget } from "@/components/dashboard/layoutUtils";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";
import {
  componentDetailToLayoutWidget,
  buildSingleComponentMap,
  componentEditorSnapshot,
  widgetEditorSnapshot,
} from "@/lib/vizComponentPageUtils";
import {
  extractWidgetPayload,
  fetchVizComponent,
  updateVizComponent,
  type VizComponentDetail,
} from "@/lib/vizComponents";
import {
  captureVizComponentEditThumbnailBlob,
  uploadVizComponentThumbnailBlob,
} from "@/lib/uploadVizComponentThumbnail";

function invalidateVizComponentCaches(queryClient: ReturnType<typeof useQueryClient>, id: string) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.vizComponents.all });
  void queryClient.invalidateQueries({ queryKey: queryKeys.vizComponents.detail(id) });
}

export function useVizComponentEditor(componentId: string | undefined) {
  const queryClient = useQueryClient();
  const [widget, setWidget] = useState<LayoutWidget | null>(null);
  const [saving, setSaving] = useState(false);
  const hydratedRevisionRef = useRef<number | null>(null);

  const detailQuery = useQuery({
    queryKey: queryKeys.vizComponents.detail(componentId ?? ""),
    queryFn: () => fetchVizComponent(componentId!),
    enabled: Boolean(componentId),
  });

  const component = detailQuery.data ?? null;
  const componentMap = component ? buildSingleComponentMap(component) : new Map();

  useEffect(() => {
    if (!component) return;
    if (widget !== null && hydratedRevisionRef.current === component.contentRevision) {
      return;
    }
    hydratedRevisionRef.current = component.contentRevision;
    setWidget(componentDetailToLayoutWidget(component));
  }, [component, widget]);

  const isDirty = useMemo(() => {
    if (!component || !widget) return false;
    return widgetEditorSnapshot(widget) !== componentEditorSnapshot(component);
  }, [component, widget]);

  const applyDetail = useCallback(
    (detail: VizComponentDetail) => {
      queryClient.setQueryData(queryKeys.vizComponents.detail(detail.id), detail);
      invalidateVizComponentCaches(queryClient, detail.id);
      hydratedRevisionRef.current = detail.contentRevision;
      setWidget(componentDetailToLayoutWidget(detail));
    },
    [queryClient],
  );

  const save = useCallback(async (): Promise<boolean> => {
    if (!component || !widget) return false;
    if (!isDirty) return false;
    setSaving(true);
    try {
      let thumbnailBlob: Blob | null = null;
      try {
        thumbnailBlob = await captureVizComponentEditThumbnailBlob();
      } catch (err) {
        console.warn("[viz-component-save] thumbnail capture failed", err);
      }

      if (isDirty) {
        const updated = await updateVizComponent(component.id, {
          name: widget.title?.trim() || component.name,
          payloadJson: extractWidgetPayload(widget),
          contentRevision: component.contentRevision,
        });
        applyDetail(updated);
      }

      let thumbnailUploaded = false;
      let thumbnailUploadError = "";
      if (thumbnailBlob) {
        try {
          await uploadVizComponentThumbnailBlob(component.id, thumbnailBlob);
          thumbnailUploaded = true;
          invalidateVizComponentCaches(queryClient, component.id);
        } catch (err) {
          thumbnailUploadError = err instanceof Error ? err.message : String(err);
          console.warn("[viz-component-save] thumbnail upload failed", err);
        }
      }

      if (!thumbnailUploaded) {
        const captureFailed = !thumbnailBlob;
        const description = !captureFailed && thumbnailUploadError.includes("404")
          ? "封面上传接口不可用（后端可能未重启到最新版本）。请重启 backend 后再试。"
          : captureFailed
            ? "请确认左侧预览已加载完成后再保存。"
            : thumbnailUploadError || "请确认左侧预览已加载完成后再保存。";
        toast.warning(
          isDirty
            ? captureFailed
              ? "组件已保存，但封面截图失败"
              : "组件已保存，但封面上传失败"
            : captureFailed
              ? "封面截图失败"
              : "封面上传失败",
          { description },
        );
      } else {
        toast.success("组件已保存");
      }
      return true;
    } catch (err) {
      const message = mapApiError(err);
      toast.error(message);
      if (message.includes("contentRevision") || message.includes("冲突")) {
        void detailQuery.refetch();
      }
      return false;
    } finally {
      setSaving(false);
    }
  }, [applyDetail, component, detailQuery, isDirty, queryClient, widget]);

  const patchWidget = useCallback((patch: Partial<LayoutWidget>) => {
    setWidget((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  return {
    component,
    widget,
    componentMap,
    saving,
    isDirty,
    isLoading: detailQuery.isLoading,
    isError: detailQuery.isError,
    error: detailQuery.error,
    refetch: detailQuery.refetch,
    save,
    patchWidget,
  };
}

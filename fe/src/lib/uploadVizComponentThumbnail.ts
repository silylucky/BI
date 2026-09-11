import { apiUploadBlob } from "@/lib/apiUpload";
import {
  assertUsableImageBlob,
  captureDashboardThumbnailBlob,
  findDashboardWidgetCaptureRoot,
  findVizComponentThumbnailCaptureRoot,
  waitForGisMapCaptureReady,
  waitForThumbnailCaptureReady,
} from "@/lib/captureDashboardThumbnail";

async function uploadThumbnailBlob(componentId: string, blob: Blob): Promise<void> {
  assertUsableImageBlob(blob);
  const contentType = (blob.type || "image/png").split(";")[0]?.trim() || "image/png";
  await apiUploadBlob(`/api/v1/viz-components/${componentId}/thumbnail`, blob, contentType);
}

export async function captureVizComponentEditThumbnailBlob(): Promise<Blob> {
  const root = await waitForThumbnailCaptureReady(findVizComponentThumbnailCaptureRoot, 12_000);
  await waitForGisMapCaptureReady(root);
  const blob = await captureDashboardThumbnailBlob(root);
  assertUsableImageBlob(blob);
  return blob;
}

export async function uploadVizComponentThumbnailBlob(componentId: string, blob: Blob): Promise<void> {
  await uploadThumbnailBlob(componentId, blob);
}

async function captureDashboardWidgetThumbnailBlob(widgetId: string): Promise<Blob> {
  const root = await waitForThumbnailCaptureReady(() => findDashboardWidgetCaptureRoot(widgetId), 12_000);
  await waitForGisMapCaptureReady(root);
  const blob = await captureDashboardThumbnailBlob(root);
  assertUsableImageBlob(blob);
  return blob;
}

export async function persistVizComponentThumbnail(componentId: string): Promise<void> {
  const blob = await captureVizComponentEditThumbnailBlob();
  await uploadThumbnailBlob(componentId, blob);
}

export async function persistVizComponentThumbnailFromWidget(
  componentId: string,
  widgetId: string,
): Promise<void> {
  const blob = await captureDashboardWidgetThumbnailBlob(widgetId);
  await uploadThumbnailBlob(componentId, blob);
}

export type VizComponentThumbnailPersistResult =
  | { ok: true }
  | { ok: false; stage: "capture" | "upload"; message: string };

/** 封面失败不阻断保存；须在离开编辑页之前 await */
export async function persistVizComponentThumbnailBestEffort(
  componentId: string,
): Promise<VizComponentThumbnailPersistResult> {
  let blob: Blob;
  try {
    blob = await captureVizComponentEditThumbnailBlob();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[viz-component-save] thumbnail capture failed", err);
    return { ok: false, stage: "capture", message };
  }
  try {
    await uploadThumbnailBlob(componentId, blob);
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[viz-component-save] thumbnail upload failed", err);
    return { ok: false, stage: "upload", message };
  }
}

/** 看板发布到组件库：从画布 widget 截取封面，失败不阻断发布 */
export async function persistVizComponentThumbnailFromWidgetBestEffort(
  componentId: string,
  widgetId: string,
): Promise<boolean> {
  try {
    await persistVizComponentThumbnailFromWidget(componentId, widgetId);
    return true;
  } catch (err) {
    console.warn("[viz-component-publish] thumbnail upload failed", err);
    return false;
  }
}

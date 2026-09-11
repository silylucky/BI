import { apiUploadBlob } from "@/lib/apiUpload";
import {
  assertUsableImageBlob,
  captureDashboardThumbnailBlob,
  findDashboardThumbnailCaptureRoot,
} from "@/lib/captureDashboardThumbnail";

export async function persistDashboardThumbnail(dashboardId: string): Promise<void> {
  const root = findDashboardThumbnailCaptureRoot();
  if (!root) {
    throw new Error("未找到可截图的画布区域");
  }
  const blob = await captureDashboardThumbnailBlob(root);
  assertUsableImageBlob(blob);
  const contentType = (blob.type || "image/png").split(";")[0]?.trim() || "image/png";
  await apiUploadBlob(`/api/v1/dashboards/${dashboardId}/thumbnail`, blob, contentType);
}

/** 封面失败不阻断保存；须在 resetLayout / 离开编辑页之前 await */
export async function persistDashboardThumbnailBestEffort(dashboardId: string): Promise<boolean> {
  try {
    await persistDashboardThumbnail(dashboardId);
    return true;
  } catch (err) {
    console.warn("[dashboard-save] thumbnail upload failed", err);
    return false;
  }
}

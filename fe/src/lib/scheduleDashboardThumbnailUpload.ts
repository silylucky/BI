import { persistDashboardThumbnailBestEffort } from "./uploadDashboardThumbnail";

type ScheduleDashboardThumbnailUploadOptions = {
  onUploaded?: () => void;
};

/**
 * @deprecated 保存路径应直接 await persistDashboardThumbnailBestEffort。
 * 保留给测试兼容：立即执行，不再延迟。
 */
export function scheduleDashboardThumbnailUpload(
  dashboardId: string,
  options?: ScheduleDashboardThumbnailUploadOptions,
): void {
  void persistDashboardThumbnailBestEffort(dashboardId).then((uploaded) => {
    if (uploaded) options?.onUploaded?.();
  });
}

import { useSyncExternalStore } from "react";
import {
  getAdminHeavyRenderSuspendSnapshot,
  subscribeAdminHeavyRenderSuspend,
} from "@/lib/adminHeavyRenderSuspend";

/** 导航过渡期间为 true：列表卡片应停渲染图表/3D 预览 */
export function useAdminHeavyRenderSuspended(): boolean {
  return useSyncExternalStore(
    subscribeAdminHeavyRenderSuspend,
    getAdminHeavyRenderSuspendSnapshot,
    () => false,
  );
}

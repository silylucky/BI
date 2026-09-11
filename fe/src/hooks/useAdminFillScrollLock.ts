import { useLayoutEffect } from "react";

const LOCK_CLASS = "admin-fill-lock";

/** fill 高度路由：锁住 html/body 滚动，避免右栏内容撑出第二条页面滚动条 */
export function useAdminFillScrollLock(enabled: boolean) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.classList.add(LOCK_CLASS);
    return () => {
      root.classList.remove(LOCK_CLASS);
    };
  }, [enabled]);
}

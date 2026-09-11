import { useEffect } from "react";
import { useLocation } from "react-router";
import { endAdminNavTransition } from "@/lib/adminHeavyRenderSuspend";
import { markAdminNavShellReady, markAdminNavStart } from "@/lib/adminNavPerf";

/** 记录侧栏切换 → 壳层就绪耗时（dev 控制台 + Performance marks） */
export function AdminNavPerfTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    markAdminNavStart(pathname);
    const frame = requestAnimationFrame(() => {
      markAdminNavShellReady(pathname);
      endAdminNavTransition();
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}

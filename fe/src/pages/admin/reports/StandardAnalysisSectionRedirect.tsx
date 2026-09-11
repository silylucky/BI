import { Navigate, useLocation } from "react-router";

/** 兼容旧深链：统一到 `/admin/reports/standard/results` 或 `/setup`。 */
export function StandardAnalysisLegacyRedirect({ target }: { target: "results" | "setup" }) {
  const { search } = useLocation();
  return <Navigate to={`/admin/reports/standard/${target}${search}`} replace />;
}

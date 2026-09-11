import { Navigate, useParams } from "react-router";
import { dataScreenPreviewPath } from "@/lib/dataScreenLayout";

/** 大屏查看路由统一重定向至全屏投放预览（Wave A1） */
export function DataScreenViewRedirect() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/admin/data-screens" replace />;
  return <Navigate to={dataScreenPreviewPath(id)} replace />;
}

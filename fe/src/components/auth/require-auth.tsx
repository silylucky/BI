import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "@/context/auth-context";
import { getAuthToken } from "@/lib/auth-token";

export function RequireAuth() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const hasToken = Boolean(getAuthToken());

  if (!hasToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

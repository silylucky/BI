import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getAppBasePath } from "@/lib/appBasePath";
import { mapApiError } from "@/lib/apiError";
import { WORKSPACE_HOME_PATH } from "@/lib/workspace";

function isStaleDynamicImportError(error: Error): boolean {
  return /Failed to fetch dynamically imported module/i.test(error.message);
}

function formatRouteErrorMessage(error: Error): string {
  if (isStaleDynamicImportError(error)) {
    if (import.meta.env.DEV) {
      const base = getAppBasePath();
      const baseHint = base ? `请确认地址以 ${base}/ 开头，` : "";
      return `${error.message}。开发环境常见原因：Vite 重启或修改 .env 后浏览器缓存了旧模块。${baseHint}请使用「刷新页面」或 Ctrl+Shift+R 强制刷新。`;
    }
    return "页面脚本版本已更新，浏览器仍在使用旧缓存。请点击「刷新页面」或按 Ctrl+Shift+R 强制刷新后再试。";
  }
  if (!import.meta.env.DEV) return mapApiError(error);
  return error.message || mapApiError(error);
}

type BoundaryState = { error: Error | null };

type RouteErrorBoundaryClassProps = {
  children: ReactNode;
  scope: "route" | "app";
};

class RouteErrorBoundaryClass extends Component<
  RouteErrorBoundaryClassProps,
  BoundaryState
> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const tag = this.props.scope === "app" ? "[AppErrorBoundary]" : "[RouteErrorBoundary]";
    console.error(tag, error, info.componentStack);
  }

  private handleRetry = () => {
    const { error } = this.state;
    if (error && isStaleDynamicImportError(error)) {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isApp = this.props.scope === "app";
    return (
      <div
        role="alert"
        className={
          isApp
            ? "flex min-h-screen items-center justify-center bg-gray-50 p-6 dark:bg-gray-900"
            : "flex min-h-[240px] flex-1 flex-col items-center justify-center p-6"
        }
      >
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertTriangle className="size-8 text-error-500" aria-hidden />
            <p className="text-theme-sm font-medium text-gray-800 dark:text-white/90">
              {isApp ? "应用加载失败" : "页面加载失败"}
            </p>
            <p className="text-theme-xs text-gray-500 dark:text-gray-400">
              {formatRouteErrorMessage(error)}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={this.handleRetry}>
                {isStaleDynamicImportError(error) ? "刷新页面" : "重试"}
              </Button>
              {!isApp ? (
                <Button type="button" variant="ghost" size="sm" asChild>
                  <Link to={WORKSPACE_HOME_PATH}>返回首页</Link>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  刷新页面
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}

/** 路由切换时随 pathname remount，自动清除上一页错误态 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <RouteErrorBoundaryClass key={pathname} scope="route">
      {children}
    </RouteErrorBoundaryClass>
  );
}

export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return <RouteErrorBoundaryClass scope="app">{children}</RouteErrorBoundaryClass>;
}

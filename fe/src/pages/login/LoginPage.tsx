import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import { Loader2, Lock, LogIn, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoginBrandAside, LoginMobileBrandMark, LOGIN_PAGE_COPYRIGHT } from "./LoginBrandAside";
import { ThemeToggleButton } from "@/components/layout/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { ApiRequestError, fetchWithTimeout } from "@/lib/api";
import { clearAuthToken, setAuthToken } from "@/lib/auth-token";
import { mapApiError } from "@/lib/apiError";
import { resolveApiBaseUrl } from "@/lib/appBasePath";
import { resolveDefaultDashboardPath } from "@/lib/defaultViewResolve";
import { cn } from "@/lib/utils";

type LoginResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
};

function LoginFormPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, refresh } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/admin";

  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const API_BASE = resolveApiBaseUrl();
      const response = await fetchWithTimeout(`${API_BASE}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = (await response.json().catch(() => ({}))) as LoginResponse & {
        access_token?: string;
        code?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new ApiRequestError(body.message ?? "用户名或密码错误", body.code);
      }
      const accessToken = body.accessToken ?? body.access_token;
      if (!accessToken) {
        throw new ApiRequestError("登录响应无效，缺少 accessToken", "AUTH_CONTEXT_UNAVAILABLE");
      }
      setAuthToken(accessToken);
      const me = await refresh();
      if (!me) {
        clearAuthToken();
        throw new ApiRequestError("登录失败，无法获取用户信息", "AUTH_CONTEXT_UNAVAILABLE");
      }
      const resolved = await resolveDefaultDashboardPath(me.roles ?? []);
      navigate(resolved ?? from, { replace: true });
    } catch (err) {
      setError(mapApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-1 flex-col bg-gray-50 dark:bg-gray-950">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -right-20 top-0 size-72 rounded-full bg-brand-500/10 blur-3xl dark:bg-brand-500/15" />
        <div className="absolute bottom-0 left-0 size-64 rounded-full bg-brand-300/10 blur-3xl dark:bg-brand-400/10" />
      </div>

      <header className="relative z-20 flex shrink-0 items-center justify-between px-4 pt-4 sm:px-6 sm:pt-6 lg:hidden">
        <LoginMobileBrandMark />
        <ThemeToggleButton className="size-10" />
      </header>

      <div className="absolute right-4 top-4 z-20 hidden sm:right-6 sm:top-6 lg:block">
        <ThemeToggleButton className="size-10" />
      </div>

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 pb-10 pt-4 sm:px-6">
        <div className="w-full max-w-[26rem]">
          <div
            className={cn(
              "rounded-3xl border border-gray-200/80 bg-white/90 p-6 shadow-theme-md backdrop-blur-sm",
              "dark:border-gray-800 dark:bg-gray-900/80 dark:shadow-none sm:p-8",
            )}
          >
            <div className="mb-6 space-y-2 text-center lg:text-left">
              <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">
                欢迎回来
              </h2>
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                使用管理员账号登录 VitalSpan 管理后台
              </p>
            </div>

            <form className="grid gap-5" onSubmit={(e) => void handleSubmit(e)}>
              {error ? (
                <div
                  className="rounded-xl border border-error-500/30 bg-error-50 px-3 py-2.5 text-theme-sm text-error-700 dark:bg-error-500/10 dark:text-error-400"
                  role="alert"
                >
                  {error}
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="username">用户名</Label>
                <div className="relative">
                  <UserRound
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                    aria-hidden
                  />
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    autoFocus
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="pl-10"
                    placeholder="请输入用户名"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                    aria-hidden
                  />
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    placeholder="请输入密码"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="mt-1 h-11 w-full rounded-xl text-theme-sm font-semibold shadow-theme-sm"
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <LogIn className="size-4" aria-hidden />
                )}
                {submitting ? "登录中…" : "登录"}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400 dark:text-gray-500">
            登录即表示您已获授权访问本系统，请妥善保管账号凭证。
          </p>
          <p className="mt-3 text-center text-[11px] text-gray-400/80 dark:text-gray-500/80 lg:hidden">
            {LOGIN_PAGE_COPYRIGHT}
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  return (
    <ThemeProvider>
      <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
        <LoginBrandAside />
        <LoginFormPanel />
      </div>
    </ThemeProvider>
  );
}

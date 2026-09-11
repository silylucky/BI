import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RestApiAuthMode, RestApiCompanionState } from "./datasource-form-types";
import { normalizeBaseUrl } from "./datasource-form-types";

type Props = {
  value: RestApiCompanionState;
  onChange: (next: RestApiCompanionState) => void;
};

export function RestApiConnectionFields({ value, onChange }: Props) {
  const set = <K extends keyof RestApiCompanionState>(key: K, v: RestApiCompanionState[K]) =>
    onChange({ ...value, [key]: v });

  const passwordLabel =
    value.authMode === "bearer" ? "Bearer Token" : value.authMode === "basic" ? "密码" : "密码/Token";

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="rest-base-url">Base URL</Label>
        <Input
          id="rest-base-url"
          value={value.baseUrl}
          onChange={(e) => set("baseUrl", e.target.value)}
          onBlur={() => set("baseUrl", normalizeBaseUrl(value.baseUrl))}
          placeholder="http://127.0.0.1:8000"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="rest-auth-mode">认证方式</Label>
        <Select
          value={value.authMode}
          onValueChange={(v) => set("authMode", v as RestApiAuthMode)}
        >
          <SelectTrigger id="rest-auth-mode" aria-label="认证方式">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">无</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="bearer">Bearer</SelectItem>
            <SelectItem value="oauth2">OAuth2（预览）</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.authMode === "basic" ? (
        <div className="grid gap-2">
          <Label htmlFor="rest-username">用户名</Label>
          <Input
            id="rest-username"
            value={value.username}
            onChange={(e) => set("username", e.target.value)}
            required
          />
        </div>
      ) : null}
      {value.authMode === "basic" || value.authMode === "bearer" ? (
        <div className="grid gap-2">
          <Label htmlFor="rest-password">{passwordLabel}</Label>
          <Input
            id="rest-password"
            type="password"
            value={value.password}
            onChange={(e) => set("password", e.target.value)}
            required
            autoComplete="new-password"
          />
        </div>
      ) : null}
      {value.authMode === "oauth2" ? (
        <>
          <Alert severity="info" role="status">
            <AlertDescription className="text-theme-sm">
              OAuth2 客户端凭证连通将在后续版本启用；当前请使用 Basic 或 Bearer。
            </AlertDescription>
          </Alert>
          <div className="grid gap-2">
            <Label htmlFor="rest-oauth-client">OAuth2 客户端 ID</Label>
            <Input id="rest-oauth-client" disabled value="" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rest-oauth-token-url">OAuth2 Token URL</Label>
            <Input id="rest-oauth-token-url" disabled value="" />
          </div>
        </>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="rest-health-path">健康检查路径</Label>
        <Input
          id="rest-health-path"
          value={value.healthPath}
          onChange={(e) => set("healthPath", e.target.value)}
          placeholder="/sample-api/health"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="rest-timeout">连接超时（秒）</Label>
        <Input
          id="rest-timeout"
          type="number"
          min={1}
          max={30}
          value={value.connectTimeoutSec}
          onChange={(e) => set("connectTimeoutSec", Number(e.target.value))}
        />
      </div>
    </div>
  );
}

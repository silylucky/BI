import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RoapiCompanionState } from "./datasource-form-types";
import { normalizeBaseUrl } from "./datasource-form-types";

type Props = {
  value: RoapiCompanionState;
  onChange: (next: RoapiCompanionState) => void;
};

export function RoapiConnectionFields({ value, onChange }: Props) {
  const set = <K extends keyof RoapiCompanionState>(key: K, v: RoapiCompanionState[K]) =>
    onChange({ ...value, [key]: v });

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="roapi-base-url">RoAPI 地址</Label>
        <Input
          id="roapi-base-url"
          value={value.baseUrl}
          onChange={(e) => set("baseUrl", e.target.value)}
          onBlur={() => set("baseUrl", normalizeBaseUrl(value.baseUrl))}
          placeholder="http://127.0.0.1:8086"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="roapi-bearer">Bearer Token（可选）</Label>
        <Input
          id="roapi-bearer"
          type="password"
          value={value.bearerToken}
          onChange={(e) => set("bearerToken", e.target.value)}
          autoComplete="new-password"
          placeholder="内网 RoAPI 若未启用认证可留空"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="roapi-schema-path">Schema 探测路径</Label>
        <Input
          id="roapi-schema-path"
          value={value.schemaPath}
          onChange={(e) => set("schemaPath", e.target.value)}
          placeholder="/api/schema"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="roapi-timeout">连接超时（秒）</Label>
        <Input
          id="roapi-timeout"
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

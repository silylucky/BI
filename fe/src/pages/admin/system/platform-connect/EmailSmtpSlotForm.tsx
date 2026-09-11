import { useMutation, useQueryClient } from "@tanstack/react-query";
import { KeyRound, Server } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { EMAIL_SMTP_SLOTS, type EmailSmtpSlot } from "@/lib/emailSmtpSlots";
import { queryKeys } from "@/lib/queryKeys";
import {
  ConnectActionBar,
  ConnectField,
  ConnectFormSection,
  SLOT_SETUP_HINT,
  SOURCE_LABEL,
  type EmailConfigSummary,
} from "./platformConnectUi";

type EmailConfig = EmailConfigSummary & {
  username?: string | null;
  hasPassword: boolean;
  probeError?: string | null;
};

type SlotFormState = {
  host: string;
  port: string;
  from: string;
  username: string;
  password: string;
};

function presetFor(slot: EmailSmtpSlot): SlotFormState {
  const preset = EMAIL_SMTP_SLOTS.find((item) => item.slot === slot)!;
  return {
    host: preset.host,
    port: String(preset.port),
    from: "",
    username: "",
    password: "",
  };
}

export function EmailSmtpSlotForm({
  config,
  disabled,
  onSaved,
}: {
  config: EmailConfig;
  disabled: boolean;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const preset = EMAIL_SMTP_SLOTS.find((item) => item.slot === config.slot)!;
  const [form, setForm] = useState<SlotFormState>(() => presetFor(config.slot));

  useEffect(() => {
    setForm({
      host: config.host ?? preset.host,
      port: String(config.port ?? preset.port),
      from: config.from ?? "",
      username: config.username ?? "",
      password: "",
    });
  }, [config, preset.host, preset.port]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<EmailConfig>(`/api/v1/platform/delivery/email/${config.slot}`, {
        method: "PUT",
        body: JSON.stringify({
          host: form.host.trim(),
          port: Number(form.port),
          from: form.from.trim(),
          username: form.username.trim() || null,
          password: form.password.trim() || null,
        }),
      }),
    onSuccess: async (data) => {
      toast.success(`${config.label} SMTP 已保存并通过探测`);
      setForm((prev) => ({ ...prev, password: "" }));
      await qc.invalidateQueries({ queryKey: queryKeys.platformConnect.emailSlots });
      await qc.invalidateQueries({ queryKey: queryKeys.platformConnect.emailSlot(config.slot) });
      await qc.invalidateQueries({ queryKey: ["reports", "schedules", "delivery-health"] });
      onSaved();
      if (!data.configured) {
        toast.warning("保存成功但当前仍不可用，请检查探测结果");
      }
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const clearMutation = useMutation({
    mutationFn: () =>
      apiFetch<EmailConfig>(`/api/v1/platform/delivery/email/${config.slot}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success(`${config.label} SMTP 配置已清空`);
      setForm((prev) => ({ ...prev, password: "" }));
      await qc.invalidateQueries({ queryKey: queryKeys.platformConnect.emailSlots });
      await qc.invalidateQueries({ queryKey: queryKeys.platformConnect.emailSlot(config.slot) });
      await qc.invalidateQueries({ queryKey: ["reports", "schedules", "delivery-health"] });
      onSaved();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const pending = saveMutation.isPending || clearMutation.isPending;

  return (
    <div className="flex flex-col gap-5">
      <Alert severity={config.configured ? "success" : "warning"} appearance="subtle">
        <AlertTitle>{config.configured ? "当前通道可用" : "当前通道未就绪"}</AlertTitle>
        <AlertDescription className="space-y-1">
          <p>
            来源：{SOURCE_LABEL[config.source] ?? config.source}
            {config.host ? ` · ${config.host}:${config.port}` : null}
          </p>
          {config.probeError ? <p>{config.probeError}</p> : null}
          {!config.configured ? <p>{SLOT_SETUP_HINT[config.slot]}</p> : null}
        </AlertDescription>
      </Alert>

      <ConnectFormSection
        title="SMTP 连接"
        description="服务器地址与端口，保存前将自动探测连通性。"
        icon={Server}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ConnectField
            id={`smtp-host-${config.slot}`}
            label="SMTP 主机"
            hint={`推荐 ${preset.host}`}
            className="sm:col-span-2"
          >
            <Input
              id={`smtp-host-${config.slot}`}
              className="h-11"
              value={form.host}
              onChange={(e) => setForm((prev) => ({ ...prev, host: e.target.value }))}
              placeholder={preset.host}
            />
          </ConnectField>
          <ConnectField id={`smtp-port-${config.slot}`} label="端口" hint="QQ 常用 587，163 常用 465">
            <Input
              id={`smtp-port-${config.slot}`}
              className="h-11"
              value={form.port}
              onChange={(e) => setForm((prev) => ({ ...prev, port: e.target.value }))}
              inputMode="numeric"
            />
          </ConnectField>
        </div>
      </ConnectFormSection>

      <ConnectFormSection
        title="发件账号"
        description="发件人地址与登录凭证；密码请填写邮箱授权码，不是登录密码。"
        icon={KeyRound}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ConnectField
            id={`smtp-from-${config.slot}`}
            label="发件人邮箱"
            hint="收件人看到的发件地址"
          >
            <Input
              id={`smtp-from-${config.slot}`}
              className="h-11"
              value={form.from}
              onChange={(e) => {
                const from = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  from,
                  username: !prev.username.trim() || prev.username === prev.from ? from : prev.username,
                }));
              }}
              placeholder={`reports@${config.slot === "qq" ? "qq.com" : "163.com"}`}
            />
          </ConnectField>
          <ConnectField id={`smtp-user-${config.slot}`} label="登录用户名" hint="须与发件人邮箱相同，填完整地址如 1640298623@qq.com">
            <Input
              id={`smtp-user-${config.slot}`}
              className="h-11"
              value={form.username}
              onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))}
              onBlur={() => {
                if (!form.username.trim() && form.from.trim()) {
                  setForm((prev) => ({ ...prev, username: prev.from.trim() }));
                }
              }}
              placeholder={form.from || `name@${config.slot === "qq" ? "qq.com" : "163.com"}`}
              autoComplete="off"
            />
          </ConnectField>
          <ConnectField
            id={`smtp-pass-${config.slot}`}
            label={
              <span className="inline-flex items-center gap-2">
                密码 / 授权码
                {config.hasPassword && !form.password ? (
                  <Badge variant="light" color="success" size="sm">
                    已加密保存
                  </Badge>
                ) : null}
              </span>
            }
            hint={
              config.hasPassword
                ? form.password
                  ? "将用此次填写的新授权码替换已保存的值"
                  : "出于安全不回显。框内留空表示继续使用已保存的授权码，无需重填"
                : "首次保存必填，请填写邮箱 SMTP 授权码（不是 QQ/163 登录密码）"
            }
            hintClassName={
              config.hasPassword && !form.password
                ? "text-success-700 dark:text-success-400"
                : undefined
            }
            className="sm:col-span-2"
          >
            <Input
              id={`smtp-pass-${config.slot}`}
              className="h-11"
              type="password"
              value={form.password}
              onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
              placeholder={
                config.hasPassword ? "已保存，修改时再填新授权码" : "粘贴邮箱 SMTP 授权码"
              }
              autoComplete="new-password"
            />
          </ConnectField>
        </div>
      </ConnectFormSection>

      <ConnectActionBar hint="保存后将立即探测 SMTP；定时报告可在创建时选择本通道。">
        <Button type="button" variant="primary" disabled={disabled || pending} onClick={() => saveMutation.mutate()}>
          {saveMutation.isPending ? "保存并探测…" : "保存并探测"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled || pending || config.source !== "db"}
          onClick={() => clearMutation.mutate()}
        >
          清空配置
        </Button>
      </ConnectActionBar>
    </div>
  );
}

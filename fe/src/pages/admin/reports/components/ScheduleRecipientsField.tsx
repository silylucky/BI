import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ScheduleRecipient } from "../useReportSchedules";

const ROLE_OPTIONS = [
  { value: "admin", label: "管理员" },
  { value: "analyst", label: "分析师" },
  { value: "viewer", label: "查看者" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidRecipient(row: ScheduleRecipient): boolean {
  if (!row.value.trim()) return false;
  if (row.type === "email") return EMAIL_RE.test(row.value.trim());
  return true;
}

export function hasValidRecipients(recipients: ScheduleRecipient[]): boolean {
  return recipients.some(isValidRecipient);
}

type ScheduleRecipientsFieldProps = {
  value: ScheduleRecipient[];
  onChange: (next: ScheduleRecipient[]) => void;
  disabled?: boolean;
  idPrefix?: string;
  embedded?: boolean;
  /** 区块标题栏已提供「添加」时隐藏字段内按钮 */
  hideAddButton?: boolean;
  /** 仅邮箱收件人（标准分析等纯邮件投递场景） */
  mode?: "full" | "email-only" | "platform-only";
  /** 为 false 时由父级统一展示校验文案 */
  showValidationError?: boolean;
};

export function ScheduleRecipientsField({
  value,
  onChange,
  disabled,
  idPrefix = "schedule-recipient",
  embedded = false,
  hideAddButton = false,
  mode = "full",
  showValidationError = true,
}: ScheduleRecipientsFieldProps) {
  const emailOnly = mode === "email-only";
  const platformOnly = mode === "platform-only";
  const rows = emailOnly
    ? (value.filter((row) => row.type === "email").length > 0
        ? value.filter((row) => row.type === "email")
        : DEFAULT_EMAIL_RECIPIENTS)
    : platformOnly
      ? value.filter((row) => row.type === "role" || row.type === "user").length > 0
        ? value.filter((row) => row.type === "role" || row.type === "user")
        : DEFAULT_RECIPIENTS
    : value;

  const [userFilter, setUserFilter] = useState("");
  const usersQuery = useQuery({
    queryKey: ["users", "schedule-recipients"],
    queryFn: () =>
      apiFetch<{ items: { id: string; username: string }[] }>("/api/v1/users?limit=200"),
    staleTime: 60_000,
  });
  const users = usersQuery.data?.items ?? [];
  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(userFilter.trim().toLowerCase()),
  );
  const hasUserRow = !emailOnly && rows.some((row) => row.type === "user");

  const addRow = () => {
    onChange(
      emailOnly
        ? [...rows, { type: "email", value: "" }]
        : platformOnly
          ? [...rows, { type: "role", value: "admin" }]
          : [...value, { type: "role", value: "admin" }],
    );
  };

  const updateRow = (index: number, patch: Partial<ScheduleRecipient>) => {
    const source = emailOnly || platformOnly ? rows : value;
    const next = source.map((row, i) => (i === index ? { ...row, ...patch } : row));
    if (emailOnly) {
      onChange(next.map((row) => ({ type: "email" as const, value: row.value })));
      return;
    }
    if (platformOnly) {
      onChange(
        next.map((row) => ({
          type: row.type === "user" ? "user" : "role",
          value: row.value,
        })),
      );
      return;
    }
    onChange(next);
  };

  const removeRow = (index: number) => {
    const source = emailOnly || platformOnly ? rows : value;
    if (source.length <= 1) return;
    const next = source.filter((_, i) => i !== index);
    if (emailOnly) {
      onChange(next.map((row) => ({ type: "email" as const, value: row.value })));
      return;
    }
    if (platformOnly) {
      onChange(
        next.map((row) => ({
          type: row.type === "user" ? "user" : "role",
          value: row.value,
        })),
      );
      return;
    }
    onChange(next);
  };

  if (emailOnly) {
    return (
      <div className={cn(embedded ? "space-y-2" : "space-y-3")}>
        {!embedded && !hideAddButton ? (
          <div className="flex items-center justify-between gap-2">
            <Label>收件邮箱</Label>
            {!disabled ? (
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="size-3.5" aria-hidden />
                添加邮箱
              </Button>
            ) : null}
          </div>
        ) : embedded && !hideAddButton && !disabled ? (
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-3.5" aria-hidden />
              添加邮箱
            </Button>
          </div>
        ) : null}
        <div className={cn(embedded ? "divide-y divide-gray-100 dark:divide-gray-800" : "space-y-2")}>
          {rows.map((row, index) => (
            <div
              key={index}
              className={cn(
                embedded
                  ? "grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
                  : "flex flex-wrap items-start gap-2",
              )}
            >
              <div className="min-w-[180px] flex-1 space-y-1">
                <Input
                  type="email"
                  className="h-11 w-full"
                  placeholder="name@example.com"
                  value={row.value}
                  disabled={disabled}
                  id={`${idPrefix}-email-${index}`}
                  onChange={(e) => updateRow(index, { value: e.target.value })}
                  aria-invalid={row.value.length > 0 && !isValidRecipient(row)}
                />
                {row.value.length > 0 && !isValidRecipient(row) ? (
                  <p className="text-theme-xs text-error-500">请输入有效邮箱地址</p>
                ) : null}
              </div>
              {!disabled && rows.length > 1 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label="删除邮箱"
                  onClick={() => removeRow(index)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
        {!showValidationError || hasValidRecipients(rows) ? null : (
          <p className="text-theme-xs text-error-500">请至少填写一个有效邮箱地址</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn(embedded ? "space-y-2" : "space-y-3")}>
      {!embedded && !hideAddButton ? (
        <div className="flex items-center justify-between gap-2">
          <Label>{platformOnly ? "IM 接收人" : "接收人"}</Label>
          {!disabled ? (
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="size-3.5" aria-hidden />
              添加
            </Button>
          ) : null}
        </div>
      ) : embedded && !hideAddButton && !disabled ? (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={addRow}>
            <Plus className="size-3.5" aria-hidden />
            添加接收人
          </Button>
        </div>
      ) : null}
      {hasUserRow ? (
        <Input
          value={userFilter}
          onChange={(event) => setUserFilter(event.target.value)}
          placeholder="搜索用户名…"
          className={cn("h-9", embedded ? "max-w-md" : "max-w-xs")}
          disabled={disabled}
          aria-label="搜索用户"
        />
      ) : null}
      <div className={cn(embedded ? "divide-y divide-gray-100 dark:divide-gray-800" : "space-y-2")}>
        {rows.map((row, index) => (
          <div
            key={index}
            className={cn(
              embedded
                ? "grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-start"
                : "flex flex-wrap items-start gap-2",
            )}
          >
            <Select
              value={row.type}
              onValueChange={(type) =>
                updateRow(index, {
                  type: type as ScheduleRecipient["type"],
                  value: type === "role" ? "admin" : "",
                })
              }
              disabled={disabled}
            >
              <SelectTrigger
                className={cn("h-11", embedded ? "w-full" : "w-[120px]")}
                id={`${idPrefix}-type-${index}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="role">角色</SelectItem>
                <SelectItem value="user">用户</SelectItem>
                {!platformOnly ? <SelectItem value="email">邮箱</SelectItem> : null}
              </SelectContent>
            </Select>
            {row.type === "role" ? (
              <Select
                value={row.value}
                onValueChange={(v) => updateRow(index, { value: v })}
                disabled={disabled}
              >
                <SelectTrigger className="h-11 min-w-[140px] flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {row.type === "user" ? (
              <Select
                value={row.value}
                onValueChange={(v) => updateRow(index, { value: v })}
                disabled={disabled || usersQuery.isLoading || filteredUsers.length === 0}
              >
                <SelectTrigger className="h-11 min-w-[160px] flex-1">
                  <SelectValue placeholder={usersQuery.isLoading ? "加载用户…" : "选择用户"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredUsers.map((u) => (
                    <SelectItem key={u.id} value={u.username}>
                      {u.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {row.type === "email" ? (
              <div className="min-w-[180px] flex-1 space-y-1">
                <Input
                  type="email"
                  className="h-11 w-full"
                  placeholder="name@example.com"
                  value={row.value}
                  disabled={disabled}
                  onChange={(e) => updateRow(index, { value: e.target.value })}
                  aria-invalid={row.value.length > 0 && !isValidRecipient(row)}
                />
                {row.value.length > 0 && !isValidRecipient(row) ? (
                  <p className="text-theme-xs text-error-500">请输入有效邮箱地址</p>
                ) : null}
              </div>
            ) : null}
            {!disabled && rows.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11 shrink-0"
                aria-label="删除接收人"
                onClick={() => removeRow(index)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        ))}
      </div>
      {!showValidationError || hasValidRecipients(platformOnly ? rows : value) ? null : (
        <p className="text-theme-xs text-error-500">
          {platformOnly ? "请至少选择一位平台用户或角色" : "请至少配置一位有效接收人"}
        </p>
      )}
    </div>
  );
}

export const DEFAULT_RECIPIENTS: ScheduleRecipient[] = [{ type: "role", value: "admin" }];

export const DEFAULT_EMAIL_RECIPIENTS: ScheduleRecipient[] = [{ type: "email", value: "" }];

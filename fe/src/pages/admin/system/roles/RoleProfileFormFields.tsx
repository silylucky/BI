import type { ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TruncateHint } from "@/components/ui/hint-tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { RoleCreateValues, RoleEditValues } from "./roleFormSchema";

type DashboardSummary = { id: string; name: string };
type CatalogTemplateNode = { id: string; name: string };

type RoleProfileFormFieldsProps = {
  editing: { code: string } | null;
  form: RoleCreateValues | RoleEditValues;
  setForm: (form: RoleCreateValues | RoleEditValues) => void;
  formErrors: Record<string, string>;
  dashboards?: DashboardSummary[];
  reportTemplates?: CatalogTemplateNode[];
};

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
      <div>
        <p className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">{title}</p>
        {description ? (
          <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-4">{children}</div>
    </div>
  );
}

export function RoleProfileFormFields({
  editing,
  form,
  setForm,
  formErrors,
  dashboards,
  reportTemplates,
}: RoleProfileFormFieldsProps) {
  return (
    <div className="grid gap-4">
      <FormSection title="基本信息">
        {!editing ? (
          <div className="grid gap-2">
            <Label htmlFor="role-code">角色编码</Label>
            <Input
              id="role-code"
              value={(form as RoleCreateValues).code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              aria-invalid={Boolean(formErrors.code)}
            />
            {formErrors.code ? (
              <p className="text-theme-xs text-error-600">{formErrors.code}</p>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-2">
            <Label>角色编码</Label>
            <Input value={editing.code} readOnly disabled />
          </div>
        )}
        <div className="grid gap-2">
          <Label htmlFor="role-name">显示名</Label>
          <Input
            id="role-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            aria-invalid={Boolean(formErrors.name)}
          />
          {formErrors.name ? (
            <p className="text-theme-xs text-error-600">{formErrors.name}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="role-desc">描述</Label>
          <Textarea
            id="role-desc"
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        {editing ? (
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="role-active">启用</Label>
            <Switch
              id="role-active"
              checked={(form as RoleEditValues).isActive}
              onCheckedChange={(checked) =>
                setForm({ ...form, isActive: checked } as RoleEditValues)
              }
            />
          </div>
        ) : null}
      </FormSection>

      <FormSection
        title="登录默认页（可选）"
        description="该岗位用户登录后默认打开的页面，可不设置。"
      >
        <div className="grid gap-2">
          <Label htmlFor="role-dash">默认仪表板</Label>
          <Select
            value={form.defaultDashboardId || "__none__"}
            onValueChange={(v) =>
              setForm({ ...form, defaultDashboardId: v === "__none__" ? "" : v })
            }
          >
            <SelectTrigger id="role-dash">
              <SelectValue placeholder="不设置" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">不设置</SelectItem>
              {(dashboards ?? []).map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="role-report-tpl">默认报表模板</Label>
          <Select
            value={form.defaultReportTemplateNodeId || "__none__"}
            onValueChange={(v) =>
              setForm({ ...form, defaultReportTemplateNodeId: v === "__none__" ? "" : v })
            }
          >
            <SelectTrigger id="role-report-tpl">
              <SelectValue placeholder="不设置" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">不设置</SelectItem>
              {(reportTemplates ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  <TruncateHint title={t.name} className="truncate">
                    {t.name}
                  </TruncateHint>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </FormSection>
    </div>
  );
}

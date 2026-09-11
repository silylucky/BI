export type AuditEventRow = {
  id: string;
  actor_id: string;
  actor_username: string | null;
  target_type: string;
  target_id: string;
  action: string;
  detail: string | null;
  trace_id: string;
  created_at: string;
};

const ACTION_LABELS: Record<string, string> = {
  "user.delete": "删除用户",
  "user.roles.replace": "替换用户角色",
  "user.role.bind": "绑定用户角色",
  "user.role.unbind": "解绑用户角色",
  "user.org.assign": "分配组织",
  "user.org.clear": "清除组织",
  "profile.update": "更新个人资料",
  "password.change": "修改密码",
  "role.create": "创建角色",
  "role.update": "更新角色",
  "role.delete": "删除角色",
  "role.dimension.replace": "替换角色维度",
  "role.group.replace": "替换角色分组",
  "role.permissions.replace": "替换角色权限",
  "grant.create": "创建资源授权",
  "grant.delete": "撤销资源授权",
  "datasource.delete": "删除数据源",
  "dashboard.delete": "删除仪表板",
  "dataset.delete": "删除数据集",
  "report.publish": "发布报表",
  "column_mask.create": "创建列脱敏",
  "column_mask.delete": "删除列脱敏",
  "user.override.resource.upsert": "用户例外资源授权",
  "user.override.resource.delete": "移除用户例外授权",
  "group.create": "创建分组",
  "group.update": "更新分组",
  "group.delete": "删除分组",
  "group.values.add": "添加分组值",
  "group.values.replace": "替换分组值",
  "group.values.remove": "移除分组值",
  "dimension.create": "创建维度",
  "dimension.update": "更新维度",
  "dimension.delete": "删除维度",
  "org.create": "创建组织",
  "org.update": "更新组织",
  "org.delete": "删除组织",
};

const TARGET_TYPE_LABELS: Record<string, string> = {
  user: "用户",
  role: "角色",
  org: "组织",
  group: "分组",
  dimension: "维度",
  grant: "资源授权",
  profile: "个人资料",
  datasource: "数据源",
  dashboard: "仪表板",
  dataset: "数据集",
  report: "报表",
  column_mask: "列脱敏",
};

const DETAIL_KEY_LABELS: Record<string, string> = {
  role_ids: "角色",
  role_id: "角色",
  role_code: "角色编码",
  resource_type: "资源类型",
  resource_id: "资源",
  code: "编码",
  name: "名称",
  org_id: "组织",
  changes: "变更字段",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replaceAll(".", " · ");
}

export function auditTargetTypeLabel(targetType: string): string {
  return TARGET_TYPE_LABELS[targetType] ?? targetType;
}

export function shortId(value: string, length = 8): string {
  const trimmed = value.trim();
  if (trimmed.length <= length + 1) return trimmed;
  return `${trimmed.slice(0, length)}…`;
}

function parseDetail(detail: string | null): unknown {
  if (!detail?.trim()) return null;
  try {
    return JSON.parse(detail) as unknown;
  } catch {
    return detail;
  }
}

function formatDetailValue(key: string, value: unknown): string {
  if (value == null) return "—";
  if (key === "role_ids" && Array.isArray(value)) {
    return value.length ? `${value.length} 个角色` : "清空角色";
  }
  if (Array.isArray(value)) {
    return value.length ? `${value.length} 项` : "空";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

export function formatAuditSummary(event: AuditEventRow): string {
  const parsed = parseDetail(event.detail);
  if (parsed == null) return "无附加详情";

  if (typeof parsed === "string") {
    return parsed.length > 80 ? `${parsed.slice(0, 80)}…` : parsed;
  }

  if (typeof parsed === "object" && !Array.isArray(parsed)) {
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (!entries.length) return "无附加详情";
    return entries
      .slice(0, 2)
      .map(([key, value]) => {
        const label = DETAIL_KEY_LABELS[key] ?? key;
        return `${label}：${formatDetailValue(key, value)}`;
      })
      .join("；");
  }

  return String(parsed);
}

export function formatAuditDetailPretty(detail: string | null): string {
  const parsed = parseDetail(detail);
  if (parsed == null) return "—";
  if (typeof parsed === "string") return parsed;
  return JSON.stringify(parsed, null, 2);
}

export type AuditDetailEntry = {
  key: string;
  label: string;
  value: string;
};

export function parseAuditDetailEntries(detail: string | null): AuditDetailEntry[] {
  const parsed = parseDetail(detail);
  if (parsed == null) return [];
  if (typeof parsed === "string") {
    return [{ key: "_raw", label: "内容", value: parsed }];
  }
  if (typeof parsed === "object" && !Array.isArray(parsed)) {
    return Object.entries(parsed as Record<string, unknown>).map(([key, value]) => ({
      key,
      label: DETAIL_KEY_LABELS[key] ?? key,
      value: formatDetailValue(key, value),
    }));
  }
  return [{ key: "_raw", label: "内容", value: String(parsed) }];
}

export function formatAuditTimestamp(value: string): { date: string; time: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { date: value, time: "" };
  }
  return {
    date: date.toLocaleDateString("zh-CN"),
    time: date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

export const AUDIT_TARGET_TYPE_OPTIONS = [
  { value: "all", label: "全部目标" },
  { value: "user", label: "用户" },
  { value: "role", label: "角色" },
  { value: "org", label: "组织" },
  { value: "group", label: "分组" },
  { value: "dimension", label: "维度" },
  { value: "grant", label: "资源授权" },
  { value: "datasource", label: "数据源" },
  { value: "dashboard", label: "仪表板" },
  { value: "dataset", label: "数据集" },
  { value: "report", label: "报表" },
] as const;

export const AUDIT_PRESET_FILTERS = [
  { id: "domain-delete", label: "资源删除", targetType: "dashboard", action: "dashboard.delete" },
  { id: "datasource-delete", label: "数据源删除", targetType: "datasource", action: "datasource.delete" },
  { id: "report-publish", label: "报表发布", targetType: "report", action: "report.publish" },
] as const;

export const AUDIT_ACTION_OPTIONS = [
  { value: "all", label: "全部操作" },
  { value: "user.delete", label: "删除用户" },
  { value: "user.roles.replace", label: "替换用户角色" },
  { value: "user.role.bind", label: "绑定用户角色" },
  { value: "user.role.unbind", label: "解绑用户角色" },
  { value: "user.org.assign", label: "分配组织" },
  { value: "role.create", label: "创建角色" },
  { value: "role.update", label: "更新角色" },
  { value: "role.delete", label: "删除角色" },
  { value: "role.permissions.replace", label: "替换角色权限" },
  { value: "grant.create", label: "创建资源授权" },
  { value: "grant.delete", label: "撤销资源授权" },
  { value: "org.create", label: "创建组织" },
  { value: "org.update", label: "更新组织" },
  { value: "org.delete", label: "删除组织" },
  { value: "datasource.delete", label: "删除数据源" },
  { value: "dashboard.delete", label: "删除仪表板" },
  { value: "dataset.delete", label: "删除数据集" },
  { value: "report.publish", label: "发布报表" },
] as const;

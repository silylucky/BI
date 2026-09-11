export type SourceHealth = "active" | "missing" | "none";

export function isSourceUnavailable(health: SourceHealth | undefined | null): boolean {
  return health === "missing";
}

export function sourceHealthBadgeLabel(health: SourceHealth | undefined | null): string {
  if (health === "missing") return "数据源不可用";
  return "";
}

export function sourceHealthAlertTitle(health: SourceHealth | undefined | null): string {
  if (health === "missing") return "数据源不可用或已删除";
  return "";
}

export function sourceHealthAlertDescription(
  entity: "dataset" | "sync_job",
): string {
  if (entity === "dataset") {
    return "绑定的数据连接已删除或不可见，查询与同步可能失败。请重新选择数据源或删除该 Dataset。";
  }
  return "任务引用的数据连接已删除或不可见，无法继续同步。请编辑任务并重新选择数据源。";
}

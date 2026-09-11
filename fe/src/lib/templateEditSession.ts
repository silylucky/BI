import type { DashboardTemplateListItem } from "@/lib/dashboardTemplates";

export type TemplateEditSyncState = {
  templateId: string;
  templateName: string;
  contentRevision: number;
  /** 内置模板只读，保存仅作用于临时看板副本 */
  writable: boolean;
};

export function buildTemplateEditSyncState(
  item: DashboardTemplateListItem,
  canManageTemplates: boolean,
  currentUserId?: string | null,
): TemplateEditSyncState {
  const isOwner = Boolean(
    currentUserId && item.ownerUserId && item.ownerUserId === currentUserId,
  );
  const writable =
    item.visibility === "builtin" ? canManageTemplates : canManageTemplates || isOwner;
  return {
    templateId: item.id,
    templateName: item.name,
    contentRevision: item.contentRevision,
    writable,
  };
}

export function readTemplateEditSyncState(state: unknown): TemplateEditSyncState | null {
  if (!state || typeof state !== "object") return null;
  const record = state as Record<string, unknown>;
  if (
    typeof record.templateId !== "string" ||
    typeof record.templateName !== "string" ||
    typeof record.contentRevision !== "number" ||
    typeof record.writable !== "boolean"
  ) {
    return null;
  }
  return {
    templateId: record.templateId,
    templateName: record.templateName,
    contentRevision: record.contentRevision,
    writable: record.writable,
  };
}

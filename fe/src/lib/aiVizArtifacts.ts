import { apiFetch, ApiRequestError } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";

export type AiVizComplianceWarning = {
  code: string;
  message: string;
};

export type AiVizStyleComplianceTier = "full" | "partial" | "visual-only";

export const AI_VIZ_STYLE_COMPLIANCE_LABELS: Record<AiVizStyleComplianceTier, string> = {
  full: "样式合规",
  partial: "部分合规",
  "visual-only": "仅视觉",
};

export type AiVizArtifactMeta = {
  artifactId: string;
  manifest: {
    id?: string;
    displayName?: string;
    version?: string;
    entry?: string;
    fieldSlots?: Record<string, unknown>;
    styleSchema?: Record<string, unknown>;
    styleHooks?: Record<string, unknown>;
    defaultStyle?: Record<string, unknown>;
    rendererHint?: string;
  };
  status: string;
  contentHash: string;
  warnings?: AiVizComplianceWarning[];
  styleComplianceTier?: AiVizStyleComplianceTier;
};

export type AiVizArtifactListResponse = {
  items: AiVizArtifactMeta[];
};

export type AiVizArtifactReference = {
  dashboardId: string;
  dashboardName: string;
  widgetId: string;
};

export type AiVizArtifactReferencesResponse = {
  artifactId: string;
  references: AiVizArtifactReference[];
};

export type AiVizArtifactDeleteResponse = {
  artifactId: string;
  unlinked: Array<{
    dashboardId: string;
    dashboardName: string;
    removedWidgetIds: string[];
  }>;
};

export function fetchAiVizArtifacts(limit = 100, offset = 0) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return apiFetch<AiVizArtifactListResponse>(`/api/v1/ai-viz/artifacts?${params.toString()}`);
}

export function fetchAiVizArtifactMeta(artifactId: string) {
  return apiFetch<AiVizArtifactMeta>(`/api/v1/ai-viz/artifacts/${encodeURIComponent(artifactId)}`);
}

export function fetchAiVizArtifactReferences(artifactId: string) {
  return apiFetch<AiVizArtifactReferencesResponse>(
    `/api/v1/ai-viz/artifacts/${encodeURIComponent(artifactId)}/refs`,
  );
}

export function deleteAiVizArtifact(artifactId: string, options?: { unlink?: boolean }) {
  const suffix = options?.unlink ? "?unlink=true" : "";
  return apiFetch<AiVizArtifactDeleteResponse | void>(
    `/api/v1/ai-viz/artifacts/${encodeURIComponent(artifactId)}${suffix}`,
    { method: "DELETE" },
  );
}

type AiVizArtifactReferenceField = {
  field?: string;
  message?: string;
  dashboardId?: string;
  dashboardName?: string;
  widgetId?: string;
};

function extractDashboardNamesFromFields(
  fields: Array<Record<string, unknown>>,
): string[] {
  const names: string[] = [];
  for (const field of fields) {
    const legacy = field.dashboardName;
    if (typeof legacy === "string" && legacy) {
      names.push(legacy);
      continue;
    }
    const message = field.message;
    if (typeof message === "string") {
      const match = message.match(/「([^」]+)」/);
      if (match?.[1]) names.push(match[1]);
    }
  }
  return [...new Set(names)];
}

/** 合规警告文案：避免技术路径直接进 tooltip */
export function humanizeAiVizComplianceWarning(message: string): string {
  if (/payload\.style|styleSchema|styleHooks|manifest\./i.test(message)) {
    return "样式面板与看板配色可能不会生效";
  }
  if (message.length > 96) {
    return `${message.slice(0, 93)}…`;
  }
  return message;
}

/** 删除失败时拼接引用看板名称（AIVIZ_IN_USE） */
export function formatAiVizArtifactDeleteError(err: unknown): string {
  const base = mapApiError(err);
  if (err instanceof ApiRequestError && err.code === "AIVIZ_IN_USE" && err.fields?.length) {
    const names = extractDashboardNamesFromFields(
      err.fields as Array<Record<string, unknown>>,
    );
    if (names.length > 0) {
      return `${base}：${names.join("、")}`;
    }
  }
  return base;
}

export function buildAiVizArtifactDeleteConfirmMessage(
  label: string,
  references: AiVizArtifactReference[],
): string {
  if (references.length === 0) {
    return `确定从组件库移除「${label}」？`;
  }
  const names = [...new Set(references.map((ref) => ref.dashboardName).filter(Boolean))];
  return [
    `「${label}」正被 ${names.length} 个看板/大屏引用：${names.join("、")}。`,
    "",
    "将删除组件库记录，并自动从这些布局移除对应组件（看板本身保留）。",
    "确定继续？",
  ].join("\n");
}

export function formatAiVizArtifactDeleteSuccess(
  label: string,
  result: AiVizArtifactDeleteResponse | void,
): string {
  if (!result?.unlinked?.length) {
    return `已从组件库移除「${label}」`;
  }
  const names = [...new Set(result.unlinked.map((item) => item.dashboardName))];
  return `已从组件库移除「${label}」，并从 ${names.join("、")} 移除了引用组件`;
}

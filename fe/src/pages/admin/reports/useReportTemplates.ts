import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { invalidateCatalogQueries } from "@/lib/catalogQueryInvalidation";
import { fetchAllCatalogNodes, normalizeCatalogNodes } from "@/lib/reportCatalogUtils";
import { provisionCatalogTemplate, type TemplateKind } from "@/lib/reportCatalogProvision";
import { queryKeys } from "@/lib/queryKeys";
import {
  emptyExtensionConfig,
  isExtensionNotFoundError,
  normalizeExtensionResponse,
  type ExtensionConfig,
} from "./reportExtensionUtils";

export type CatalogNode = {
  id: string;
  name: string;
  parentId: string | null;
  nodeType: "folder" | "template";
  templateKind: "excel" | "pdf" | null;
  templateKey: string | null;
  sortOrder: number;
};

export type TemplateBlock = {
  blockType: "sql" | "table" | "chart" | "crosstab";
  queryRef?: string;
  tableRef?: string;
  chartType?: "line" | "bar" | "pie";
  rowField?: string;
  colField?: string;
  valueField?: string;
  agg?: "sum" | "count" | "max" | "min";
};

export type TemplateDefinition = {
  templateKey: string;
  format: "excel" | "pdf";
  displayName: string;
  blocks: TemplateBlock[];
  storageRef?: string;
  exportHook?: { integrationPath: string; format: string; placeholder: boolean };
};

export type ExtensionMetric = {
  key: string;
  label: string;
  visible?: boolean;
  queryMode?: "sql" | "dataset";
  expression?: string | null;
  datasetId?: string | null;
  boundConfigId?: string | null;
  compareMode?: string;
};

export async function fetchCatalogExtension(nodeId: string): Promise<ExtensionConfig> {
  try {
    const raw = await apiFetch<ExtensionConfig>(`/api/v1/reports/catalog/nodes/${nodeId}/extension`);
    return normalizeExtensionResponse(raw);
  } catch (err) {
    if (isExtensionNotFoundError(err)) {
      return emptyExtensionConfig(nodeId);
    }
    throw err;
  }
}

export function useReportTemplates(parentId: string | null = null, templateKey: string | null = null) {
  const qc = useQueryClient();
  const nodesQuery = useQuery({
    queryKey: queryKeys.reports.catalogNodes(parentId),
    queryFn: async () => {
      const q = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
      const raw = await apiFetch<{ items: CatalogNode[] } | CatalogNode[]>(
        `/api/v1/reports/catalog/nodes${q}`,
      );
      return { items: normalizeCatalogNodes(raw) };
    },
  });

  const createNode = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch<CatalogNode>("/api/v1/reports/catalog/nodes", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateCatalogQueries(qc),
  });

  const createTemplateNode = useMutation({
    mutationFn: (input: { name: string; parentId: string | null; templateKind: TemplateKind }) =>
      provisionCatalogTemplate(input),
    onSuccess: () => invalidateCatalogQueries(qc),
  });

  const updateNode = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name?: string } }) =>
      apiFetch<CatalogNode>(`/api/v1/reports/catalog/nodes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateCatalogQueries(qc),
  });

  const deleteNode = useMutation({
    mutationFn: (id: string) =>
      apiFetch<void>(`/api/v1/reports/catalog/nodes/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateCatalogQueries(qc),
  });

  const moveNode = useMutation({
    mutationFn: ({ id, parentId: pid }: { id: string; parentId: string | null }) =>
      apiFetch<CatalogNode>(`/api/v1/reports/catalog/nodes/${id}/move`, {
        method: "POST",
        body: JSON.stringify({ parentId: pid }),
      }),
    onSuccess: () => invalidateCatalogQueries(qc),
  });

  const saveExtension = useMutation({
    mutationFn: ({ nodeId, body }: { nodeId: string; body: Record<string, unknown> }) =>
      apiFetch<ExtensionConfig>(`/api/v1/reports/catalog/nodes/${nodeId}/extension`, {
        method: "PUT",
        body: JSON.stringify(body),
      }).then(normalizeExtensionResponse),
    onSuccess: (data, v) => {
      qc.setQueryData(queryKeys.reports.extension(v.nodeId), data);
      void qc.invalidateQueries({ queryKey: queryKeys.reports.renderSpec(v.nodeId) });
    },
  });

  const templateQuery = useQuery({
    queryKey: queryKeys.reports.template(templateKey ?? ""),
    queryFn: () => apiFetch<TemplateDefinition>(`/api/v1/reports/templates/${templateKey}`),
    enabled: Boolean(templateKey),
    retry: false,
  });

  const saveTemplate = useMutation({
    mutationFn: ({ templateKey: key, body }: { templateKey: string; body: Record<string, unknown> }) =>
      apiFetch<TemplateDefinition>(`/api/v1/reports/templates/${key}`, {
        method: "PUT",
        body: JSON.stringify(body),
      }),
    onSuccess: (_d, v) => void qc.invalidateQueries({ queryKey: queryKeys.reports.template(v.templateKey) }),
  });

  return {
    nodesQuery,
    createNode,
    createTemplateNode,
    updateNode,
    deleteNode,
    moveNode,
    saveExtension,
    templateQuery,
    saveTemplate,
  };
}

export function useCatalogNode(nodeId: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.catalogNode(nodeId ?? ""),
    queryFn: () => apiFetch<CatalogNode>(`/api/v1/reports/catalog/nodes/${nodeId}`),
    enabled: Boolean(nodeId),
    retry: false,
  });
}

export function useCatalogExtension(nodeId: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.extension(nodeId ?? ""),
    queryFn: () => fetchCatalogExtension(nodeId!),
    enabled: Boolean(nodeId),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useAllCatalogNodes(enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.catalogAllNodes,
    queryFn: fetchAllCatalogNodes,
    enabled,
  });
}

export function useExtensionRevisions(nodeId: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.extensionRevisions(nodeId ?? ""),
    queryFn: () =>
      apiFetch<{ items: Array<{ revision: number; changeNote?: string | null; updatedAt?: string }>; total: number }>(
        `/api/v1/reports/catalog/nodes/${nodeId}/extension/revisions`,
      ),
    enabled: Boolean(nodeId),
  });
}

export function useTemplateVersions(templateKey: string | null) {
  return useQuery({
    queryKey: queryKeys.reports.templateVersions(templateKey ?? ""),
    queryFn: () =>
      apiFetch<{ items: Array<{ version: number; changeNote?: string | null; createdAt?: string }>; total: number }>(
        `/api/v1/reports/templates/${templateKey}/versions`,
      ),
    enabled: Boolean(templateKey),
  });
}

export function useDuplicateCatalogNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ nodeId, name, parentId }: { nodeId: string; name?: string; parentId?: string | null }) => {
      const params = new URLSearchParams();
      if (name) params.set("name", name);
      if (parentId) params.set("parentId", parentId);
      const q = params.toString();
      return apiFetch<CatalogNode>(`/api/v1/reports/catalog/nodes/${nodeId}/duplicate${q ? `?${q}` : ""}`, {
        method: "POST",
      });
    },
    onSuccess: () => invalidateCatalogQueries(qc),
  });
}

export function useExtensionRenderSpec(nodeId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.reports.renderSpec(nodeId ?? ""),
    queryFn: () =>
      apiFetch<Record<string, unknown>>(
        `/api/v1/reports/catalog/nodes/${nodeId}/extension/render-spec`,
      ),
    enabled: Boolean(nodeId) && enabled,
    placeholderData: keepPreviousData,
  });
}

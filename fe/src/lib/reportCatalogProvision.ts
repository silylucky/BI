import { apiFetch } from "@/lib/api";
import { randomId } from "@/lib/randomId";
import type { CatalogNode, TemplateBlock } from "@/pages/admin/reports/useReportTemplates";

export type TemplateKind = "excel" | "pdf";

export function generateCatalogTemplateKey(): string {
  return `tpl_${randomId().replace(/-/g, "").slice(0, 10)}`;
}

export async function provisionCatalogTemplate(input: {
  name: string;
  parentId: string | null;
  templateKind: TemplateKind;
}): Promise<CatalogNode> {
  const templateKey = generateCatalogTemplateKey();
  const blocks: TemplateBlock[] = [{ blockType: "table", tableRef: "main" }];
  await apiFetch(`/api/v1/reports/templates/${templateKey}`, {
    method: "PUT",
    body: JSON.stringify({
      templateKey,
      format: input.templateKind,
      displayName: input.name,
      blocks,
    }),
  });
  return apiFetch<CatalogNode>("/api/v1/reports/catalog/nodes", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      nodeType: "template",
      templateKind: input.templateKind,
      templateKey,
      parentId: input.parentId,
    }),
  });
}

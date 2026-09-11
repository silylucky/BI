import { describe, expect, it, vi } from "vitest";
import { fetchAllCatalogTemplates, filterCatalogTemplates, normalizeCatalogNodes, pickDefaultCatalogNodeId } from "./reportCatalogUtils";

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(async (url: string) => {
    if (url === "/api/v1/reports/catalog/nodes") {
      return [
        { id: "f1", name: "Folder", parentId: null, nodeType: "folder", templateKind: null, templateKey: null, sortOrder: 0 },
        { id: "t1", name: "Template A", parentId: null, nodeType: "template", templateKind: "pdf", templateKey: "a", sortOrder: 1 },
      ];
    }
    if (url.includes("parentId=f1")) {
      return [
        { id: "t2", name: "Template B", parentId: "f1", nodeType: "template", templateKind: "excel", templateKey: "b", sortOrder: 0 },
      ];
    }
    return [];
  }),
}));

describe("reportCatalogUtils", () => {
  it("normalizeCatalogNodes accepts array or items wrapper", () => {
    const node = {
      id: "1",
      name: "n",
      parentId: null,
      nodeType: "template" as const,
      templateKind: "pdf" as const,
      templateKey: "k",
      sortOrder: 0,
    };
    expect(normalizeCatalogNodes([node])).toHaveLength(1);
    expect(normalizeCatalogNodes({ items: [node] })).toHaveLength(1);
  });

  it("filterCatalogTemplates filters by name and kind", () => {
    const nodes = [
      {
        id: "1",
        name: "月报 PDF",
        parentId: null,
        nodeType: "template" as const,
        templateKind: "pdf" as const,
        templateKey: "monthly",
        sortOrder: 0,
      },
      {
        id: "2",
        name: "台账 Excel",
        parentId: null,
        nodeType: "template" as const,
        templateKind: "excel" as const,
        templateKey: "ledger",
        sortOrder: 1,
      },
    ];
    expect(filterCatalogTemplates(nodes, "月报", "all")).toHaveLength(1);
    expect(filterCatalogTemplates(nodes, "", "excel")).toHaveLength(1);
    expect(filterCatalogTemplates(nodes, "ledger", "all")).toHaveLength(1);
  });

  it("fetchAllCatalogTemplates collects templates via parallel BFS", async () => {
    const templates = await fetchAllCatalogTemplates();
    expect(templates.map((node) => node.id).sort()).toEqual(["t1", "t2"]);
  });

  it("pickDefaultCatalogNodeId prefers recent template then first template", () => {
    const nodes = [
      {
        id: "f1",
        name: "Folder",
        parentId: null,
        nodeType: "folder" as const,
        templateKind: null,
        templateKey: null,
        sortOrder: 0,
      },
      {
        id: "t1",
        name: "Template A",
        parentId: null,
        nodeType: "template" as const,
        templateKind: "pdf" as const,
        templateKey: "a",
        sortOrder: 1,
      },
      {
        id: "t2",
        name: "Template B",
        parentId: null,
        nodeType: "template" as const,
        templateKind: "pdf" as const,
        templateKey: "b",
        sortOrder: 2,
      },
    ];
    expect(
      pickDefaultCatalogNodeId(nodes, [{ resourceType: "template", resourceId: "t2" }]),
    ).toBe("t2");
    expect(pickDefaultCatalogNodeId(nodes, [])).toBe("t1");
    expect(pickDefaultCatalogNodeId([], [])).toBeNull();
  });
});

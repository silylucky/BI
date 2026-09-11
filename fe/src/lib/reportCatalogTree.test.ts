import { describe, expect, it } from "vitest";
import {
  buildCatalogMoveTargets,
  catalogNodePath,
  isCatalogDescendant,
} from "./reportCatalogUtils";

const nodes = [
  { id: "root-folder", name: "演示报表", parentId: null, nodeType: "folder" as const, templateKind: null, templateKey: null, sortOrder: 0 },
  { id: "child-tpl", name: "演示销售报表", parentId: "root-folder", nodeType: "template" as const, templateKind: "pdf" as const, templateKey: "dev", sortOrder: 0 },
  { id: "root-tpl", name: "新建模板", parentId: null, nodeType: "template" as const, templateKind: "pdf" as const, templateKey: null, sortOrder: 1 },
];

describe("reportCatalogTree helpers", () => {
  it("builds node path", () => {
    expect(catalogNodePath(nodes[1], nodes)).toBe("演示报表 / 演示销售报表");
  });

  it("detects descendants for move guard", () => {
    expect(isCatalogDescendant("root-folder", "child-tpl", nodes)).toBe(true);
    expect(isCatalogDescendant("root-tpl", "root-folder", nodes)).toBe(false);
  });

  it("offers valid folders as move targets for root template", () => {
    const targets = buildCatalogMoveTargets("root-tpl", nodes);
    expect(targets.map((t) => t.id)).toEqual(["root-folder"]);
  });

  it("excludes self and descendants from move targets", () => {
    const targets = buildCatalogMoveTargets("root-folder", nodes);
    expect(targets).toEqual([]);
  });
});

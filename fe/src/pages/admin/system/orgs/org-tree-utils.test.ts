import { describe, expect, it } from "vitest";
import {
  buildOrgChildCounts,
  filterVisibleOrgs,
  orgLevelLabel,
  sortOrgsByPath,
  type OrgOut,
} from "./org-tree-utils";

const ROOT: OrgOut = {
  id: "root",
  parent_id: null,
  name: "总部",
  path: "/root",
  level: 0,
};
const CHILD: OrgOut = {
  id: "child",
  parent_id: "root",
  name: "综合处",
  path: "/root/child",
  level: 1,
};

describe("org-tree-utils", () => {
  it("sorts by path", () => {
    const sorted = sortOrgsByPath([CHILD, ROOT]);
    expect(sorted.map((o) => o.id)).toEqual(["root", "child"]);
  });

  it("hides descendants when parent collapsed", () => {
    const visible = filterVisibleOrgs([ROOT, CHILD], new Set(["root"]));
    expect(visible.map((o) => o.id)).toEqual(["root"]);
  });

  it("counts direct children", () => {
    expect(buildOrgChildCounts([ROOT, CHILD]).get("root")).toBe(1);
  });

  it("labels levels in Chinese", () => {
    expect(orgLevelLabel(0)).toBe("顶级");
    expect(orgLevelLabel(1)).toBe("一级");
  });
});

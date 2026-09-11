import { describe, expect, it } from "vitest";
import {
  canArchiveTemplate,
  canDeleteTemplate,
} from "./templateLabels";
import type { DashboardTemplateListItem } from "@/lib/dashboardTemplates";

const builtinPublished = {
  id: "tpl-builtin",
  templateKey: "builtin-gov-investment",
  name: "招商引资分析",
  categoryKey: "government",
  surfaceKind: "dashboard",
  status: "published",
  visibility: "builtin",
} as DashboardTemplateListItem;

const privatePublished = {
  ...builtinPublished,
  id: "tpl-private",
  templateKey: "custom-investment",
  visibility: "private",
  ownerUserId: "user-1",
} as DashboardTemplateListItem;

describe("templateLabels lifecycle actions", () => {
  it("allows admins to archive builtin published templates", () => {
    expect(canArchiveTemplate(builtinPublished, true)).toBe(true);
    expect(canArchiveTemplate(builtinPublished, false)).toBe(false);
  });

  it("only allows delete for non-builtin templates", () => {
    expect(canDeleteTemplate(builtinPublished, true)).toBe(false);
    expect(canDeleteTemplate(privatePublished, true)).toBe(true);
  });
});

import { z } from "zod";

export const RESOURCE_TYPES = ["datasource", "dashboard", "report"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const grantCreateSchema = z.object({
  roleId: z.string().min(1, "请选择角色").uuid("请选择有效角色"),
  resourceType: z.enum(RESOURCE_TYPES, { message: "请选择资源类型" }),
  resourceId: z.string().min(1, "请选择资源").uuid("请选择有效资源"),
});

export type GrantCreateValues = z.infer<typeof grantCreateSchema>;

export const EMPTY_GRANT_CREATE: GrantCreateValues = {
  roleId: "",
  resourceType: "datasource",
  resourceId: "",
};

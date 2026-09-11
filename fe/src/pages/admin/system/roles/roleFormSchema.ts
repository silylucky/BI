import { z } from "zod";

export const ROLE_CODE_RE = /^[a-z][a-z0-9_]{1,63}$/;

export const roleCreateSchema = z.object({
  code: z
    .string()
    .min(1, "请输入角色编码")
    .regex(ROLE_CODE_RE, "编码须以小写字母开头，仅含小写字母、数字、下划线，2–64 位"),
  name: z.string().min(1, "请输入显示名").max(128, "显示名过长"),
  description: z.string().max(512, "描述过长").optional().or(z.literal("")),
  defaultDashboardId: z.string().uuid().optional().or(z.literal("")),
  defaultReportTemplateNodeId: z.string().uuid().optional().or(z.literal("")),
});

export const roleEditSchema = roleCreateSchema.omit({ code: true }).extend({
  isActive: z.boolean(),
});

export type RoleCreateValues = z.infer<typeof roleCreateSchema>;
export type RoleEditValues = z.infer<typeof roleEditSchema>;

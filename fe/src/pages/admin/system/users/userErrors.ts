import { mapApiError } from "@/lib/apiError";

const USER_MESSAGES: Record<string, string> = {
  USERNAME_CONFLICT: "用户名已存在",
  USER_NOT_FOUND: "用户不存在",
  BINDING_FORBIDDEN: "无权管理用户角色",
  AUTH_PASSWORD_POLICY: "密码长度须为 8-128 个字符",
  USER_ORG_NOT_SET: "用户尚未分配组织",
  AUTH_ROOT_ADMIN_REQUIRED: "不能移除最后一个可用的超级管理员",
  USER_SELF_DELETE_FORBIDDEN: "不能删除当前登录账号",
  ORG_SCOPE_FORBIDDEN: "目标组织不在你可管理的范围内",
};

export function mapUserError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && USER_MESSAGES[code]) return USER_MESSAGES[code];
  return mapApiError(err);
}

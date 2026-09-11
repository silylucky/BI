import { mapApiError } from "@/lib/apiError";

export function mapRoleError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && ROLE_MESSAGES[code]) return ROLE_MESSAGES[code];
  return mapApiError(err);
}

const ROLE_MESSAGES: Record<string, string> = {
  AUTH_ROOT_ROLE_IMMUTABLE: "根角色不可删除或停用",
  ROLE_CODE_CONFLICT: "角色编码已存在",
  ROLE_NOT_FOUND: "角色不存在",
  ROLE_DISABLED: "角色已停用",
  ROLE_IN_USE: "角色仍被用户绑定或资源授权引用，无法删除",
  ROLE_FORBIDDEN: "无权管理角色",
};

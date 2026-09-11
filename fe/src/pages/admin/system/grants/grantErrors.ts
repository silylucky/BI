import { mapApiError } from "@/lib/apiError";

const GRANT_MESSAGES: Record<string, string> = {
  GRANT_ALREADY_EXISTS: "该角色已绑定此资源，请勿重复授权",
  ROLE_NOT_FOUND: "所选角色不存在，请刷新后重试",
  GRANT_NOT_FOUND: "授权记录不存在，可能已被撤销",
  INVALID_RESOURCE_TYPE: "资源类型无效",
  ORG_SCOPE_FORBIDDEN: "该角色不在你可管理的组织范围内",
};

export function mapGrantError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && GRANT_MESSAGES[code]) return GRANT_MESSAGES[code];
  return mapApiError(err);
}

import { mapApiError } from "@/lib/apiError";

const ORG_MESSAGES: Record<string, string> = {
  ORG_NOT_FOUND: "组织节点不存在",
  ORG_PARENT_NOT_FOUND: "上级组织不存在",
  ORG_HAS_CHILDREN: "请先删除或移走下级组织，再删除本节点",
  ORG_HAS_USERS: "仍有用户归属此组织，请先在用户管理中调整归属",
  ORG_CYCLE: "不能将组织移动到自身或其下级之下",
  ORG_DEPTH_EXCEEDED: "组织层级过深，无法继续添加",
};

export function mapOrgError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code && ORG_MESSAGES[code]) return ORG_MESSAGES[code];
  return mapApiError(err);
}

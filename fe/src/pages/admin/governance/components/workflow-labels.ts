export const NODE_LABELS: Record<string, string> = {
  draft: "草稿",
  pending_approval: "待审批",
  designing: "设计中",
  pending_publish: "待发布",
  published: "已发布",
};

export const ROLE_LABELS: Record<string, string> = {
  requester: "申请人",
  approver: "审批人",
  designer: "设计人",
  publisher: "发布人",
  admin: "管理员",
};

export const ALLOWED_WORKFLOW_ROLES = [
  "requester",
  "approver",
  "designer",
  "publisher",
  "admin",
] as const;

const STANDARD_NODES: WorkflowTemplate["nodes"] = [
  { id: "draft", role: "requester" },
  { id: "pending_approval", role: "approver" },
  { id: "designing", role: "designer" },
  { id: "pending_publish", role: "publisher" },
  { id: "published", role: "admin" },
];

export function nodeLabel(id: string) {
  return NODE_LABELS[id] ?? id;
}

export function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

export type WorkflowTemplate = {
  id: string;
  name: string;
  nodes: Array<{ id: string; role: string }>;
};

export type WorkflowNodeRole = {
  nodeId: string;
  role: string;
  description: string;
};

export { STANDARD_NODES };

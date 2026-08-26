import { type VitalSpanBinding } from "./instanceConfig";
/** Agent 工具进程：从磁盘 workspace meta 读取 binding 端点（无凭据） */
export declare function readBindingEndpointsFromFile(workspaceRoot: string): Partial<Pick<VitalSpanBinding, "apiBaseUrl" | "feAdminUrl">>;

import type { SystemAdminScope } from "./SystemAdminScopeHint";
import { SystemAdminScopeHint } from "./SystemAdminScopeHint";

/** 列表页工具栏上方的权限说明条 */
export function SystemAdminListHint({ scope }: { scope: SystemAdminScope }) {
  return (
    <div className="shrink-0 border-b border-gray-100 px-5 py-3 dark:border-white/[0.06]">
      <SystemAdminScopeHint scope={scope} />
    </div>
  );
}

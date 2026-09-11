import type { ReactNode } from "react";
import { Settings2, Trash2 } from "lucide-react";
import { ListRowCheckbox } from "@/components/layout/list-batch-delete";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { isUserLocked } from "./userAccountStatus";

export type UserRow = {
  id: string;
  username: string;
  email?: string | null;
  isActive?: boolean;
  lockedUntil?: string | null;
  roles?: { id: string; code: string; name: string }[];
};

type UserListRowProps = {
  row: UserRow;
  batchMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onManage: (row: UserRow) => void;
  onDelete: (row: UserRow) => void;
  roleBadges: ReactNode;
};

function UserStatusBadge({ isActive, lockedUntil }: { isActive?: boolean; lockedUntil?: string | null }) {
  if (isUserLocked(lockedUntil)) {
    return (
      <Badge variant="light" color="warning" size="sm">
        已锁定
      </Badge>
    );
  }
  if (isActive === false) {
    return (
      <Badge variant="light" color="error" size="sm">
        已停用
      </Badge>
    );
  }
  return (
    <Badge variant="light" color="success" size="sm">
      正常
    </Badge>
  );
}

export function UserListRow({
  row,
  batchMode = false,
  isSelected = false,
  onToggleSelect,
  onManage,
  onDelete,
  roleBadges,
}: UserListRowProps) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
      {batchMode ? (
        <td className="w-10 max-w-10 px-2 py-3 text-center">
          {onToggleSelect ? (
            <ListRowCheckbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect()}
              ariaLabel={`选择用户 ${row.username}`}
            />
          ) : null}
        </td>
      ) : null}
      <td className="px-4 py-3 font-medium text-gray-800 dark:text-white/90">{row.username}</td>
      <td className="px-4 py-3">
        <UserStatusBadge isActive={row.isActive} lockedUntil={row.lockedUntil} />
      </td>
      <td className="px-4 py-3">{roleBadges}</td>
      <td className="px-4 py-3 text-right">
        {!batchMode ? (
          <div className="inline-flex items-center gap-0.5">
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`管理 ${row.username}`}
              onClick={() => onManage(row)}
            >
              <Settings2 className="size-4" />
            </IconButton>
            <IconButton
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`删除 ${row.username}`}
              className="text-error-600 hover:text-error-700 dark:text-error-400 dark:hover:text-error-300"
              onClick={() => onDelete(row)}
            >
              <Trash2 className="size-4" />
            </IconButton>
          </div>
        ) : null}
      </td>
    </tr>
  );
}

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useListBatchMode } from "@/components/layout/list-batch-delete";
import { useListRowSelection } from "@/hooks/useListRowSelection";
import { apiFetch } from "@/lib/api";
import { formatBatchDeleteToast, runBatchDelete } from "@/lib/runBatchDelete";
import type { OrgOut } from "./OrgListRow";

function sortIdsForDelete(ids: string[], items: OrgOut[]): string[] {
  const levelById = new Map(items.map((o) => [o.id, o.level]));
  return [...ids].sort((a, b) => (levelById.get(b) ?? 0) - (levelById.get(a) ?? 0));
}

export function useOrgBatchDelete(items: OrgOut[], invalidate: () => Promise<void>) {
  const rowIds = useMemo(() => items.map((o) => o.id), [items]);
  const selection = useListRowSelection(rowIds);
  const batch = useListBatchMode(selection.clear);
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const handleBatchDelete = async () => {
    const ids = sortIdsForDelete([...selection.selectedIds], items);
    if (ids.length === 0) return;
    setBatchDeleting(true);
    const { ok, failed, failures } = await runBatchDelete(ids, (id) =>
      apiFetch(`/api/v1/orgs/${id}`, { method: "DELETE" }),
    );
    setBatchDeleting(false);
    setBatchDeleteOpen(false);
    selection.clear();
    await invalidate();
    const toastMsg = formatBatchDeleteToast(ok, failed, failures, "组织");
    if (toastMsg.variant === "success") toast.success(toastMsg.message);
    else toast.warning(toastMsg.message);
  };

  return {
    selection,
    batch,
    batchDeleteOpen,
    setBatchDeleteOpen,
    batchDeleting,
    handleBatchDelete,
  };
}

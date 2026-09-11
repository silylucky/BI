import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ListPageBatchActions,
  ListRowCheckbox,
  useListBatchMode,
} from "@/components/layout/list-batch-delete";
import {
  AdminFormDialogBody,
  AdminFormDialogContent,
  AdminFormDialogFooter,
  AdminFormDialogHeader,
  AdminFormField,
} from "@/components/layout/admin-form-dialog";
import { useListRowSelection } from "@/hooks/useListRowSelection";
import { IconButton } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";

type Mapping = { id?: string; tableFqn: string; columnName: string };

export function TermFieldMappingDialog({
  termId,
  termName,
  open,
  onOpenChange,
}: {
  termId: string;
  termName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<Mapping[]>([]);
  const rowIds = useMemo(() => rows.map((_, index) => String(index)), [rows]);
  const selection = useListRowSelection(rowIds);
  const batch = useListBatchMode(selection.clear);

  const removeSelected = () => {
    const indices = new Set([...selection.selectedIds].map(Number));
    const next = rows.filter((_, i) => !indices.has(i));
    setRows(next.length > 0 ? next : [{ tableFqn: "", columnName: "" }]);
    selection.clear();
  };

  useQuery({
    queryKey: ["metadata", "glossary", termId, "field-mappings"],
    queryFn: async () => {
      const data = await apiFetch<{ items: Mapping[] }>(
        `/api/v1/metadata/glossary/${termId}/field-mappings`,
      );
      setRows(data.items.length ? data.items : [{ tableFqn: "", columnName: "" }]);
      return data;
    },
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () =>
      apiFetch(`/api/v1/metadata/glossary/${termId}/field-mappings`, {
        method: "PUT",
        body: JSON.stringify({
          items: rows
            .filter((r) => r.tableFqn.trim() && r.columnName.trim())
            .map((r) => ({ tableFqn: r.tableFqn.trim(), columnName: r.columnName.trim() })),
        }),
      }),
    onSuccess: () => {
      toast.success("物理字段映射已保存");
      void qc.invalidateQueries({ queryKey: ["metadata", "glossary", termId, "field-mappings"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(mapApiError(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AdminFormDialogContent size="md" scrollable>
        <AdminFormDialogHeader>
          <DialogTitle>物理字段映射 — {termName}</DialogTitle>
        </AdminFormDialogHeader>
        <AdminFormDialogBody scrollable>
          <ListPageBatchActions
            batchMode={batch.batchMode}
            onToggleBatchMode={batch.toggleBatchMode}
            selectedCount={selection.selectedCount}
            entityLabel="条映射"
            onClear={selection.clear}
            onDelete={removeSelected}
          />
          <div className="grid gap-3">
            {rows.map((row, idx) => (
              <div
                key={idx}
                className={
                  batch.batchMode
                    ? "grid gap-2 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-end"
                    : "grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
                }
              >
                {batch.batchMode ? (
                  <ListRowCheckbox
                    checked={selection.isSelected(String(idx))}
                    onCheckedChange={() => selection.toggle(String(idx))}
                    ariaLabel={`选择映射行 ${idx + 1}`}
                  />
                ) : null}
                <AdminFormField label="表 FQN" htmlFor={`fqn-${idx}`}>
                  <Input
                    id={`fqn-${idx}`}
                    placeholder="schema.table"
                    value={row.tableFqn}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, tableFqn: e.target.value } : r)),
                      )
                    }
                  />
                </AdminFormField>
                <AdminFormField label="列名" htmlFor={`col-${idx}`}>
                  <Input
                    id={`col-${idx}`}
                    placeholder="column_name"
                    value={row.columnName}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, columnName: e.target.value } : r)),
                      )
                    }
                  />
                </AdminFormField>
                <IconButton
                  variant="ghost"
                  size="sm"
                  aria-label="删除映射行"
                  disabled={rows.length <= 1}
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="size-4" />
                </IconButton>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => setRows((prev) => [...prev, { tableFqn: "", columnName: "" }])}
            >
              <Plus className="size-4" aria-hidden />
              添加映射
            </Button>
          </div>
        </AdminFormDialogBody>
        <AdminFormDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
            保存
          </Button>
        </AdminFormDialogFooter>
      </AdminFormDialogContent>
    </Dialog>
  );
}

export function TermFieldMappingButton({
  termId,
  termName,
}: {
  termId: string;
  termName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton
        variant="ghost"
        size="sm"
        aria-label={`物理字段映射 ${termName}`}
        onClick={() => setOpen(true)}
      >
        <Link2 className="size-4" />
      </IconButton>
      <TermFieldMappingDialog termId={termId} termName={termName} open={open} onOpenChange={setOpen} />
    </>
  );
}

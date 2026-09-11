import {
  BatchDeleteDialog,
  DESTRUCTIVE_ALERT_ACTION_CLASS,
} from "@/components/layout/list-batch-delete";
import {
  AdminFormDialogBody,
  AdminFormDialogContent,
  AdminFormDialogFooter,
  AdminFormDialogHeader,
  AdminFormField,
} from "@/components/layout/admin-form-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrgOut } from "./OrgListRow";

type OrgFormDialogsProps = {
  pickerItems: OrgOut[];
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  createName: string;
  onCreateNameChange: (value: string) => void;
  createParentId: string;
  onCreateParentIdChange: (value: string) => void;
  createParentLocked?: boolean;
  createParentLabel?: string | null;
  createPending: boolean;
  onCreate: () => void;
  editOrg: OrgOut | null;
  onEditClose: () => void;
  editName: string;
  onEditNameChange: (value: string) => void;
  editParentId: string;
  onEditParentIdChange: (value: string) => void;
  editPending: boolean;
  onEditSave: () => void;
  deleteOrg: OrgOut | null;
  onDeleteClose: () => void;
  deletePending: boolean;
  onDeleteConfirm: () => void;
  batchDeleteOpen: boolean;
  onBatchDeleteOpenChange: (open: boolean) => void;
  batchSelectedCount: number;
  batchDeleting: boolean;
  onBatchDeleteConfirm: () => void;
};

function parentOptions(items: OrgOut[], excludeId?: string) {
  return items.filter((o) => o.id !== excludeId);
}

export function OrgFormDialogs({
  pickerItems,
  createOpen,
  onCreateOpenChange,
  createName,
  onCreateNameChange,
  createParentId,
  onCreateParentIdChange,
  createParentLocked = false,
  createParentLabel = null,
  createPending,
  onCreate,
  editOrg,
  onEditClose,
  editName,
  onEditNameChange,
  editParentId,
  onEditParentIdChange,
  editPending,
  onEditSave,
  deleteOrg,
  onDeleteClose,
  deletePending,
  onDeleteConfirm,
  batchDeleteOpen,
  onBatchDeleteOpenChange,
  batchSelectedCount,
  batchDeleting,
  onBatchDeleteConfirm,
}: OrgFormDialogsProps) {
  const createParentName =
    createParentLabel ??
    (createParentId === "__root__"
      ? null
      : (pickerItems.find((o) => o.id === createParentId)?.name ?? null));

  return (
    <>
      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <AdminFormDialogContent>
          <AdminFormDialogHeader>
            <DialogTitle>{createParentName ? "添加子组织" : "新建组织"}</DialogTitle>
            {createParentName ? (
              <p className="text-theme-sm text-gray-500 dark:text-gray-400">
                上级组织：{createParentName}
              </p>
            ) : null}
          </AdminFormDialogHeader>
          <AdminFormDialogBody>
            <AdminFormField label="名称" htmlFor="org-create-name">
              <Input
                id="org-create-name"
                value={createName}
                onChange={(e) => onCreateNameChange(e.target.value)}
                placeholder="如：综合处、华东区"
              />
            </AdminFormField>
            <AdminFormField label="上级组织">
              {createParentLocked && createParentName ? (
                <p
                  className="flex h-11 items-center rounded-lg border border-gray-200 bg-gray-50 px-4 text-theme-sm text-gray-800 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90"
                  aria-readonly="true"
                >
                  {createParentName}
                </p>
              ) : (
                <Select value={createParentId} onValueChange={onCreateParentIdChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__root__">（顶级组织）</SelectItem>
                    {pickerItems.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </AdminFormField>
          </AdminFormDialogBody>
          <AdminFormDialogFooter>
            <Button type="button" variant="outline" onClick={() => onCreateOpenChange(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!createName.trim() || createPending}
              onClick={onCreate}
            >
              创建
            </Button>
          </AdminFormDialogFooter>
        </AdminFormDialogContent>
      </Dialog>

      <Dialog open={Boolean(editOrg)} onOpenChange={(o) => !o && onEditClose()}>
        <AdminFormDialogContent>
          <AdminFormDialogHeader>
            <DialogTitle>编辑组织</DialogTitle>
          </AdminFormDialogHeader>
          <AdminFormDialogBody>
            <AdminFormField label="名称" htmlFor="org-edit-name">
              <Input
                id="org-edit-name"
                value={editName}
                onChange={(e) => onEditNameChange(e.target.value)}
              />
            </AdminFormField>
            <AdminFormField label="上级组织">
              <Select value={editParentId} onValueChange={onEditParentIdChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__root__">（顶级组织）</SelectItem>
                  {parentOptions(pickerItems, editOrg?.id).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AdminFormField>
          </AdminFormDialogBody>
          <AdminFormDialogFooter>
            <Button type="button" variant="outline" onClick={onEditClose}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!editName.trim() || editPending}
              onClick={onEditSave}
            >
              保存
            </Button>
          </AdminFormDialogFooter>
        </AdminFormDialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteOrg)} onOpenChange={(o) => !o && onDeleteClose()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除组织？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleteOrg?.name}」。若仍有下级组织或已绑定用户，删除会失败。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className={DESTRUCTIVE_ALERT_ACTION_CLASS}
              disabled={deletePending}
              onClick={onDeleteConfirm}
            >
              {deletePending ? "删除中…" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BatchDeleteDialog
        open={batchDeleteOpen}
        onOpenChange={onBatchDeleteOpenChange}
        count={batchSelectedCount}
        title="批量删除组织"
        description={`确定删除选中的 ${batchSelectedCount} 个组织节点？仍有下级组织或已绑定用户的节点会删除失败。`}
        pending={batchDeleting}
        onConfirm={onBatchDeleteConfirm}
      />
    </>
  );
}

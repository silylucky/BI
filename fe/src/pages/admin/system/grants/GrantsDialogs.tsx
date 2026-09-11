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
import {
  AdminFormDialogBody,
  AdminFormDialogContent,
  AdminFormDialogFooter,
  AdminFormDialogHeader,
  AdminFormField,
} from "@/components/layout/admin-form-dialog";
import { ResourceGrantPicker } from "./ResourceGrantPicker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GrantCreateValues, ResourceType } from "./grantFormSchema";
import type { ResourceGrantOut, RoleOut } from "./useGrantsPage";

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  datasource: "数据源",
  dashboard: "仪表板",
  report: "报表",
};

type GrantsDialogsProps = {
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  deleteTarget: ResourceGrantOut | null;
  setDeleteTarget: (row: ResourceGrantOut | null) => void;
  form: GrantCreateValues;
  setForm: (form: GrantCreateValues) => void;
  formErrors: Record<string, string>;
  roles: RoleOut[];
  createPending: boolean;
  deletePending: boolean;
  onSubmitCreate: () => void;
  onConfirmDelete: (id: string) => void;
};

export function GrantsDialogs({
  dialogOpen,
  setDialogOpen,
  deleteTarget,
  setDeleteTarget,
  form,
  setForm,
  formErrors,
  roles,
  createPending,
  deletePending,
  onSubmitCreate,
  onConfirmDelete,
}: GrantsDialogsProps) {
  return (
    <>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AdminFormDialogContent size="md">
          <AdminFormDialogHeader>
            <DialogTitle>新建授权</DialogTitle>
          </AdminFormDialogHeader>
          <AdminFormDialogBody>
            <AdminFormField label="角色" htmlFor="grant-role" error={formErrors.roleId}>
              <Select
                value={form.roleId || "__none__"}
                onValueChange={(v) => setForm({ ...form, roleId: v === "__none__" ? "" : v })}
              >
                <SelectTrigger id="grant-role" aria-label="角色">
                  <SelectValue placeholder="请选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">请选择角色</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AdminFormField>
            <AdminFormField label="资源类型" htmlFor="grant-type" error={formErrors.resourceType}>
              <Select
                value={form.resourceType}
                onValueChange={(v) =>
                  setForm({ ...form, resourceType: v as ResourceType, resourceId: "" })
                }
              >
                <SelectTrigger id="grant-type" aria-label="资源类型">
                  <SelectValue placeholder="请选择资源类型" />
                </SelectTrigger>
                <SelectContent>
                  {(["datasource", "dashboard", "report"] as const).map((t) => (
                    <SelectItem key={t} value={t}>
                      {RESOURCE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AdminFormField>
            <AdminFormField label="资源" htmlFor="grant-resource" error={formErrors.resourceId}>
              <ResourceGrantPicker
                id="grant-resource"
                resourceType={form.resourceType}
                value={form.resourceId}
                onValueChange={(resourceId) => setForm({ ...form, resourceId })}
                disabled={createPending}
              />
            </AdminFormField>
          </AdminFormDialogBody>
          <AdminFormDialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button type="button" variant="primary" disabled={createPending} onClick={onSubmitCreate}>
              {createPending ? "提交中…" : "确认"}
            </Button>
          </AdminFormDialogFooter>
        </AdminFormDialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认撤销授权？</AlertDialogTitle>
            <AlertDialogDescription>
              将撤销该角色对资源的访问授权，此操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={deletePending}
              className="bg-error-600 hover:bg-error-700"
              onClick={() => deleteTarget && onConfirmDelete(deleteTarget.id)}
            >
              {deletePending ? "撤销中…" : "确认撤销"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export { RESOURCE_TYPE_LABELS };

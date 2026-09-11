import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AdminFormDialogBody,
  AdminFormDialogContent,
  AdminFormDialogFooter,
  AdminFormDialogHeader,
  AdminFormField,
} from "@/components/layout/admin-form-dialog";
import { DashboardPickerSelect } from "./DashboardPickerSelect";

export type UserViewFormValues = {
  name: string;
  dashboardId: string;
};

type UserViewFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial: UserViewFormValues;
  pending?: boolean;
  onSubmit: (values: UserViewFormValues) => void;
};

export function UserViewFormDialog({
  open,
  onOpenChange,
  mode,
  initial,
  pending,
  onSubmit,
}: UserViewFormDialogProps) {
  const [name, setName] = useState(initial.name);
  const [dashboardId, setDashboardId] = useState(initial.dashboardId);

  useEffect(() => {
    if (!open) return;
    setName(initial.name);
    setDashboardId(initial.dashboardId);
  }, [open, initial.name, initial.dashboardId]);

  const canSave = name.trim().length > 0 && dashboardId.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AdminFormDialogContent>
        <AdminFormDialogHeader>
          <DialogTitle>{mode === "create" ? "创建个人视图" : "编辑个人视图"}</DialogTitle>
        </AdminFormDialogHeader>
        <AdminFormDialogBody>
          <AdminFormField label="名称" htmlFor="view-name">
            <Input
              id="view-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：销售总览"
            />
          </AdminFormField>
          <AdminFormField label="关联仪表板" htmlFor="view-dashboard">
            <DashboardPickerSelect
              id="view-dashboard"
              value={dashboardId}
              onValueChange={setDashboardId}
              disabled={pending}
            />
          </AdminFormField>
        </AdminFormDialogBody>
        <AdminFormDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!canSave || pending}
            onClick={() => onSubmit({ name: name.trim(), dashboardId: dashboardId.trim() })}
          >
            {pending ? "保存中…" : mode === "create" ? "创建" : "保存"}
          </Button>
        </AdminFormDialogFooter>
      </AdminFormDialogContent>
    </Dialog>
  );
}

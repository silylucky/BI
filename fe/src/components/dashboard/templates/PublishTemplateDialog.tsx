import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AdminFormDialogBody,
  AdminFormDialogContent,
  AdminFormDialogDescription,
  AdminFormDialogFooter,
  AdminFormDialogHeader,
  AdminFormField,
} from "@/components/layout/admin-form-dialog";
import { mapApiError } from "@/lib/apiError";
import {
  createTemplateFromDashboard,
  publishTemplate,
  type VizSurfaceKind,
} from "@/lib/dashboardTemplates";

type PublishTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
  defaultName: string;
  surfaceKind: VizSurfaceKind;
  onPublished?: () => void;
};

export function PublishTemplateDialog({
  open,
  onOpenChange,
  dashboardId,
  defaultName,
  surfaceKind,
  onPublished,
}: PublishTemplateDialogProps) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");

  const publishMutation = useMutation({
    mutationFn: async () => {
      const created = await createTemplateFromDashboard({
        name: name.trim() || defaultName,
        description: description.trim() || undefined,
        surfaceKind,
        sourceDashboardId: dashboardId,
        visibility: "org",
      });
      return publishTemplate(created.id);
    },
    onSuccess: () => {
      toast.success("已发布为组织模板");
      onOpenChange(false);
      onPublished?.();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AdminFormDialogContent>
        <AdminFormDialogHeader>
          <DialogTitle>发布为模板</DialogTitle>
          <AdminFormDialogDescription>
            将当前布局保存到企业可视化模板库，供团队复用。
          </AdminFormDialogDescription>
        </AdminFormDialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            publishMutation.mutate();
          }}
        >
          <AdminFormDialogBody>
            <AdminFormField label="模板名称" htmlFor="tpl-name">
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={defaultName}
              />
            </AdminFormField>
            <AdminFormField label="描述" htmlFor="tpl-desc">
              <textarea
                id="tpl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="可选：说明适用场景"
                className="min-h-[80px] w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-theme-sm focus-visible:border-brand-300 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:border-gray-800"
              />
            </AdminFormField>
          </AdminFormDialogBody>
          <AdminFormDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" variant="primary" disabled={publishMutation.isPending}>
              {publishMutation.isPending ? "发布中…" : "发布"}
            </Button>
          </AdminFormDialogFooter>
        </form>
      </AdminFormDialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEMPLATE_ACTIONS } from "@/components/dashboard/templates/templateLabels";
import {
  TEMPLATE_CATEGORIES,
  updateTemplate,
  type DashboardTemplateListItem,
} from "@/lib/dashboardTemplates";
import { mapApiError } from "@/lib/apiError";

type TemplateSettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: DashboardTemplateListItem | null;
  onSaved?: () => void;
  onEditLayout?: (item: DashboardTemplateListItem) => void;
};

export function TemplateSettingsDialog({
  open,
  onOpenChange,
  item,
  onSaved,
  onEditLayout,
}: TemplateSettingsDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryKey, setCategoryKey] = useState("general");

  useEffect(() => {
    if (!item || !open) return;
    setName(item.name);
    setDescription(item.description ?? "");
    setCategoryKey(item.categoryKey);
  }, [item, open]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateTemplate(item!.id, {
        name: name.trim() || item!.name,
        description: description.trim() || null,
        categoryKey,
        contentRevision: item!.contentRevision,
      }),
    onSuccess: () => {
      toast.success("模板设置已保存");
      onOpenChange(false);
      onSaved?.();
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <AdminFormDialogContent>
        <AdminFormDialogHeader>
          <DialogTitle>{TEMPLATE_ACTIONS.templateSettings}</DialogTitle>
          <AdminFormDialogDescription>
            修改模板名称、描述与分类。布局请在可视化编辑器中调整。
          </AdminFormDialogDescription>
        </AdminFormDialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <AdminFormDialogBody>
            <AdminFormField label="模板名称" htmlFor="tpl-settings-name">
              <Input
                id="tpl-settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </AdminFormField>
            <AdminFormField label="描述" htmlFor="tpl-settings-desc">
              <textarea
                id="tpl-settings-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="min-h-[80px] w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-theme-sm focus-visible:border-brand-300 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-brand-500/20 dark:border-gray-800"
              />
            </AdminFormField>
            <AdminFormField label="分类" htmlFor="tpl-settings-category">
              <Select value={categoryKey} onValueChange={setCategoryKey}>
                <SelectTrigger id="tpl-settings-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.key} value={cat.key}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AdminFormField>
          </AdminFormDialogBody>
          <AdminFormDialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={saveMutation.isPending}
              onClick={() => {
                onOpenChange(false);
                onEditLayout?.(item);
              }}
            >
              {TEMPLATE_ACTIONS.editLayout}
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button type="submit" variant="primary" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "保存中…" : "保存"}
              </Button>
            </div>
          </AdminFormDialogFooter>
        </form>
      </AdminFormDialogContent>
    </Dialog>
  );
}

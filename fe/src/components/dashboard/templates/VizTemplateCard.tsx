import { useMutation } from "@tanstack/react-query";
import { Archive, Download, MoreHorizontal, Pencil, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TemplateCardPreview } from "@/components/dashboard/templates/TemplateCardPreview";
import { TemplatePreviewDialog } from "@/components/dashboard/templates/TemplatePreviewDialog";
import {
  categoryLabel,
  resolveTemplateThumbnail,
  statusLabel,
  surfaceLabel,
  TEMPLATE_ACTIONS,
  canArchiveTemplate,
  canEditTemplateMeta,
  visibilityLabel,
} from "@/components/dashboard/templates/templateLabels";
import {
  exportTemplateEnvelope,
  type DashboardTemplateListItem,
} from "@/lib/dashboardTemplates";
import { mapApiError } from "@/lib/apiError";
import { downloadJsonFile } from "@/lib/exportLayoutJson";
import {
  HUB_CARD_BODY_ACTION_RAIL_CLASS,
  HUB_CARD_BODY_CLASS,
  HUB_CARD_BODY_MORE_TRIGGER_CLASS,
  HUB_CARD_PREVIEW_CONTENT_CLASS,
  HUB_CARD_PREVIEW_FRAME_CLASS,
  HUB_CARD_PREVIEW_HOVER_BTN_CLASS,
  HUB_CARD_PREVIEW_HOVER_OUTLINE_BTN_CLASS,
  HUB_CARD_PREVIEW_HOVER_OVERLAY_CLASS,
  HUB_CARD_SHELL_CLASS,
  HUB_CARD_SKELETON_BODY_CLASS,
  HUB_CARD_SKELETON_PREVIEW_CLASS,
  HUB_CARD_SUBTITLE_CLASS,
  HUB_CARD_TITLE_CLASS,
  hubCardPreviewFrameStyle,
} from "@/components/dashboard/hubCardUi";

type VizTemplateCardProps = {
  item: DashboardTemplateListItem;
  canManage: boolean;
  canEdit: boolean;
  onUse: () => void;
  onEditLayout: () => void;
  onOpenSettings: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onDelete: () => void;
  canDelete: boolean;
  pending: boolean;
  /** 首屏卡片 eager 加载 live 预览，减少灰块空壳感 */
  previewEager?: boolean;
};

function sanitizeFilename(name: string): string {
  const trimmed = name.trim() || "template";
  return trimmed.replace(/[^\w\u4e00-\u9fa5-]+/g, "-").replace(/-+/g, "-");
}

export function VizTemplateCard({
  item,
  canManage,
  canEdit,
  onUse,
  onEditLayout,
  onOpenSettings,
  onPublish,
  onArchive,
  onDelete,
  canDelete,
  pending,
  previewEager = false,
}: VizTemplateCardProps) {
  const [exporting, setExporting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const thumbnailSrc = resolveTemplateThumbnail(item.templateKey, item.thumbnailRef);
  const showPublish = canManage && item.status === "draft";
  const showArchive = canArchiveTemplate(item, canManage);
  const showDelete = canDelete;
  const showSettings = canEditTemplateMeta(item, canManage);
  const editLayoutTitle =
    item.visibility === "builtin"
      ? "基于内置模板创建副本并在编辑器中调整布局"
      : "在可视化编辑器中调整布局";
  const metaParts = [
    categoryLabel(item.categoryKey),
    visibilityLabel(item.visibility),
    item.status !== "published" ? statusLabel(item.status) : null,
  ].filter(Boolean);
  const secondaryLine = item.description ?? metaParts.join(" · ");

  const exportMutation = useMutation({
    mutationFn: () => exportTemplateEnvelope(item.id),
    onSuccess: (envelope) => {
      downloadJsonFile(envelope, `${sanitizeFilename(item.name)}-template.json`);
      toast.success(TEMPLATE_ACTIONS.exportTemplate + " JSON 已下载");
    },
    onError: (err) => toast.error(mapApiError(err)),
    onSettled: () => setExporting(false),
  });

  const handleExport = () => {
    setExporting(true);
    exportMutation.mutate();
  };

  return (
    <article className={HUB_CARD_SHELL_CLASS} data-testid={`viz-template-card-${item.id}`}>
      <div
        className={HUB_CARD_PREVIEW_FRAME_CLASS}
        style={hubCardPreviewFrameStyle(item.surfaceKind)}
      >
        <div className={HUB_CARD_PREVIEW_CONTENT_CLASS}>
          <TemplateCardPreview
            templateId={item.id}
            surfaceKind={item.surfaceKind}
            thumbnailSrc={thumbnailSrc}
            eager={previewEager}
            className="h-full"
          />
        </div>
        <div className={HUB_CARD_PREVIEW_HOVER_OVERLAY_CLASS}>
          <Button type="button" variant="primary" size="sm" className={HUB_CARD_PREVIEW_HOVER_BTN_CLASS} disabled={pending} onClick={onUse}>
            {TEMPLATE_ACTIONS.use}
          </Button>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`${HUB_CARD_PREVIEW_HOVER_BTN_CLASS} ${HUB_CARD_PREVIEW_HOVER_OUTLINE_BTN_CLASS}`}
              disabled={pending}
              title={editLayoutTitle}
              onClick={onEditLayout}
            >
              {TEMPLATE_ACTIONS.edit}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`${HUB_CARD_PREVIEW_HOVER_BTN_CLASS} ${HUB_CARD_PREVIEW_HOVER_OUTLINE_BTN_CLASS}`}
            disabled={pending}
            onClick={() => setPreviewOpen(true)}
          >
            {TEMPLATE_ACTIONS.preview}
          </Button>
        </div>
      </div>

      <div className={HUB_CARD_BODY_CLASS}>
        <div className="flex min-w-0 items-stretch gap-2">
          <div className="min-w-0 flex-1">
            <h2 className={HUB_CARD_TITLE_CLASS}>
              {item.name}
            </h2>
            {secondaryLine ? (
              <p className={HUB_CARD_SUBTITLE_CLASS}>
                {secondaryLine}
              </p>
            ) : (
              <p className={HUB_CARD_SUBTITLE_CLASS} aria-hidden="true">&nbsp;</p>
            )}
          </div>
          <div className={HUB_CARD_BODY_ACTION_RAIL_CLASS}>
            <span className="rounded bg-gray-100 px-1.5 py-px text-[10px] font-medium leading-4 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
              {surfaceLabel(item.surfaceKind)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <IconButton
                  type="button"
                  variant="ghost"
                  size="xs"
                  showTooltip={false}
                  disabled={pending || exporting}
                  aria-label={`${item.name} 更多操作`}
                  className={HUB_CARD_BODY_MORE_TRIGGER_CLASS}
                >
                  <MoreHorizontal className="size-3.5" aria-hidden />
                </IconButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[10rem]">
                {canEdit ? (
                  <DropdownMenuItem disabled={pending} onClick={onEditLayout}>
                    <Pencil className="size-4" aria-hidden />
                    {TEMPLATE_ACTIONS.editLayout}
                  </DropdownMenuItem>
                ) : null}
                {showSettings ? (
                  <DropdownMenuItem disabled={pending} onClick={onOpenSettings}>
                    <Settings2 className="size-4" aria-hidden />
                    {TEMPLATE_ACTIONS.templateSettings}
                  </DropdownMenuItem>
                ) : null}
                {canEdit || showSettings ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem disabled={exporting} onClick={handleExport}>
                  <Download className="size-4" aria-hidden />
                  {TEMPLATE_ACTIONS.export}
                </DropdownMenuItem>
                {showPublish ? (
                  <DropdownMenuItem disabled={pending} onClick={onPublish}>
                    {TEMPLATE_ACTIONS.publish}
                  </DropdownMenuItem>
                ) : null}
                {showArchive ? (
                  <>
                    {showPublish ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem disabled={pending} onClick={onArchive}>
                      <Archive className="size-4" aria-hidden />
                      {TEMPLATE_ACTIONS.archive}
                    </DropdownMenuItem>
                  </>
                ) : null}
                {showDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={pending}
                      className="text-error-600 focus:text-error-600 dark:text-error-400"
                      onSelect={(event) => {
                        event.preventDefault();
                        onDelete();
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      {TEMPLATE_ACTIONS.delete}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <TemplatePreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} item={item} />
    </article>
  );
}
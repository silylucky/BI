import { Link } from "react-router";
import { Archive, Copy, Link2, MoreHorizontal, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button, IconButton } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ComponentPayloadPreview } from "@/components/dashboard/viz-components/ComponentPayloadPreview";
import {
  categoryLabel,
  COMPONENT_ACTIONS,
  statusLabel,
  surfaceLabel,
  visibilityLabel,
  widgetTypeLabel,
} from "@/components/dashboard/viz-components/componentLabels";
import type { VizComponentListItem } from "@/lib/vizComponents";
import {
  HUB_CARD_BODY_CLASS,
  HUB_CARD_BODY_MORE_TRIGGER_CLASS,
  HUB_CARD_PREVIEW_CONTENT_CLASS,
  HUB_CARD_PREVIEW_FRAME_CLASS,
  HUB_CARD_PREVIEW_HOVER_BTN_CLASS,
  HUB_CARD_PREVIEW_HOVER_OUTLINE_BTN_CLASS,
  HUB_CARD_PREVIEW_HOVER_OVERLAY_CLASS,
  HUB_CARD_SHELL_CLASS,
  hubCardPreviewFrameStyle,
} from "@/components/dashboard/hubCardUi";

type VizComponentCardProps = {
  item: VizComponentListItem;
  canManage: boolean;
  pending?: boolean;
  onInsert: () => void;
  onViewReferences: () => void;
  onPublish: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

export function VizComponentCard({
  item,
  canManage,
  pending = false,
  onInsert,
  onViewReferences,
  onPublish,
  onArchive,
  onDelete,
}: VizComponentCardProps) {
  const showPublish = canManage && item.status === "draft";
  const showArchive = canManage && item.status === "published";
  const referenceCount = item.referenceCount ?? 0;
  const surfaces = item.surfaceKinds ?? [];
  const editPath = `/admin/viz-components/${item.id}/edit`;

  const metaParts = [
    widgetTypeLabel(item.widgetType),
    categoryLabel(item.categoryKey),
    visibilityLabel(item.visibility),
    item.status !== "published" ? statusLabel(item.status) : null,
  ].filter(Boolean);

  const secondaryLine = item.description ?? metaParts.join(" · ");

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(item.id);
      toast.success("组件 ID 已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  return (
    <article className={HUB_CARD_SHELL_CLASS} data-testid={`viz-component-card-${item.id}`}>
      <div className={HUB_CARD_PREVIEW_FRAME_CLASS} style={hubCardPreviewFrameStyle()}>
        <div className={HUB_CARD_PREVIEW_CONTENT_CLASS}>
          <ComponentPayloadPreview
            widgetType={item.widgetType}
            thumbnailUrl={item.thumbnailUrl}
            className="h-full"
          />
        </div>
        <div className={HUB_CARD_PREVIEW_HOVER_OVERLAY_CLASS}>
          <Button type="button" variant="primary" size="sm" className={HUB_CARD_PREVIEW_HOVER_BTN_CLASS} disabled={pending} asChild>
            <Link to={editPath}>
              <Pencil className="size-3.5" aria-hidden />
              {COMPONENT_ACTIONS.edit}
            </Link>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={`${HUB_CARD_PREVIEW_HOVER_BTN_CLASS} ${HUB_CARD_PREVIEW_HOVER_OUTLINE_BTN_CLASS}`}
            disabled={pending}
            onClick={onInsert}
          >
            {COMPONENT_ACTIONS.insert}
          </Button>
        </div>
      </div>

      <div className={HUB_CARD_BODY_CLASS}>
        <div className="flex min-w-0 items-start gap-1.5">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-theme-sm font-semibold text-gray-900 dark:text-white">
              {item.name}
            </h2>
            {secondaryLine ? (
              <p className="mt-0.5 truncate text-theme-xs text-gray-500 dark:text-gray-400">
                {secondaryLine}
              </p>
            ) : null}
          </div>
          {surfaces.length > 0 ? (
            <div className="flex max-w-[42%] shrink-0 flex-wrap justify-end gap-0.5">
              {surfaces.map((sk) => (
                <span
                  key={sk}
                  className="rounded bg-gray-100 px-1.5 py-px text-[10px] font-medium leading-4 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400"
                >
                  {surfaceLabel(sk)}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="inline-flex min-w-0 items-center gap-1 truncate text-theme-xs text-brand-600 hover:underline dark:text-brand-400"
            onClick={onViewReferences}
          >
            <Link2 className="size-3 shrink-0" aria-hidden />
            引用 {referenceCount}
          </button>
          <div className="ml-auto shrink-0">
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                type="button"
                variant="ghost"
                size="xs"
                showTooltip={false}
                disabled={pending}
                aria-label={`${item.name} 更多操作`}
                className={HUB_CARD_BODY_MORE_TRIGGER_CLASS}
              >
                <MoreHorizontal className="size-3.5" aria-hidden />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              <DropdownMenuItem onClick={onInsert}>
                <Upload className="size-4" aria-hidden />
                {COMPONENT_ACTIONS.insert}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewReferences}>
                <Link2 className="size-4" aria-hidden />
                {COMPONENT_ACTIONS.references}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void copyId()}>
                <Copy className="size-4" aria-hidden />
                复制组件 ID
              </DropdownMenuItem>
              {showPublish ? (
                <DropdownMenuItem onClick={onPublish}>
                  {COMPONENT_ACTIONS.publish}
                </DropdownMenuItem>
              ) : null}
              {showArchive ? (
                <DropdownMenuItem onClick={onArchive}>
                  <Archive className="size-4" aria-hidden />
                  {COMPONENT_ACTIONS.archive}
                </DropdownMenuItem>
              ) : null}
              {canManage ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-error-600 focus:text-error-600 dark:text-error-400"
                    onClick={onDelete}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {COMPONENT_ACTIONS.delete}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </article>
  );
}

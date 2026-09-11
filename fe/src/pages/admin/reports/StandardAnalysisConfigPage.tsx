import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Plus } from "lucide-react";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { ListPageSection } from "@/components/layout/list-page-kit";
import { Button } from "@/components/ui/button";
import { PageErrorBanner } from "@/components/ui/page-error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { mapApiError } from "@/lib/apiError";
import { StandardAnalysisConfigForm } from "./components/StandardAnalysisConfigForm";
import { StandardAnalysisPackList } from "./components/StandardAnalysisPackList";
import { STANDARD_WORKBENCH_GRID_CLASS } from "./components/standardAnalysisUi";
import { STANDARD_PACK_QUERY, standardAnalysisPath } from "./standardRoutes";
import { useStandardAnalysisEditor } from "./useStandardAnalysisEditor";

export function StandardAnalysisConfigPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editor = useStandardAnalysisEditor();
  const {
    packsQuery,
    packs,
    draft,
    setDraft,
    editingKey,
    isCreating,
    activePackKey,
    columnOptions,
    columnKinds,
    deleteOpen,
    setDeleteOpen,
    selectPack,
    startCreate,
    onSave,
    onDelete,
    upsert,
    remove,
    showSavedHint,
    setShowSavedHint,
    isDraftDirty,
  } = editor;

  return (
    <AdminPageShell
      layout="list"
      title="标准分析"
      description="管理分析包：绑定数据集、映射字段、周期快照与可选定时投递。"
      actions={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10"
          onClick={() =>
            navigate(
              standardAnalysisPath(
                searchParams.get(STANDARD_PACK_QUERY) ?? editingKey ?? undefined,
              ),
            )
          }
        >
          <ArrowLeft className="size-4" aria-hidden />
          返回查看结果
        </Button>
      }
    >
      {packsQuery.isError ? (
        <PageErrorBanner message={mapApiError(packsQuery.error)} onRetry={() => packsQuery.refetch()} />
      ) : null}

      {packsQuery.isLoading && packs.length === 0 ? (
        <ListPageSection className="min-h-0 flex-1">
          <div className="flex min-h-[320px] flex-col gap-3 p-4">
            <Skeleton className="h-10 w-full max-w-md" />
            <Skeleton className="h-48 w-full rounded-2xl" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </ListPageSection>
      ) : (
      <ListPageSection className="min-h-0 flex-1">
        <div className="border-b border-gray-200 px-4 py-3 xl:hidden dark:border-gray-800">
          <Select
            value={isCreating ? "__create__" : editingKey ?? ""}
            onValueChange={(value) => {
              if (value === "__create__") {
                startCreate();
                return;
              }
              selectPack(value);
            }}
          >
            <SelectTrigger aria-label="选择分析包" className="h-11">
              <SelectValue placeholder="选择分析包" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__create__">新建分析包</SelectItem>
              {packs.map((pack) => (
                <SelectItem key={pack.packKey} value={pack.packKey}>
                  {pack.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className={STANDARD_WORKBENCH_GRID_CLASS}>
          <div className="hidden min-h-0 min-w-0 overflow-hidden xl:flex">
            <StandardAnalysisPackList
              packs={packs}
              activePackKey={activePackKey}
              isLoading={packsQuery.isLoading}
              onSelect={selectPack}
              emptyHint="暂无分析包，点击右侧新建"
              headerAction={
                <Button type="button" variant="outline" size="sm" className="h-8 px-2.5" onClick={startCreate}>
                  <Plus className="size-4" aria-hidden />
                  新建
                </Button>
              }
            />
          </div>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <StandardAnalysisConfigForm
              draft={draft}
              isCreating={isCreating}
              editingKey={editingKey}
              columnOptions={columnOptions}
              columnKinds={columnKinds}
              saving={upsert.isPending}
              deleting={remove.isPending}
              isDraftDirty={isDraftDirty}
              showSavedHint={showSavedHint}
              onDismissSavedHint={() => setShowSavedHint(false)}
              onChange={(updater) => setDraft((current) => updater(current))}
              onSave={onSave}
              onDelete={() => setDeleteOpen(true)}
            />
          </div>
        </div>
      </ListPageSection>
      )}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除分析包？</AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{draft.displayName || editingKey}」及其快照配置，此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction disabled={remove.isPending} onClick={() => void onDelete()}>
              {remove.isPending ? "删除中…" : "删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminPageShell>
  );
}

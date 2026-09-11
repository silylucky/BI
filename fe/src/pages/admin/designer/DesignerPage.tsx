import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { AdminPageShell } from "@/components/layout/admin-page-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { useUnsavedLeaveGuard } from "@/hooks/use-unsaved-leave-guard";
import { queryKeys } from "@/lib/queryKeys";
import {
  ComputeRulesPanel,
  ConditionsPanel,
  OutputFieldsPanel,
} from "./designer-panels";
import { DesignerSqlPanel } from "./designer-sql-panel";
import { useDesignerWorkspace } from "./useDesignerWorkspace";

function PreviewPanel({
  sql,
  loading,
  mobileTab,
}: {
  sql: string;
  loading: boolean;
  mobileTab?: boolean;
}) {
  return (
    <div className={mobileTab ? "space-y-2" : "sticky top-4 space-y-2"}>
      <h3 className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">SQL 预览</h3>
      {loading ? <Skeleton className="h-48 w-full rounded-xl" /> : null}
      <Textarea
        readOnly
        className="min-h-[200px] font-mono text-theme-xs"
        value={sql || "保存条件后将自动生成预览…"}
        aria-label="SQL 预览"
      />
    </div>
  );
}

export function DesignerPage() {
  const ws = useDesignerWorkspace();
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    workflowInstanceId: string;
    designSnapshotId?: string;
  } | null>(null);
  const [mainTab, setMainTab] = useState("conditions");
  const [mobilePreview, setMobilePreview] = useState(false);

  const datasetsQuery = useQuery({
    queryKey: queryKeys.datasets.list(),
    queryFn: () =>
      apiFetch<{ items: Array<{ datasetId: string; displayName: string }> }>(
        "/api/v1/datasets",
      ),
  });

  const { leaveDialogOpen, confirmLeave, cancelLeave } = useUnsavedLeaveGuard({
    enabled: !ws.allBlocksSaved,
  });

  const handleSubmit = async () => {
    if (!ws.allBlocksSaved) {
      toast.error("请先保存条件、运算规则与输出字段");
      return;
    }
    try {
      const result = await ws.submitWorkflow.mutateAsync();
      setSubmitResult({
        workflowInstanceId: result.workflowInstanceId,
        designSnapshotId: result.designSnapshotId,
      });
      setSubmitOpen(true);
    } catch (err) {
      toast.error(mapApiError(err));
    }
  };

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={ws.saveConditions.isPending}
        onClick={() => void ws.saveConditions.mutateAsync()}
      >
        保存条件
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={ws.saveComputeRules.isPending}
        onClick={() => void ws.saveComputeRules.mutateAsync()}
      >
        保存规则
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={ws.saveOutputFields.isPending}
        onClick={() => void ws.saveOutputFields.mutateAsync()}
      >
        保存输出
      </Button>
      <Button
        type="button"
        variant="primary"
        size="sm"
        disabled={ws.submitWorkflow.isPending}
        onClick={() => void handleSubmit()}
      >
        <Send className="size-4" aria-hidden />
        提交查询服务申请
      </Button>
    </div>
  );

  return (
    <AdminPageShell
      title="查询设计器"
      description="配置查询条件、运算规则与输出字段，预览 SQL 并提交工单审批。"
      actions={actions}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
          <Button
            type="button"
            size="sm"
            variant={ws.designMode === "visual" ? "primary" : "ghost"}
            aria-pressed={ws.designMode === "visual"}
            disabled={ws.designModePending}
            onClick={() => ws.setDesignMode("visual")}
          >
            可视化
          </Button>
          <Button
            type="button"
            size="sm"
            variant={ws.designMode === "sql" ? "primary" : "ghost"}
            aria-pressed={ws.designMode === "sql"}
            disabled={ws.designModePending}
            onClick={() => ws.setDesignMode("sql")}
          >
            传统 SQL
          </Button>
        </div>
        <span className="text-theme-sm text-gray-500 dark:text-gray-400">数据集（可选）</span>
        <Select
          value={ws.datasetId ?? "__none__"}
          onValueChange={(v) => ws.setDatasetId(v === "__none__" ? null : v)}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="选择数据集" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">不关联数据集</SelectItem>
            {(datasetsQuery.data?.items ?? []).map((ds) => (
              <SelectItem key={ds.datasetId} value={ds.datasetId}>
                {ds.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ws.designMode === "sql" ? (
        <div className="lg:grid lg:grid-cols-[1fr_360px] lg:gap-6">
          <DesignerSqlPanel
            refId={ws.designerItemId}
            onSaved={() => ws.setSqlModeSaved(true)}
            onSqlChange={ws.setEditorSql}
          />
          <div className="mt-4 lg:mt-0">
            <PreviewPanel
              sql={ws.editorSql || "保存 SQL 后在此预览…"}
              loading={false}
              mobileTab
            />
          </div>
        </div>
      ) : (
        <>
      <div className="lg:hidden">
        <Tabs value={mobilePreview ? "preview" : mainTab} onValueChange={(v) => {
          if (v === "preview") setMobilePreview(true);
          else {
            setMobilePreview(false);
            setMainTab(v);
          }
        }}>
          <TabsList className="w-full">
            <TabsTrigger value="conditions">条件</TabsTrigger>
            <TabsTrigger value="rules">规则</TabsTrigger>
            <TabsTrigger value="output">输出</TabsTrigger>
            <TabsTrigger value="preview">预览</TabsTrigger>
          </TabsList>
          <TabsContent value="conditions" className="mt-4">
            <ConditionsPanel
              logic={ws.logic}
              onLogicChange={ws.setLogic}
              conditions={ws.conditions}
              onChange={ws.setConditions}
              fieldOptions={ws.fieldOptions}
              fieldErrors={ws.fieldErrors}
            />
          </TabsContent>
          <TabsContent value="rules" className="mt-4">
            <ComputeRulesPanel rules={ws.rules} onChange={ws.setRules} fieldOptions={ws.fieldOptions} />
          </TabsContent>
          <TabsContent value="output" className="mt-4">
            <OutputFieldsPanel
              fields={ws.outputFields}
              aggregates={ws.aggregates}
              onFieldsChange={ws.setOutputFields}
              onAggregatesChange={ws.setAggregates}
              fieldOptions={ws.fieldOptions}
              glossaryOptions={ws.glossaryOptions}
            />
          </TabsContent>
          <TabsContent value="preview" className="mt-4">
            <PreviewPanel sql={ws.previewSql} loading={ws.previewMutation.isPending} mobileTab />
          </TabsContent>
        </Tabs>
      </div>

      <div className="hidden gap-6 lg:grid lg:grid-cols-[1fr_360px]">
        <Tabs value={mainTab} onValueChange={setMainTab}>
          <TabsList>
            <TabsTrigger value="conditions">条件</TabsTrigger>
            <TabsTrigger value="rules">运算规则</TabsTrigger>
            <TabsTrigger value="output">输出字段</TabsTrigger>
          </TabsList>
          <TabsContent value="conditions" className="mt-4">
            <ConditionsPanel
              logic={ws.logic}
              onLogicChange={ws.setLogic}
              conditions={ws.conditions}
              onChange={ws.setConditions}
              fieldOptions={ws.fieldOptions}
              fieldErrors={ws.fieldErrors}
            />
          </TabsContent>
          <TabsContent value="rules" className="mt-4">
            <ComputeRulesPanel rules={ws.rules} onChange={ws.setRules} fieldOptions={ws.fieldOptions} />
          </TabsContent>
          <TabsContent value="output" className="mt-4">
            <OutputFieldsPanel
              fields={ws.outputFields}
              aggregates={ws.aggregates}
              onFieldsChange={ws.setOutputFields}
              onAggregatesChange={ws.setAggregates}
              fieldOptions={ws.fieldOptions}
              glossaryOptions={ws.glossaryOptions}
            />
          </TabsContent>
        </Tabs>
        <PreviewPanel sql={ws.previewSql} loading={ws.previewMutation.isPending} />
      </div>
        </>
      )}

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>工单已提交</DialogTitle>
            <DialogDescription>
              查询服务申请已进入审批流程，可在治理工单中查看进度。
            </DialogDescription>
          </DialogHeader>
          {submitResult ? (
            <div className="space-y-2 font-mono text-theme-xs text-gray-600 dark:text-gray-300">
              <p>工单实例：{submitResult.workflowInstanceId}</p>
              {submitResult.designSnapshotId ? (
                <p className="break-all">
                  快照：/api/v1/designer/snapshots/{submitResult.designSnapshotId}
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSubmitOpen(false)}>
              关闭
            </Button>
            <Button type="button" variant="primary" asChild>
              <Link to="/admin/governance/tickets">查看工单</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={leaveDialogOpen} onOpenChange={(open) => !open && cancelLeave()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>有未保存的更改</DialogTitle>
            <DialogDescription>
              设计器中有未保存的条件、规则或输出字段，离开将丢失这些更改。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelLeave}>
              继续编辑
            </Button>
            <Button type="button" variant="destructive" onClick={confirmLeave}>
              放弃更改并离开
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageShell>
  );
}

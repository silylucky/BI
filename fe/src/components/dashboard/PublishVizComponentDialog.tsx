import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import {
  AdminFormDialogBody,
  AdminFormDialogContent,
  AdminFormDialogDescription,
  AdminFormDialogFooter,
  AdminFormDialogHeader,
  AdminFormField,
} from "@/components/layout/admin-form-dialog";
import { mapApiError } from "@/lib/apiError";
import { isChartExecuteReady } from "@/lib/chartExecuteProbe";
import { readSurfaceKind } from "@/lib/dataScreenLayout";
import {
  createVizComponent,
  extractWidgetPayload,
  normalizePayloadForPortableDemo,
  publishVizComponent,
  VIZ_COMPONENT_CATEGORIES,
  type VizSurfaceKind,
} from "@/lib/vizComponents";
import { TEMPLATE_DEMO_DATASOURCE_REF } from "@/lib/templateDemoData";
import { queryKeys } from "@/lib/queryKeys";
import { persistVizComponentThumbnailFromWidgetBestEffort } from "@/lib/uploadVizComponentThumbnail";
import type { LayoutWidget } from "./layoutUtils";
import type { DashboardStyleConfig } from "./dashboardStyleConfig";
import { resolveLayoutWidget } from "@/lib/resolveVizComponent";
import type { VizComponentMap } from "@/lib/resolveVizComponent";

type PublishVizComponentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widget: LayoutWidget | null;
  styleConfig?: DashboardStyleConfig;
  componentMap?: VizComponentMap;
  onPublished?: (componentId: string) => void;
};

export function PublishVizComponentDialog({
  open,
  onOpenChange,
  widget,
  styleConfig,
  componentMap,
  onPublished,
}: PublishVizComponentDialogProps) {
  const queryClient = useQueryClient();
  const surfaceKind = readSurfaceKind(styleConfig);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryKey, setCategoryKey] = useState("general");
  const [visibility, setVisibility] = useState<"org" | "private">("org");
  const [surfaceKinds, setSurfaceKinds] = useState<VizSurfaceKind[]>([surfaceKind]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!widget || widget.type === "tabs") throw new Error("unsupported widget");
      const resolved = componentMap ? resolveLayoutWidget(widget, componentMap) : widget;
      const payload = normalizePayloadForPortableDemo(extractWidgetPayload(resolved));
      if (widget.type === "chart" && payload.chartConfig) {
        const checkConfig = {
          ...payload.chartConfig,
          dataSourceId:
            payload.chartConfig.dataSourceId || TEMPLATE_DEMO_DATASOURCE_REF,
        };
        if (!isChartExecuteReady(checkConfig)) {
          toast.warning("未配置数据源或 SQL，发布后复用可能无数据", {
            description: "纯样式组件仍可发布；图表请补全查询配置。",
          });
        }
      }
      const created = await createVizComponent({
        name: name.trim() || widget.title,
        description: description.trim() || undefined,
        categoryKey,
        widgetType: widget.type,
        surfaceKinds,
        payloadJson: payload,
        visibility,
      });
      const published = await publishVizComponent(created.id);
      await persistVizComponentThumbnailFromWidgetBestEffort(published.id, widget.id);
      return published;
    },
    onSuccess: (created) => {
      toast.success("已发布到组织组件库");
      void queryClient.invalidateQueries({ queryKey: queryKeys.vizComponents.all });
      onPublished?.(created.id);
      onOpenChange(false);
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next && widget) {
          setName(widget.title);
          setDescription("");
          setCategoryKey("general");
          setVisibility("org");
          setSurfaceKinds([surfaceKind]);
        }
        onOpenChange(next);
      }}
    >
      <AdminFormDialogContent data-testid="publish-viz-component-dialog">
        <AdminFormDialogHeader>
          <DialogTitle>发布到组件库</DialogTitle>
          <AdminFormDialogDescription>
            保存当前配置到组织库。其他看板「复用」时拷贝这一刻的样式与数据绑定，插入后互不影响。
          </AdminFormDialogDescription>
        </AdminFormDialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            publishMutation.mutate();
          }}
        >
          <AdminFormDialogBody>
            <AdminFormField label="组件名称" htmlFor="vc-name">
              <Input id="vc-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </AdminFormField>
            <AdminFormField label="描述" htmlFor="vc-desc">
              <Input
                id="vc-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="可选"
              />
            </AdminFormField>
            <AdminFormField label="分类">
              <Select value={categoryKey} onValueChange={setCategoryKey}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VIZ_COMPONENT_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.key} value={cat.key}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </AdminFormField>
            <AdminFormField label="可见范围">
              <Select value={visibility} onValueChange={(v) => setVisibility(v as "org" | "private")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="org">组织内</SelectItem>
                  <SelectItem value="private">仅自己</SelectItem>
                </SelectContent>
              </Select>
            </AdminFormField>
          </AdminFormDialogBody>
          <AdminFormDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={!widget || publishMutation.isPending}>
              {publishMutation.isPending ? "发布中…" : "发布"}
            </Button>
          </AdminFormDialogFooter>
        </form>
      </AdminFormDialogContent>
    </Dialog>
  );
}

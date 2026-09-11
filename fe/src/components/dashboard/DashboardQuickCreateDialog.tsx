import { useMemo, useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";

import { useNavigate, Link } from "react-router";

import type { ChartType } from "@/lib/chartViewConfig";

import { apiFetch } from "@/lib/api";

import { mapApiError } from "@/lib/apiError";

import { queryKeys } from "@/lib/queryKeys";

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

import { DialogFormSelect } from "@/components/layout/dialog-form-select";

import { createLayoutWidget } from "@/components/dashboard/createLayoutWidget";

import { placeNewWidget } from "@/components/dashboard/gridLayoutAdapter";

import { normalizeWidgetIds } from "@/components/dashboard/layoutUtils";

import { fetchChartExecuteResult, suggestChartFields } from "@/lib/chartExecuteProbe";



type DataSourceListItem = { id: string; name: string; code: string };

type DatasetListItem = {

  datasetId: string;

  displayName: string;

  boundConfigId?: string | null;

};



const CHART_OPTIONS: { value: ChartType; label: string }[] = [

  { value: "bar", label: "柱状图" },

  { value: "line", label: "折线图" },

  { value: "table", label: "表格" },

];



const EMPTY_DS = "__no_ds__";

const EMPTY_DATASET = "__no_dataset__";



type DashboardQuickCreateDialogProps = {

  open: boolean;

  onOpenChange: (open: boolean) => void;

  onBlankCreate?: () => void;

  blankPending?: boolean;

};



export function DashboardQuickCreateDialog({

  open,

  onOpenChange,

  onBlankCreate,

  blankPending,

}: DashboardQuickCreateDialogProps) {

  const navigate = useNavigate();

  const [name, setName] = useState("未命名看板");

  const [dataSourceId, setDataSourceId] = useState("");

  const [datasetId, setDatasetId] = useState("");

  const [chartType, setChartType] = useState<ChartType>("bar");



  const { data: dsData, isLoading: dsLoading } = useQuery({

    queryKey: queryKeys.datasources.list(),

    queryFn: () => apiFetch<{ items: DataSourceListItem[] }>("/api/v1/datasources"),

    enabled: open,

  });



  const { data: datasetData, isLoading: datasetsLoading } = useQuery({

    queryKey: queryKeys.datasets.list({ limit: 200, offset: 0 }),

    queryFn: () =>

      apiFetch<{ items: DatasetListItem[] }>("/api/v1/datasets?limit=200&offset=0"),

    enabled: open,

  });



  const datasourceItems = dsData?.items ?? [];

  const boundDatasets = useMemo(

    () => (datasetData?.items ?? []).filter((d) => Boolean(d.boundConfigId)),

    [datasetData?.items],

  );

  const selectedDataset = boundDatasets.find((d) => d.datasetId === datasetId);



  const dataSourceOptions = useMemo(() => {

    if (dsLoading) return [{ value: EMPTY_DS, label: "加载中…", disabled: true }];

    if (datasourceItems.length === 0) {

      return [{ value: EMPTY_DS, label: "暂无数据源", disabled: true }];

    }

    return datasourceItems.map((ds) => ({ value: ds.id, label: ds.name }));

  }, [dsLoading, datasourceItems]);



  const datasetOptions = useMemo(() => {

    if (datasetsLoading) return [{ value: EMPTY_DATASET, label: "加载中…", disabled: true }];

    if (boundDatasets.length === 0) {

      return [{ value: EMPTY_DATASET, label: "暂无可用 Dataset", disabled: true }];

    }

    return boundDatasets.map((ds) => ({ value: ds.datasetId, label: ds.displayName }));

  }, [datasetsLoading, boundDatasets]);



  const canSubmit = Boolean(

    name.trim() && dataSourceId && datasetId && selectedDataset?.boundConfigId,

  );



  const createMutation = useMutation({

    mutationFn: async () => {

      const slug = `dash-${Date.now()}`;

      const created = await apiFetch<{ id: string }>("/api/v1/dashboards", {

        method: "POST",

        body: JSON.stringify({ name: name.trim() || "未命名看板", slug }),

      });



      const baseWidget = createLayoutWidget(chartType, []);

      let fields = suggestChartFields([], chartType);

      try {

        const probe = await fetchChartExecuteResult({

          chartType,

          mode: "dataset",

          dataSourceId,

          datasetId,

          configId: selectedDataset!.boundConfigId!,

        });

        fields = suggestChartFields(probe.columns, chartType);

      } catch {

        // 探测失败时降级为空 fields，与 Inspector 行为一致

      }

      const widget = placeNewWidget([], {

        ...baseWidget,

        chartConfig: {

          ...baseWidget.chartConfig,

          mode: "dataset",

          dataSourceId,

          datasetId,

          configId: selectedDataset!.boundConfigId!,

          dimensions: fields.dimensions,

          metrics: fields.metrics,

        },

      });



      const normalized = normalizeWidgetIds([widget]);

      await apiFetch(`/api/v1/dashboards/${created.id}/layout`, {

        method: "PUT",

        body: JSON.stringify({

          layoutJson: { version: 1, widgets: normalized, globalFilters: [] },

        }),

      });



      return created;

    },

    onSuccess: (created) => {

      onOpenChange(false);

      navigate(`/admin/dashboards/${created.id}/edit`);

    },

  });



  const resetForm = () => {

    setName("未命名看板");

    setDataSourceId("");

    setDatasetId("");

    setChartType("bar");

    createMutation.reset();

  };



  return (

    <Dialog

      open={open}

      onOpenChange={(next) => {

        if (!next) resetForm();

        onOpenChange(next);

      }}

    >

      <AdminFormDialogContent>

        <AdminFormDialogHeader>

          <DialogTitle>快速创建看板</DialogTitle>

          <AdminFormDialogDescription>

            选择数据源与 Dataset，自动插入首个图表并进入编辑。

          </AdminFormDialogDescription>

        </AdminFormDialogHeader>



        <AdminFormDialogBody>

          <AdminFormField label="看板名称" htmlFor="quick-dash-name">

            <Input

              id="quick-dash-name"

              value={name}

              onChange={(e) => setName(e.target.value)}

              placeholder="未命名看板"

            />

          </AdminFormField>



          <AdminFormField label="数据源" htmlFor="quick-dash-ds">

            <DialogFormSelect

              id="quick-dash-ds"

              value={dataSourceId || undefined}

              placeholder={dsLoading ? "加载中…" : "选择数据源"}

              options={dataSourceOptions}

              onValueChange={setDataSourceId}

            />

          </AdminFormField>



          <AdminFormField label="Dataset" htmlFor="quick-dash-dataset">

            <DialogFormSelect

              id="quick-dash-dataset"

              value={datasetId || undefined}

              placeholder={datasetsLoading ? "加载中…" : "选择已绑定配置的 Dataset"}

              options={datasetOptions}

              onValueChange={setDatasetId}

            />

            {!datasetsLoading && boundDatasets.length === 0 ? (
              <p className="mt-2 text-theme-xs text-gray-500 dark:text-gray-400">
                暂无已绑定查询配置的 Dataset。请先{" "}
                <Link
                  to="/admin/datasets/new"
                  className="text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
                >
                  创建数据集
                </Link>
                ，选表并绑定后再快速创建看板。
              </p>
            ) : null}

          </AdminFormField>



          <AdminFormField label="首个图表类型" htmlFor="quick-dash-chart">

            <DialogFormSelect

              id="quick-dash-chart"

              value={chartType}

              options={CHART_OPTIONS}

              onValueChange={(v) => setChartType(v as ChartType)}

            />

          </AdminFormField>



          {createMutation.isError ? (

            <p className="text-theme-xs text-error-600 dark:text-error-400">

              {mapApiError(createMutation.error)}

            </p>

          ) : null}

        </AdminFormDialogBody>



        <AdminFormDialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch">

          <Button

            type="button"

            variant="primary"

            disabled={!canSubmit || createMutation.isPending}

            onClick={() => createMutation.mutate()}

          >

            {createMutation.isPending ? "创建中…" : "创建并编辑"}

          </Button>

          {onBlankCreate ? (

            <Button

              type="button"

              variant="outline"

              disabled={blankPending || createMutation.isPending}

              onClick={onBlankCreate}

            >

              {blankPending ? "创建中…" : "创建空白看板"}

            </Button>

          ) : null}

        </AdminFormDialogFooter>

      </AdminFormDialogContent>

    </Dialog>

  );

}



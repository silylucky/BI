import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { mapApiError } from "@/lib/apiError";
import { queryKeys } from "@/lib/queryKeys";

import { randomId } from "@/lib/randomId";

const SESSION_KEY = "vitalspan.designerItemId";

export type ConditionRow = {
  fieldId: string;
  operator: string;
  value: string | number | boolean | null;
  valueType: string;
};

export type ComputeRuleRow = {
  id: string;
  name: string;
  ruleType: string;
  targetField: string;
  expression: string;
  dependsOn: string[];
};

export type OutputFieldRow = {
  fieldId: string;
  alias?: string;
  visible: boolean;
  metaFieldRef?: string;
  sortOrder?: number;
};

export type AggregateRow = {
  fn: string;
  fieldId: string;
  groupBy: string[];
};

function loadDesignerItemId(): string {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored) return stored;
  const id = randomId();
  sessionStorage.setItem(SESSION_KEY, id);
  return id;
}

const EMPTY_RULES: ComputeRuleRow[] = [];
const EMPTY_OUTPUT: OutputFieldRow[] = [];
const EMPTY_AGG: AggregateRow[] = [];

export function useDesignerWorkspace() {
  const qc = useQueryClient();
  const [designerItemId] = useState(loadDesignerItemId);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [logic, setLogic] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [rules, setRules] = useState<ComputeRuleRow[]>(EMPTY_RULES);
  const [outputFields, setOutputFields] = useState<OutputFieldRow[]>(EMPTY_OUTPUT);
  const [aggregates, setAggregates] = useState<AggregateRow[]>(EMPTY_AGG);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conditionsSaved, setConditionsSaved] = useState(false);
  const [rulesSaved, setRulesSaved] = useState(false);
  const [outputSaved, setOutputSaved] = useState(false);
  const [sqlModeSaved, setSqlModeSaved] = useState(false);
  const [previewSql, setPreviewSql] = useState("");
  const [editorSql, setEditorSql] = useState("");

  const designModeQuery = useQuery({
    queryKey: queryKeys.designer.designMode(designerItemId),
    queryFn: () =>
      apiFetch<{ mode: "visual" | "sql" }>(
        `/api/v1/designer/design-mode?refId=${designerItemId}`,
      ),
  });

  const conditionsQuery = useQuery({
    queryKey: queryKeys.designer.conditions(designerItemId),
    queryFn: () =>
      apiFetch<{ logic: "AND" | "OR"; conditions: ConditionRow[] }>(
        `/api/v1/designer/conditions?refId=${designerItemId}`,
      ),
    retry: false,
  });

  const computeRulesQuery = useQuery({
    queryKey: queryKeys.designer.computeRules(designerItemId),
    queryFn: () =>
      apiFetch<{ rules: ComputeRuleRow[] }>(
        `/api/v1/designer/compute-rules?refId=${designerItemId}`,
      ),
    retry: false,
  });

  const outputFieldsQuery = useQuery({
    queryKey: queryKeys.designer.outputFields(designerItemId),
    queryFn: () =>
      apiFetch<{ fields: OutputFieldRow[]; aggregates?: AggregateRow[] }>(
        `/api/v1/designer/output-fields?refId=${designerItemId}`,
      ),
    retry: false,
  });

  useEffect(() => {
    if (!conditionsQuery.data) return;
    setLogic(conditionsQuery.data.logic ?? "AND");
    setConditions(conditionsQuery.data.conditions ?? []);
    setConditionsSaved(true);
  }, [conditionsQuery.data]);

  useEffect(() => {
    if (!computeRulesQuery.data) return;
    setRules(computeRulesQuery.data.rules ?? EMPTY_RULES);
    setRulesSaved(true);
  }, [computeRulesQuery.data]);

  useEffect(() => {
    if (!outputFieldsQuery.data) return;
    setOutputFields(outputFieldsQuery.data.fields ?? EMPTY_OUTPUT);
    setAggregates(outputFieldsQuery.data.aggregates ?? EMPTY_AGG);
    setOutputSaved(true);
  }, [outputFieldsQuery.data]);

  const setConditionsDirty = useCallback((next: ConditionRow[] | ((prev: ConditionRow[]) => ConditionRow[])) => {
    setConditions(next);
    setConditionsSaved(false);
  }, []);

  const setRulesDirty = useCallback((next: ComputeRuleRow[] | ((prev: ComputeRuleRow[]) => ComputeRuleRow[])) => {
    setRules(next);
    setRulesSaved(false);
  }, []);

  const setOutputFieldsDirty = useCallback(
    (next: OutputFieldRow[] | ((prev: OutputFieldRow[]) => OutputFieldRow[])) => {
      setOutputFields(next);
      setOutputSaved(false);
    },
    [],
  );

  const setAggregatesDirty = useCallback(
    (next: AggregateRow[] | ((prev: AggregateRow[]) => AggregateRow[])) => {
      setAggregates(next);
      setOutputSaved(false);
    },
    [],
  );

  const setLogicDirty = useCallback((next: "AND" | "OR") => {
    setLogic(next);
    setConditionsSaved(false);
  }, []);

  const designMode = designModeQuery.data?.mode ?? "visual";

  const setModeMutation = useMutation({
    mutationFn: (mode: "visual" | "sql") =>
      apiFetch("/api/v1/designer/design-mode", {
        method: "PUT",
        body: JSON.stringify({ refId: designerItemId, mode }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.designer.designMode(designerItemId) });
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const fieldsQuery = useQuery({
    queryKey: queryKeys.designer.fields(datasetId),
    queryFn: () =>
      apiFetch<{ registry: string[]; glossary: string[]; datasetFields: string[] }>(
        `/api/v1/designer/fields${datasetId ? `?datasetId=${datasetId}` : ""}`,
      ),
  });

  const fieldOptions = useMemo(() => {
    const base = fieldsQuery.data?.registry ?? [];
    const extra = fieldsQuery.data?.datasetFields ?? [];
    return [...new Set([...base, ...extra])];
  }, [fieldsQuery.data]);

  const glossaryOptions = fieldsQuery.data?.glossary ?? [];

  const buildPreviewBody = useCallback(
    () => ({
      conditions: {
        schemaVersion: "1.0",
        logic,
        conditions,
        refType: "design_draft",
        refId: designerItemId,
      },
      computeRules: {
        schemaVersion: "1.0",
        rules,
        refType: "design_draft",
        refId: designerItemId,
      },
      outputFields: {
        schemaVersion: "1.0",
        fields: outputFields.length
          ? outputFields
          : [{ fieldId: "order_amount", visible: true }],
        aggregates,
        refType: "design_draft",
        refId: designerItemId,
      },
      datasetId,
    }),
    [aggregates, conditions, datasetId, designerItemId, logic, outputFields, rules],
  );

  const previewMutation = useMutation({
    mutationFn: async (body: object) =>
      apiFetch<{ sql: string }>("/api/v1/designer/preview/translate", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => setPreviewSql(data.sql),
  });

  const { mutate: previewMutate } = previewMutation;

  useEffect(() => {
    if (!conditions.length) return;
    const timer = window.setTimeout(() => {
      previewMutate(buildPreviewBody());
    }, 400);
    return () => window.clearTimeout(timer);
  }, [buildPreviewBody, conditions, previewMutate]);

  const validateConditions = useCallback(async () => {
    const payload = {
      schemaVersion: "1.0",
      logic,
      conditions,
      refType: "design_draft",
      refId: designerItemId,
    };
    try {
      await apiFetch("/api/v1/designer/conditions/validate", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setFieldErrors({});
      return true;
    } catch (err) {
      setFieldErrors({ _form: mapApiError(err) });
      return false;
    }
  }, [conditions, designerItemId, logic]);

  const saveConditions = useMutation({
    mutationFn: async () => {
      const payload = {
        schemaVersion: "1.0",
        logic,
        conditions,
        refType: "design_draft",
        refId: designerItemId,
      };
      return apiFetch("/api/v1/designer/conditions", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setConditionsSaved(true);
      void qc.invalidateQueries({ queryKey: queryKeys.designer.conditions(designerItemId) });
      toast.success("条件已保存");
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const saveComputeRules = useMutation({
    mutationFn: async () => {
      const payload = {
        schemaVersion: "1.0",
        rules,
        refType: "design_draft",
        refId: designerItemId,
      };
      return apiFetch("/api/v1/designer/compute-rules", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setRulesSaved(true);
      void qc.invalidateQueries({ queryKey: queryKeys.designer.computeRules(designerItemId) });
      toast.success("运算规则已保存");
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const saveOutputFields = useMutation({
    mutationFn: async () => {
      const payload = {
        schemaVersion: "1.0",
        fields: outputFields,
        aggregates,
        refType: "design_draft",
        refId: designerItemId,
      };
      const qs = datasetId ? `?datasetId=${datasetId}` : "";
      return apiFetch(`/api/v1/designer/output-fields${qs}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      setOutputSaved(true);
      void qc.invalidateQueries({ queryKey: queryKeys.designer.outputFields(designerItemId) });
      toast.success("输出字段已保存");
    },
    onError: (err) => toast.error(mapApiError(err)),
  });

  const submitWorkflow = useMutation({
    mutationFn: async () =>
      apiFetch<{
        workflowInstanceId: string;
        designSnapshotId: string;
        status: string;
      }>("/api/v1/designer/submit-workflow", {
        method: "POST",
        body: JSON.stringify({
          designerItemId,
          templateId: "standard_query_release",
          designType: "query",
        }),
      }),
  });

  const allBlocksSaved =
    designMode === "sql" ? sqlModeSaved : conditionsSaved && rulesSaved && outputSaved;

  const setDesignMode = (mode: "visual" | "sql") => {
    void setModeMutation.mutateAsync(mode);
  };

  return {
    designerItemId,
    datasetId,
    setDatasetId,
    designMode,
    setDesignMode,
    designModePending: setModeMutation.isPending,
    editorSql,
    setEditorSql: (next: string) => {
      setEditorSql(next);
      setSqlModeSaved(false);
    },
    sqlModeSaved,
    setSqlModeSaved,
    logic,
    setLogic: setLogicDirty,
    conditions,
    setConditions: setConditionsDirty,
    rules,
    setRules: setRulesDirty,
    outputFields,
    setOutputFields: setOutputFieldsDirty,
    aggregates,
    setAggregates: setAggregatesDirty,
    fieldOptions,
    glossaryOptions,
    fieldErrors,
    fieldsQuery,
    validateConditions,
    saveConditions,
    saveComputeRules,
    saveOutputFields,
    previewMutation,
    previewSql,
    submitWorkflow,
    conditionsSaved,
    rulesSaved,
    outputSaved,
    allBlocksSaved,
    buildPreviewBody,
  };
}

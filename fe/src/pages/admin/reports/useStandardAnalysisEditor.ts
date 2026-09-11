import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { mapApiError } from "@/lib/apiError";
import { fetchDatasetQueryConfig } from "@/lib/datasetChartBinding";
import {
  type AnalysisPack,
  useStandardPackMutations,
  useStandardPacks,
} from "./useStandardAnalysis";
import { createEmptyAnalysisPack } from "./components/standardAnalysisUi";
import { STANDARD_PACK_QUERY } from "./standardRoutes";
import {
  mergeSuggestedFieldMapping,
  validateStandardPackDraft,
} from "./standardAnalysisValidation";

export function buildStandardAnalysisSaveBody(draft: AnalysisPack): AnalysisPack {
  return {
    packKey: draft.packKey,
    displayName: draft.displayName,
    datasetId: draft.datasetId,
    boundConfigId: draft.boundConfigId || undefined,
    dataSourceId: draft.dataSourceId,
    fieldMapping: draft.fieldMapping,
    enabledThemes: draft.enabledThemes,
    allowedRoles: draft.allowedRoles,
    snapshotCronPreset: draft.snapshotCronPreset,
    snapshotRetentionPeriods: draft.snapshotRetentionPeriods ?? 12,
  };
}

export function useStandardAnalysisEditor() {
  const [searchParams, setSearchParams] = useSearchParams();
  const packsQuery = useStandardPacks();
  const packs = packsQuery.data?.items ?? [];
  const { upsert, remove } = useStandardPackMutations();

  const [draft, setDraft] = useState<AnalysisPack>(createEmptyAnalysisPack());
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [showSavedHint, setShowSavedHint] = useState(false);
  const savingRef = useRef(false);

  const savedPack = useMemo(
    () => (editingKey ? packs.find((pack) => pack.packKey === editingKey) : undefined),
    [editingKey, packs],
  );
  const isDraftDirty = useMemo(() => {
    const draftBody = JSON.stringify(buildStandardAnalysisSaveBody(draft));
    if (isCreating) {
      return draftBody !== JSON.stringify(buildStandardAnalysisSaveBody(createEmptyAnalysisPack()));
    }
    if (!savedPack) return false;
    return draftBody !== JSON.stringify(buildStandardAnalysisSaveBody(savedPack));
  }, [draft, isCreating, savedPack]);

  const effectiveBoundConfigId = draft.boundConfigId ?? "";
  const boundConfigQuery = useQuery({
    queryKey: ["reports", "standard-config-bound", effectiveBoundConfigId],
    queryFn: () => fetchDatasetQueryConfig(effectiveBoundConfigId),
    enabled: Boolean(effectiveBoundConfigId),
  });

  const columnOptions = useMemo(
    () => boundConfigQuery.data?.columns ?? [],
    [boundConfigQuery.data?.columns],
  );
  const columnKinds = boundConfigQuery.data?.columnKinds;

  useEffect(() => {
    if (columnOptions.length === 0) return;
    setDraft((current) => {
      const nextMapping = mergeSuggestedFieldMapping(
        current.fieldMapping,
        columnOptions,
        columnKinds,
      );
      if (
        nextMapping.status === current.fieldMapping.status &&
        nextMapping.region === current.fieldMapping.region &&
        nextMapping.createdAt === current.fieldMapping.createdAt
      ) {
        return current;
      }
      return { ...current, fieldMapping: nextMapping };
    });
  }, [columnOptions, columnKinds, draft.datasetId, draft.boundConfigId]);

  const selectPack = (packKey: string) => {
    const pack = packs.find((item) => item.packKey === packKey);
    if (!pack) return;
    setShowSavedHint(false);
    setIsCreating(false);
    setEditingKey(pack.packKey);
    setDraft(pack);
    const params = new URLSearchParams(searchParams);
    params.set(STANDARD_PACK_QUERY, packKey);
    setSearchParams(params, { replace: true });
  };

  const startCreate = () => {
    setShowSavedHint(false);
    setIsCreating(true);
    setEditingKey(null);
    setDraft(createEmptyAnalysisPack());
    const params = new URLSearchParams(searchParams);
    params.delete(STANDARD_PACK_QUERY);
    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    if (bootstrapped || isCreating || editingKey || packs.length === 0) return;
    const packFromUrl = searchParams.get(STANDARD_PACK_QUERY);
    const initial = packFromUrl ? packs.find((pack) => pack.packKey === packFromUrl) : packs[0];
    if (!initial) return;
    setDraft(initial);
    setEditingKey(initial.packKey);
    setBootstrapped(true);
  }, [bootstrapped, editingKey, isCreating, packs, searchParams]);

  const onSave = async (): Promise<boolean> => {
    if (savingRef.current || upsert.isPending) return false;
    if (!isCreating && !isDraftDirty) return false;
    if (!draft.packKey.trim()) {
      toast.error("请填写分析包标识", { id: "std-pack-save" });
      return false;
    }
    if (!draft.displayName.trim()) {
      toast.error("请填写显示名称", { id: "std-pack-save" });
      return false;
    }
    if (!draft.datasetId) {
      toast.error("请选择数据集", { id: "std-pack-save" });
      return false;
    }
    if (draft.datasetId && !draft.boundConfigId) {
      toast.error("请完成数据集查询绑定", { id: "std-pack-save" });
      return false;
    }
    if (!draft.dataSourceId) {
      toast.error("数据源未就绪，请确认数据集已绑定查询", { id: "std-pack-save" });
      return false;
    }
    if (draft.enabledThemes.length === 0) {
      toast.error("请至少启用一个分析主题", { id: "std-pack-save" });
      return false;
    }

    const mappingError = validateStandardPackDraft(draft, columnOptions, columnKinds);
    if (mappingError) {
      toast.error(mappingError, { id: "std-pack-save" });
      return false;
    }

    savingRef.current = true;
    try {
      const body = buildStandardAnalysisSaveBody(draft);
      const saved = await upsert.mutateAsync({ packKey: draft.packKey, body });
      setEditingKey(saved.packKey);
      setIsCreating(false);
      setBootstrapped(true);
      setDraft(saved);
      setShowSavedHint(true);
      const params = new URLSearchParams(searchParams);
      params.set(STANDARD_PACK_QUERY, saved.packKey);
      setSearchParams(params, { replace: true });
      toast.success("分析包已保存", { id: "std-pack-save" });
      return true;
    } catch (err) {
      toast.error(mapApiError(err), { id: "std-pack-save" });
      return false;
    } finally {
      savingRef.current = false;
    }
  };

  const onDelete = async () => {
    if (!editingKey) return;
    try {
      await remove.mutateAsync(editingKey);
      setDeleteOpen(false);
      const remaining = packs.filter((pack) => pack.packKey !== editingKey);
      if (remaining[0]) {
        selectPack(remaining[0].packKey);
      } else {
        startCreate();
      }
      toast.success("分析包已删除");
    } catch (err) {
      toast.error(mapApiError(err));
    }
  };

  return {
    packsQuery,
    packs,
    draft,
    setDraft,
    editingKey,
    isCreating,
    activePackKey: isCreating ? null : editingKey,
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
  };
}

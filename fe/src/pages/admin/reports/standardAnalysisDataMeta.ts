export type StandardAnalysisRenderMeta = {
  sourceRowCount?: number;
  aggregatedPointCount?: number;
  queryLimit?: number;
  timeStep?: "daily" | "weekly" | "monthly" | null;
  timeStepLabel?: string | null;
  topN?: number | null;
  topNTruncated?: boolean;
  pointCap?: number | null;
  pointCapApplied?: boolean;
  sampleBased?: boolean;
  translationNote?: string;
  translationApplied?: boolean;
};

function formatCount(value: number | undefined): string | null {
  if (value === undefined || Number.isNaN(value)) return null;
  return value.toLocaleString("zh-CN");
}

/** 完整数据口径说明（运维折叠区等场景；默认不在主视图常显） */
export function buildStandardAnalysisDataMetaNote(meta: StandardAnalysisRenderMeta | undefined): string | null {
  if (!meta) return null;

  const parts: string[] = [];
  const sourceRows = formatCount(meta.sourceRowCount);
  const queryLimit = formatCount(meta.queryLimit);

  if (meta.sampleBased && sourceRows) {
    if (queryLimit && meta.sourceRowCount !== undefined && meta.sourceRowCount >= (meta.queryLimit ?? 0)) {
      parts.push(`基于 ${sourceRows} 行样本聚合（已达查询上限 ${queryLimit} 行）`);
    } else {
      parts.push(`基于 ${sourceRows} 行样本聚合`);
    }
  } else if (sourceRows) {
    parts.push(`共 ${sourceRows} 行`);
  }

  if (meta.timeStepLabel) {
    parts.push(`${meta.timeStepLabel}展示`);
  }

  if (meta.topN && meta.topNTruncated) {
    parts.push(`维度 Top ${meta.topN}（其余合并为「其他」）`);
  } else if (meta.topN) {
    parts.push(`展示前 ${meta.topN} 项`);
  }

  if (meta.pointCapApplied && meta.pointCap) {
    parts.push(`仅保留最近 ${meta.pointCap} 个时间点`);
  }

  if (meta.translationNote) {
    parts.push(meta.translationNote);
  }

  return parts.length > 0 ? parts.join("，") + "。" : null;
}

/** 仅当数据可能不完整/需留意时提示；常规样本聚合不在主视图打扰用户 */
export function buildStandardAnalysisDataWarningNote(
  meta: StandardAnalysisRenderMeta | undefined,
): string | null {
  if (!meta) return null;

  const parts: string[] = [];
  const sourceRows = formatCount(meta.sourceRowCount);
  const queryLimit = formatCount(meta.queryLimit);

  if (
    meta.sampleBased &&
    meta.sourceRowCount !== undefined &&
    meta.queryLimit !== undefined &&
    meta.sourceRowCount >= meta.queryLimit
  ) {
    parts.push(`查询已触达上限 ${queryLimit} 行，当前仅基于 ${sourceRows} 行样本聚合，结果可能未覆盖全量数据`);
  }

  if (meta.topN && meta.topNTruncated) {
    parts.push(`维度仅展示 Top ${meta.topN}，其余已合并为「其他」`);
  }

  if (meta.translationNote) {
    parts.push(meta.translationNote);
  }

  return parts.length > 0 ? parts.join("；") + "。" : null;
}

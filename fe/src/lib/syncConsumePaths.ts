/** 同步成功后的 Dataset 新建页 deep link（对标 DE「选表建数据集」）。 */
export function buildDatasetCreatePath(params: {
  targetTable: string;
  suggestedDatasetId?: string;
  dataSourceId?: string;
}): string {
  const search = new URLSearchParams();
  search.set("targetTable", params.targetTable);
  const suggested = params.suggestedDatasetId?.trim() || params.targetTable.trim();
  if (suggested) {
    search.set("suggestedDatasetId", suggested);
  }
  if (params.dataSourceId) {
    search.set("dataSourceId", params.dataSourceId);
  }
  return `/admin/datasets/new?${search.toString()}`;
}

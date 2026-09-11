import { mapApiError } from "@/lib/apiError";

export type BatchDeleteFailure<T extends string = string> = {
  id: T;
  message: string;
};

/** 顺序执行单项删除；收集成功/失败数量与失败明细（无批量 API 时的通用策略） */
export async function runBatchDelete<T extends string>(
  ids: Iterable<T>,
  deleteOne: (id: T) => Promise<void>,
): Promise<{ ok: number; failed: number; failures: BatchDeleteFailure<T>[] }> {
  let ok = 0;
  let failed = 0;
  const failures: BatchDeleteFailure<T>[] = [];
  for (const id of ids) {
    try {
      await deleteOne(id);
      ok += 1;
    } catch (err) {
      failed += 1;
      failures.push({ id, message: mapApiError(err) });
    }
  }
  return { ok, failed, failures };
}

export function formatBatchDeleteToast(
  ok: number,
  failed: number,
  failures: BatchDeleteFailure[],
  entityLabel: string,
): { variant: "success" | "warning"; message: string } {
  if (failed === 0) {
    return { variant: "success", message: `已删除 ${ok} 个${entityLabel}` };
  }
  const detail = failures
    .slice(0, 3)
    .map((f) => f.message)
    .join("；");
  const suffix = failures.length > 3 ? "…" : "";
  return {
    variant: "warning",
    message: `已删除 ${ok} 个，${failed} 个失败：${detail}${suffix}`,
  };
}

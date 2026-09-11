import { fetchVizComponents } from "@/lib/vizComponents";

/** 分页拉取全库尚无 thumbnailUrl 的组件 id（不受 Hub 当前筛选项限制） */
export async function listVizComponentsMissingThumbnail(includeDrafts: boolean): Promise<string[]> {
  const ids: string[] = [];
  const limit = 100;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const page = await fetchVizComponents({ includeDrafts, limit, offset });
    total = page.total;
    for (const item of page.items) {
      if (!item.thumbnailUrl?.trim()) ids.push(item.id);
    }
    if (page.items.length === 0) break;
    offset += page.items.length;
  }

  return ids;
}

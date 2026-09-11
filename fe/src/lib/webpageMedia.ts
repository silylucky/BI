/** 校验网页素材 iframe 地址（仅 http/https） */
export function isWebpageMediaUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function normalizeWebpageMediaUrl(value: string): string {
  return value.trim();
}

const STORAGE_KEY = "vitalspan.reportCenter.pinnedStandard";

export function readPinnedStandardKeys(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export function writePinnedStandardKeys(keys: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
}

export function togglePinnedStandardKey(key: string): string[] {
  const current = readPinnedStandardKeys();
  const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
  writePinnedStandardKeys(next);
  return next;
}

export function sortStandardByPin<T extends { packKey: string }>(items: T[], pinned: string[]): T[] {
  if (pinned.length === 0) return items;
  const pinSet = new Set(pinned);
  return [...items].sort((a, b) => {
    const aPin = pinSet.has(a.packKey);
    const bPin = pinSet.has(b.packKey);
    if (aPin === bPin) return 0;
    return aPin ? -1 : 1;
  });
}

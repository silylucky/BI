export function deepMergeOptions<T extends Record<string, unknown>>(
  base: T,
  overrides?: Record<string, unknown>,
): T {
  if (!overrides) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object") {
      out[k] = deepMergeOptions(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}

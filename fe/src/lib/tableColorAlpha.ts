/** 将 hex / rgb / rgba 颜色乘以 alpha（用于表格不透明度与透明底壳对齐） */
export function applyColorAlpha(color: string, alpha: number): string {
  const factor = Math.min(1, Math.max(0, alpha));
  if (factor >= 1) return color;
  const trimmed = color.trim();
  const rgbaMatch = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i,
  );
  if (rgbaMatch) {
    const r = Number(rgbaMatch[1]);
    const g = Number(rgbaMatch[2]);
    const b = Number(rgbaMatch[3]);
    const a = rgbaMatch[4] != null ? Number(rgbaMatch[4]) : 1;
    return `rgba(${r}, ${g}, ${b}, ${a * factor})`;
  }
  const hex = trimmed.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    const raw = hex[1];
    const expand =
      raw.length === 3
        ? raw
            .split("")
            .map((c) => c + c)
            .join("")
        : raw.length === 4
          ? raw
              .split("")
              .map((c) => c + c)
              .join("")
          : raw.slice(0, 6);
    const r = parseInt(expand.slice(0, 2), 16);
    const g = parseInt(expand.slice(2, 4), 16);
    const b = parseInt(expand.slice(4, 6), 16);
    const a =
      raw.length === 8 || raw.length === 4
        ? parseInt(raw.length === 4 ? raw[3]! + raw[3]! : raw.slice(6, 8), 16) / 255
        : 1;
    return `rgba(${r}, ${g}, ${b}, ${a * factor})`;
  }
  return color;
}

/** 单元格透明时，表头/底栏用 color-mix 与透明底对齐 */
export function softenTableChromeBg(color: string, mixPercent = 72): string {
  const trimmed = color.trim();
  if (!trimmed || trimmed === "transparent") return trimmed;
  return `color-mix(in srgb, ${trimmed} ${mixPercent}%, transparent)`;
}

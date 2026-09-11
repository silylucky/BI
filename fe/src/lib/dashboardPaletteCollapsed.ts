const STORAGE_KEY = "vs:dashboard-palette-open";

/** @deprecated use readPaletteOpen */
export function readPaletteCollapsed(): boolean {
  return !readPaletteOpen();
}

/** @deprecated use writePaletteOpen */
export function writePaletteCollapsed(collapsed: boolean): void {
  writePaletteOpen(!collapsed);
}

export function readPaletteOpen(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const legacy = window.localStorage.getItem("vs:dashboard-palette-collapsed");
    if (legacy === "1") return false;
    const value = window.localStorage.getItem(STORAGE_KEY);
    if (value === "0") return false;
    if (value === "1") return true;
    return true;
  } catch {
    return true;
  }
}

export function writePaletteOpen(open: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    window.localStorage.removeItem("vs:dashboard-palette-collapsed");
  } catch {
    /* ignore quota / private mode */
  }
}

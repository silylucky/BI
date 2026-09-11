/** pathname 是否匹配导航 path（精确或子路径） */
export function navPathMatches(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** 在同级候选 paths 中，仅最长（最具体）匹配者为 active */
export function resolveActiveNavPath(pathname: string, candidatePaths: string[]): string | null {
  const matches = candidatePaths.filter((path) => navPathMatches(pathname, path));
  if (matches.length === 0) return null;
  return matches.reduce((best, current) => (current.length > best.length ? current : best));
}

export function isNavPathActive(pathname: string, path: string, siblingPaths: string[]): boolean {
  return resolveActiveNavPath(pathname, siblingPaths) === path;
}

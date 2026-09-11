import { isOriginAllowed } from "./EmbedSharePanel";

export function resolveEmbedAllowedOrigins(searchParams: URLSearchParams): string[] {
  const raw = searchParams.get("allowedOrigins");
  if (raw) return raw.split(",").filter(Boolean);
  return [window.location.origin];
}

/**
 * 前端 embed 来源门禁：公开链 / 有效 token / 无 token 时 origin 白名单。
 * 含 token 时不再校验 FE origin（iframe 内文档源恒为 VitalSpan；portal 白名单在 sdk-params 签发层校验）。
 */
export function isEmbedPageAuthorized(
  searchParams: URLSearchParams,
  parentOrigin: string,
  hasToken: boolean,
): boolean {
  if (searchParams.get("shareMode") === "public") return true;
  if (hasToken) return true;
  return isOriginAllowed(parentOrigin, resolveEmbedAllowedOrigins(searchParams));
}

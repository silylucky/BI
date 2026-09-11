import type { RequestParameters, ResourceType } from "maplibre-gl";

const STRIPPED_HEADERS = new Set(["authorization", "cookie", "x-export-token"]);

/** 瓦片/资源请求不得携带平台 JWT 或 Cookie。 */
export function gisMapTransformRequest(url: string, resourceType?: ResourceType): RequestParameters {
  void resourceType;
  return { url };
}

export function stripPlatformAuthHeaders(headers?: HeadersInit): HeadersInit | undefined {
  if (!headers) return undefined;
  if (headers instanceof Headers) {
    const next = new Headers(headers);
    for (const key of [...next.keys()]) {
      if (STRIPPED_HEADERS.has(key.toLowerCase())) next.delete(key);
    }
    return next;
  }
  if (Array.isArray(headers)) {
    return headers.filter(([key]) => !STRIPPED_HEADERS.has(String(key).toLowerCase()));
  }
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (STRIPPED_HEADERS.has(key.toLowerCase())) continue;
    next[key] = value;
  }
  return next;
}

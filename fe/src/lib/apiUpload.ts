import { fetchWithTimeout, getAuthHeaders } from "@/lib/api";
import { resolveApiBaseUrl } from "@/lib/appBasePath";

const API_BASE = resolveApiBaseUrl();

export async function apiUploadBlob(
  path: string,
  blob: Blob,
  contentType: string,
  method = "PUT",
): Promise<void> {
  if (blob.size < 32) {
    throw new Error("Upload blob empty");
  }
  const response = await fetchWithTimeout(`${API_BASE}${path}`, {
    method,
    body: blob,
    headers: {
      "Content-Type": contentType.split(";")[0]?.trim() || contentType,
      ...getAuthHeaders(),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Upload failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ""}`);
  }
}

export async function fetchAuthenticatedBlob(path: string): Promise<Blob> {
  const response = await fetchWithTimeout(`${API_BASE}${path}`, {
    headers: {
      ...getAuthHeaders(),
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch blob failed (${response.status})`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const blob = await response.blob();
  if (contentType.includes("application/json") || blob.type.includes("json")) {
    throw new Error("Fetch blob returned JSON, not an image");
  }
  if (blob.size < 32) {
    throw new Error("Fetch blob empty");
  }
  return blob;
}

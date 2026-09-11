import { useEffect, useRef, useState } from "react";
import { fetchAuthenticatedBlob } from "@/lib/apiUpload";

export type AuthenticatedBlobUrlState = {
  url: string | null;
  loading: boolean;
  error: boolean;
};

/** 换 URL 时先保留旧图，避免 revoke 后 img onError 被当成加载失败 */
export function useAuthenticatedBlobUrl(path: string | null | undefined): AuthenticatedBlobUrlState {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path?.trim()));
  const [error, setError] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!path) {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      setUrl(null);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    void fetchAuthenticatedBlob(path)
      .then((blob) => {
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = next;
        setUrl(next);
        setLoading(false);
        setError(false);
      })
      .catch(() => {
        if (cancelled) return;
        if (urlRef.current) {
          URL.revokeObjectURL(urlRef.current);
          urlRef.current = null;
        }
        setUrl(null);
        setLoading(false);
        setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(
    () => () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    },
    [],
  );

  return { url, loading, error };
}

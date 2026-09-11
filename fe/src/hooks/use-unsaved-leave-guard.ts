import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

type LeaveGuardOptions = {
  enabled: boolean;
};

function sameDocumentPath(a: string, b: string): boolean {
  return a === b;
}

export function useUnsavedLeaveGuard({ enabled }: LeaveGuardOptions) {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const pendingPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a[href]");
      if (!anchor || anchor.getAttribute("target") === "_blank") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.origin);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;

      const next = `${url.pathname}${url.search}${url.hash}`;
      const current = `${location.pathname}${location.search}${location.hash}`;
      if (sameDocumentPath(next, current)) return;

      event.preventDefault();
      event.stopPropagation();
      pendingPathRef.current = next;
      setOpen(true);
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [enabled, location.pathname, location.search, location.hash]);

  const confirmLeave = useCallback(() => {
    const next = pendingPathRef.current;
    pendingPathRef.current = null;
    setOpen(false);
    if (next) navigate(next);
  }, [navigate]);

  const cancelLeave = useCallback(() => {
    pendingPathRef.current = null;
    setOpen(false);
  }, []);

  return {
    leaveDialogOpen: open,
    confirmLeave,
    cancelLeave,
  };
}

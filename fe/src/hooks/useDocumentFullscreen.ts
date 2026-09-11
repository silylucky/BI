import { useCallback, useEffect, useState } from "react";

function readIsFullscreen() {
  return typeof document !== "undefined" && document.fullscreenElement != null;
}

/** 同步浏览器全屏状态，并提供 documentElement 级切换。 */
export function useDocumentFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(readIsFullscreen);

  useEffect(() => {
    const onChange = () => setIsFullscreen(readIsFullscreen());
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void document.documentElement.requestFullscreen?.();
  }, []);

  return { isFullscreen, toggleFullscreen };
}

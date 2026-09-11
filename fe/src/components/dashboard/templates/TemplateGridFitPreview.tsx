import { useEffect, useRef, useState, type ReactNode } from "react";
import type { DashboardLayout } from "@/components/dashboard/layoutUtils";
import {
  resolveTemplateGridFitScale,
  type TemplateGridFitMode,
} from "./templateGridFitScale";

type TemplateGridFitPreviewProps = {
  layout: DashboardLayout;
  fitMode?: TemplateGridFitMode;
  children: ReactNode;
};

/** 仪表板 v1 栅格在窄卡片 / 预览弹窗内 scale-to-fit */
export function TemplateGridFitPreview({
  layout,
  fitMode = "card",
  children,
}: TemplateGridFitPreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const host = hostRef.current;
    const content = contentRef.current;
    if (!host || !content) return undefined;

    const update = () => {
      const naturalHeight = content.scrollHeight;
      const naturalWidth = content.scrollWidth;
      if (naturalHeight <= 0 || naturalWidth <= 0) return;
      setScale(
        resolveTemplateGridFitScale(host.clientHeight, naturalHeight, {
          mode: fitMode,
          availableWidth: host.clientWidth,
          contentWidth: naturalWidth,
        }),
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(host);
    observer.observe(content);
    return () => observer.disconnect();
  }, [layout.widgets, fitMode]);

  const centered = fitMode === "dialog";

  return (
    <div
      ref={hostRef}
      className={
        centered
          ? "flex h-full w-full items-center justify-center overflow-hidden"
          : "h-full w-full overflow-hidden"
      }
      data-testid="template-grid-fit-host"
      data-fit-mode={fitMode}
    >
      <div
        ref={contentRef}
        className={centered ? "origin-center" : "origin-top-left"}
        style={{
          width: scale > 0 ? `${100 / scale}%` : "100%",
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

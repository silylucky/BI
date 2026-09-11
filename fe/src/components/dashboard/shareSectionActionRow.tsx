import type { ReactNode } from "react";

type ShareSectionActionRowProps = {
  description: ReactNode;
  actions: ReactNode;
  className?: string;
};

/** 分享页操作行：说明居左、按钮/链接居右（对齐「高级嵌入配置」） */
export function ShareSectionActionRow({
  description,
  actions,
  className,
}: ShareSectionActionRowProps) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className ?? ""}`}>
      <div className="min-w-0 flex-1 space-y-2">{description}</div>
      <div className="flex shrink-0 flex-col items-end gap-2">{actions}</div>
    </div>
  );
}

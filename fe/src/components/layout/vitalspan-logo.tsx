import { Activity } from "lucide-react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

export type VitalSpanLogoProps = {
  /** full：图标 + 名称；icon：仅图标（侧栏折叠） */
  variant?: "full" | "icon";
  /** 是否自带链接；顶栏等外层已包 Link 时传 false */
  linked?: boolean;
  className?: string;
};

function VitalSpanLogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-500 shadow-theme-xs",
        className,
      )}
      aria-hidden
    >
      <Activity className="size-6 text-white" strokeWidth={2.25} />
    </span>
  );
}

export function VitalSpanLogo({
  variant = "full",
  linked = true,
  className,
}: VitalSpanLogoProps) {
  const content =
    variant === "icon" ? (
      <VitalSpanLogoMark />
    ) : (
      <>
        <VitalSpanLogoMark />
        <span className="text-theme-xl font-semibold text-gray-900 dark:text-white">
          VitalSpan
        </span>
      </>
    );

  const rootClass = cn(
    variant === "icon"
      ? "inline-flex items-center justify-center"
      : "inline-flex items-center gap-3",
    className,
  );

  if (!linked) {
    return (
      <span className={rootClass} aria-label="VitalSpan">
        {content}
      </span>
    );
  }

  return (
    <Link to="/admin" className={rootClass} aria-label="VitalSpan">
      {content}
    </Link>
  );
}

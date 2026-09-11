import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { buildEmbedShareUrl } from "@/lib/appBasePath";
import { mapApiError } from "@/lib/apiError";
import { ShareIssuedUrlPanel } from "@/components/dashboard/ShareIssuedUrlPanel";
import { ShareDialogListItem } from "@/components/dashboard/ShareDialogSection";
import { cn } from "@/lib/utils";

type ChartEmbedShareActionsProps = {
  chartId: string;
  mode?: "public" | "embed";
  theme?: "light" | "dark";
  title?: ReactNode;
  layout?: "inline" | "list" | "block";
};

export function ChartEmbedShareActions({
  chartId,
  mode = "public",
  theme = "light",
  title,
  layout = title ? "list" : "block",
}: ChartEmbedShareActionsProps) {
  const [issuing, setIssuing] = useState(false);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);

  const issueLink = async () => {
    setIssuing(true);
    try {
      const tokenResp = await apiFetch<{ embedUrl: string }>("/api/v1/embed/token", {
        method: "POST",
        body: JSON.stringify(
          mode === "public"
            ? { chartId, shareMode: "public", theme }
            : {
                chartId,
                allowedOrigins: [window.location.origin],
                theme,
              },
        ),
      });
      setEmbedUrl(buildEmbedShareUrl(tokenResp.embedUrl));
      toast.success(mode === "public" ? "公开链接已生成" : "嵌入链接已生成");
    } catch (err) {
      toast.error(mapApiError(err));
    } finally {
      setIssuing(false);
    }
  };

  const buttonVariant = layout === "list" ? "outline" : "primary";
  const button = (
    <Button
      type="button"
      size="sm"
      variant={buttonVariant}
      disabled={issuing}
      onClick={() => void issueLink()}
    >
      {issuing ? "签发中…" : mode === "public" ? "生成公开链接" : "签发嵌入链接"}
    </Button>
  );

  const titleNode =
    typeof title === "string" ? (
      <span className="min-w-0 flex-1 truncate text-theme-sm text-gray-700 dark:text-gray-300">
        {title}
      </span>
    ) : (
      title
    );

  if (layout === "list" && title) {
    return (
      <ShareDialogListItem className={cn(embedUrl && "flex-col items-stretch gap-2.5")}>
        <div className="flex w-full items-center justify-between gap-3">
          {titleNode}
          {!embedUrl ? <div className="shrink-0">{button}</div> : null}
        </div>
        {embedUrl ? <ShareIssuedUrlPanel url={embedUrl} /> : null}
      </ShareDialogListItem>
    );
  }

  if (!embedUrl) {
    if (layout === "inline" && title) {
      return (
        <div className="flex items-center justify-between gap-3">
          {titleNode}
          <div className="shrink-0">{button}</div>
        </div>
      );
    }
    return button;
  }

  if (title) {
    return (
      <div className="space-y-2.5">
        {titleNode}
        <ShareIssuedUrlPanel url={embedUrl} />
      </div>
    );
  }

  return <ShareIssuedUrlPanel url={embedUrl} />;
}

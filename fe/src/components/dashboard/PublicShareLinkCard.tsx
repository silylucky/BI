import { useState } from "react";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { buildEmbedShareUrl } from "@/lib/appBasePath";
import { mapApiError } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { ShareIssuedUrlPanel } from "@/components/dashboard/ShareIssuedUrlPanel";
import {
  ShareDialogNotice,
  ShareDialogSection,
} from "@/components/dashboard/ShareDialogSection";
import {
  SHARE_SECTION_CARD_CLASS,
  SHARE_SECTION_CARD_HEADER_CLASS,
} from "@/components/dashboard/sharePageUi";

type PublicShareLinkCardProps = {
  dashboardId: string;
  name: string;
  theme?: "light" | "dark";
  density?: "default" | "compact";
  /** dialog：弹窗内平铺分区；card：独立 Card（全页分享等） */
  variant?: "dialog" | "card";
  className?: string;
};

export function PublicShareLinkCard({
  dashboardId,
  name,
  theme = "light",
  density = "default",
  variant = "dialog",
  className,
}: PublicShareLinkCardProps) {
  const [issuing, setIssuing] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  const issuePublicLink = async () => {
    setIssuing(true);
    try {
      const tokenResp = await apiFetch<{ embedUrl: string }>("/api/v1/embed/token", {
        method: "POST",
        body: JSON.stringify({
          dashboardId,
          shareMode: "public",
          theme,
        }),
      });
      setPublicUrl(buildEmbedShareUrl(tokenResp.embedUrl));
      toast.success("公开链接已生成");
    } catch (err) {
      toast.error(mapApiError(err));
    } finally {
      setIssuing(false);
    }
  };

  const actionButton = publicUrl ? null : (
    <Button
      type="button"
      size="sm"
      variant="primary"
      disabled={issuing}
      onClick={() => void issuePublicLink()}
    >
      {issuing ? "签发中…" : "生成公开链接"}
    </Button>
  );

  const description =
    variant === "dialog" || density === "compact" ? (
      <>只读外链，默认 7 天有效；持有链接者无需登录即可查看「{name}」。</>
    ) : (
      <>
        生成默认 7 天有效的只读链接，持有链接者无需登录即可在浏览器中查看「{name}」。链接路径为
        /embed/screen/…（整板只读预览；v1 看板以网格布局展示）。
      </>
    );

  const issuedPanel = publicUrl ? <ShareIssuedUrlPanel url={publicUrl} /> : null;

  if (variant === "dialog") {
    return (
      <ShareDialogSection
        className={className}
        icon={Link2}
        title="公开链接"
        description={description}
        notice={<ShareDialogNotice>请仅在受控范围分享；链接 7 天后自动失效，可重新生成。</ShareDialogNotice>}
        trailing={actionButton}
      >
        {issuedPanel}
      </ShareDialogSection>
    );
  }

  return (
    <Card className={cn(SHARE_SECTION_CARD_CLASS, className)}>
      <CardHeader className={SHARE_SECTION_CARD_HEADER_CLASS}>
        <CardTitle className="text-theme-base">公开链接</CardTitle>
      </CardHeader>
      <CardContent className={cn("space-y-3", density === "compact" ? "pt-4" : "pt-6")}>
        <p className="text-theme-sm text-gray-500 dark:text-gray-400">{description}</p>
        <p className="text-theme-xs text-amber-600 dark:text-amber-400">
          请仅在受控范围内分享；链接 7 天后自动失效，可重新生成。
        </p>
        {issuedPanel ?? actionButton}
      </CardContent>
    </Card>
  );
}

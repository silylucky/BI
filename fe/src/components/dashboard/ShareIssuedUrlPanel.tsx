import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ShareIssuedUrlPanelProps = {
  url: string;
  className?: string;
};

/** 已签发链接：全宽展示 + 复制/预览 */
export function ShareIssuedUrlPanel({ url, className }: ShareIssuedUrlPanelProps) {
  const copyUrl = () => {
    void navigator.clipboard.writeText(url);
    toast.success("已复制链接");
  };

  return (
    <div className={cn("space-y-2.5", className)}>
      <p className="w-full min-w-0 break-all rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 font-mono text-theme-xs leading-relaxed text-gray-600 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-400">
        {url}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={copyUrl}>
          <Copy className="size-4" aria-hidden />
          复制链接
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={url} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" aria-hidden />
            预览
          </a>
        </Button>
      </div>
    </div>
  );
}

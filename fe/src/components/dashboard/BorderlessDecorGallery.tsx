import { GalleryThumbFrame } from "@/components/dashboard/GalleryThumbFrame";
import { BORDERLESS_DECOR_ASSETS } from "@/lib/borderlessDecorAssets";
import { cn } from "@/lib/utils";

type BorderlessDecorGalleryProps = {
  value?: string;
  onSelect: (url: string) => void;
  className?: string;
};

const STYLE_LABEL: Record<string, string> = {
  "arc-swoosh": "弧形光带",
  "arc-top": "顶弧",
  "double-arc": "双弧",
  "wave-soft": "柔波",
  "glow-streak": "发光线",
  "bow-deep": "深弓",
  "diamond-flare": "菱形光",
  "dotted-arc": "虚线弧",
  "twin-swoosh": "双轨",
  "particle-trail": "粒子弧",
};

/** 无边框装饰图快选（对标 DataEase 背景 · 图片） */
export function BorderlessDecorGallery({ value, onSelect, className }: BorderlessDecorGalleryProps) {
  return (
    <div className={cn("space-y-2", className)} data-testid="borderless-decor-gallery">
      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
        内置装饰图（透明无边框 · {BORDERLESS_DECOR_ASSETS.length} 款）
      </p>
      <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/80 p-2 dark:border-gray-700 dark:bg-gray-900/40">
        <div className="grid grid-cols-5 gap-1.5">
          {BORDERLESS_DECOR_ASSETS.map((item) => {
            const active = value?.trim() === item.url;
            return (
              <button
                key={item.id}
                type="button"
                title={`${STYLE_LABEL[item.style] ?? item.style} · ${item.palette}`}
                data-testid={`borderless-decor-${item.id}`}
                className={cn(
                  "overflow-hidden rounded border border-gray-200 p-0 dark:border-gray-600",
                  active
                    ? "border-brand-500 ring-2 ring-brand-500/30"
                    : "hover:border-brand-400/60",
                )}
                onClick={() => onSelect(item.url)}
              >
                <GalleryThumbFrame className="h-9">
                  <img
                    src={item.url}
                    alt=""
                    className="h-full w-full object-contain object-center"
                    loading="lazy"
                    draggable={false}
                  />
                </GalleryThumbFrame>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

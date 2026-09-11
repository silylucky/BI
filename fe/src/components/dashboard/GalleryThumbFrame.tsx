import type { ReactNode } from "react";
import { resolvePublicAssetUrl } from "@/lib/appBasePath";
import { cn } from "@/lib/utils";

export const GALLERY_THUMB_BACKDROP_LIGHT = "/template-assets/ui/gallery-thumb-backdrop-light.svg";
export const GALLERY_THUMB_BACKDROP_DARK = "/template-assets/ui/gallery-thumb-backdrop-dark.svg";

type GalleryThumbFrameProps = {
  children: ReactNode;
  className?: string;
};

/** 素材图库缩略图底：柔和渐变图，替代棋盘格 */
export function GalleryThumbFrame({ children, className }: GalleryThumbFrameProps) {
  const light = resolvePublicAssetUrl(GALLERY_THUMB_BACKDROP_LIGHT);
  const dark = resolvePublicAssetUrl(GALLERY_THUMB_BACKDROP_DARK);

  return (
    <div className={cn("relative w-full overflow-hidden", className)}>
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center dark:hidden"
        style={{ backgroundImage: `url("${light}")` }}
      />
      <div
        aria-hidden
        className="absolute inset-0 hidden bg-cover bg-center dark:block"
        style={{ backgroundImage: `url("${dark}")` }}
      />
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}

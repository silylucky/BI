import { useMemo, useState, type ReactNode } from "react";
import { GalleryThumbFrame } from "@/components/dashboard/GalleryThumbFrame";
import {
  filterTemplateAssetsByScope,
  galleryPreviewFallbackUrl,
  galleryPreviewUrl,
  isWideTransparentGalleryCategory,
  listTemplateAssetCategories,
  TEMPLATE_ASSET_CATEGORY_LABELS,
  type TemplateAssetCatalogItem,
  type TemplateAssetGalleryScope,
} from "@/lib/templateAssetCatalog";
import { cn } from "@/lib/utils";

type TemplateAssetImageGalleryProps = {
  value?: string;
  onSelect: (url: string) => void;
  scope?: TemplateAssetGalleryScope;
  highlightUrls?: string[];
  className?: string;
};

function normalizeUrl(url: string) {
  return url.trim();
}

export function TemplateAssetImageGallery({
  value,
  onSelect,
  scope = "all",
  highlightUrls = [],
  className,
}: TemplateAssetImageGalleryProps) {
  const scoped = useMemo(() => filterTemplateAssetsByScope(scope), [scope]);
  const categories = useMemo(() => listTemplateAssetCategories(scoped), [scoped]);
  const [category, setCategory] = useState<string>("all");

  const highlightSet = useMemo(
    () => new Set(highlightUrls.map(normalizeUrl).filter(Boolean)),
    [highlightUrls],
  );

  const highlighted = useMemo(() => {
    if (highlightSet.size === 0) return [];
    return scoped.filter((item) => highlightSet.has(normalizeUrl(item.url)));
  }, [highlightSet, scoped]);

  const visible = useMemo(() => {
    if (category === "all") return scoped;
    return scoped.filter((item) => item.category === category);
  }, [category, scoped]);

  return (
    <div className={cn("space-y-2", className)} data-testid="template-asset-gallery">
      <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
        内置素材（{scoped.length} 张）
      </p>

      {highlighted.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">本看板已用</p>
          <AssetThumbGrid
            items={highlighted}
            activeUrl={value}
            onSelect={onSelect}
            columns={5}
            maxHeightClass="max-h-28"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1" role="tablist" aria-label="素材分类">
        <CategoryChip active={category === "all"} onClick={() => setCategory("all")}>
          全部
        </CategoryChip>
        {categories.map((cat) => (
          <CategoryChip key={cat} active={category === cat} onClick={() => setCategory(cat)}>
            {TEMPLATE_ASSET_CATEGORY_LABELS[cat] ?? cat}
          </CategoryChip>
        ))}
      </div>

      <AssetThumbGrid
        items={visible}
        activeUrl={value}
        onSelect={onSelect}
        columns={5}
        maxHeightClass="max-h-56"
        emptyLabel="暂无该类素材"
      />
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
        active
          ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-500/60 dark:bg-brand-500/15 dark:text-brand-300"
          : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400",
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function GalleryThumb({
  item,
  wideTransparent,
}: {
  item: TemplateAssetCatalogItem;
  wideTransparent: boolean;
}) {
  const primary = galleryPreviewUrl(item);
  const fallback = galleryPreviewFallbackUrl(item);
  return (
    <img
      src={primary}
      alt=""
      className={cn(
        "w-full object-center object-cover",
        wideTransparent ? "h-11" : "h-9",
      )}
      loading="lazy"
      draggable={false}
      onError={(event) => {
        const img = event.currentTarget;
        if (!fallback || img.dataset.fallbackTried === "1") return;
        img.dataset.fallbackTried = "1";
        if (img.src === fallback || img.getAttribute("src") === fallback) return;
        img.src = fallback;
      }}
    />
  );
}

function AssetThumbGrid({
  items,
  activeUrl,
  onSelect,
  columns,
  maxHeightClass,
  emptyLabel,
}: {
  items: TemplateAssetCatalogItem[];
  activeUrl?: string;
  onSelect: (url: string) => void;
  columns: number;
  maxHeightClass: string;
  emptyLabel?: string;
}) {
  if (items.length === 0) {
    return emptyLabel ? (
      <p className="py-2 text-center text-[10px] text-gray-400 dark:text-gray-500">{emptyLabel}</p>
    ) : null;
  }

  return (
    <div
      className={cn(
        "overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/80 p-2 dark:border-gray-700 dark:bg-gray-900/40",
        maxHeightClass,
      )}
    >
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {items.map((item) => {
          const active = normalizeUrl(activeUrl ?? "") === normalizeUrl(item.url);
          const wideTransparent = isWideTransparentGalleryCategory(item.category);
          return (
            <button
              key={`${item.pack}:${item.category}:${item.id}`}
              type="button"
              title={item.label}
              data-testid={`template-asset-${item.id}`}
              className={cn(
                "overflow-hidden rounded border border-gray-200 p-0 dark:border-gray-600",
                active
                  ? "border-brand-500 ring-2 ring-brand-500/30"
                  : "hover:border-brand-400/60",
              )}
              onClick={() => onSelect(item.url)}
            >
              <GalleryThumbFrame className="h-9">
                <GalleryThumb item={item} wideTransparent={wideTransparent} />
              </GalleryThumbFrame>
            </button>
          );
        })}
      </div>
    </div>
  );
}

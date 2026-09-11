import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PaletteInsertType } from "@/components/dashboard/createLayoutWidget";
import {
  SCREEN_MATERIAL_CATEGORIES,
  getScreenMaterialByCategory,
  type ScreenMaterialCatalogItem,
  type ScreenMaterialCategory,
} from "@/lib/screenMaterialCatalog";
import type { ScreenBorderVariant } from "@/lib/screenVisualStyle";
import { ScreenBorderVariantPreview } from "./screenBorderVariants";
import { ScreenIconPreview } from "./ScreenIconDisplay";
import { ScreenShapePreview } from "./ScreenShapeDisplay";

type ScreenMaterialPickerProps = {
  onInsert: (type: PaletteInsertType) => void;
  onInserted?: () => void;
};

function MaterialTile({
  item,
  onInsert,
  onInserted,
}: {
  item: ScreenMaterialCatalogItem;
  onInsert: (type: PaletteInsertType) => void;
  onInserted?: () => void;
}) {
  const preview =
    item.category === "border" ? (
      <ScreenBorderVariantPreview variant={item.payload.preset as ScreenBorderVariant} />
    ) : item.category === "shape" ? (
      <ScreenShapePreview shape={item.payload.preset as "rect" | "triangle" | "circle"} />
    ) : (
      <ScreenIconPreview icon={item.payload.preset} />
    );

  return (
    <button
      type="button"
      onClick={() => {
        onInsert(item.payload);
        onInserted?.();
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center gap-1 rounded-md p-1.5 text-center transition-colors",
        "hover:bg-white/[0.06] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-500/40",
      )}
      data-testid={`screen-material-${item.id}`}
    >
      <div className="w-full">{preview}</div>
      <span className="line-clamp-1 w-full text-[10px] leading-tight text-gray-400">
        {item.label}
      </span>
    </button>
  );
}

export function ScreenMaterialPicker({ onInsert, onInserted }: ScreenMaterialPickerProps) {
  const [category, setCategory] = useState<ScreenMaterialCategory>("border");
  const items = getScreenMaterialByCategory(category);
  const gridCols =
    category === "icon" ? "grid-cols-6" : category === "shape" ? "grid-cols-3" : "grid-cols-3";

  return (
    <div
      className="flex min-h-[280px] w-[min(100vw-2rem,420px)] bg-[#0d1117] text-gray-200"
      data-testid="screen-material-picker"
    >
      <nav className="flex w-20 shrink-0 flex-col gap-1 border-r border-white/10 p-2">
        {SCREEN_MATERIAL_CATEGORIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setCategory(entry.id)}
            className={cn(
              "rounded-md px-2 py-2 text-left text-xs transition-colors",
              category === entry.id
                ? "bg-white/[0.08] font-medium text-cyan-400"
                : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200",
            )}
            data-testid={`screen-material-category-${entry.id}`}
          >
            {entry.label}
          </button>
        ))}
      </nav>
      <div className="min-w-0 flex-1 overflow-y-auto p-2">
        <div className={cn("grid gap-1.5", gridCols)}>
          {items.map((item) => (
            <MaterialTile
              key={item.id}
              item={item}
              onInsert={onInsert}
              onInserted={onInserted}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

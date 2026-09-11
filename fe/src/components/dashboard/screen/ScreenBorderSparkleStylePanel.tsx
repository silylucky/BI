import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeAttrToggleRow } from "@/components/dashboard/dashboardInspectorUi";
import { DeAttrSliderField } from "@/components/dashboard/deAttrSlider";
import { INSPECTOR_NESTED_CARD } from "@/components/dashboard/inspectorCompact";
import {
  BORDER_FLOW_TRAIL_LENGTH_MAX_PX,
  BORDER_FLOW_TRAIL_LENGTH_MIN_PX,
  createScreenBorderSparkle,
  normalizeScreenBorderSparkle,
  type ScreenBorderSparkleConfig,
  type ScreenBorderSparkleStyleConfig,
} from "@/lib/screenBorderSparkle";
import { ScreenColorField } from "./ScreenVisualStylePanels";

type ScreenBorderSparkleStylePanelProps = {
  value?: ScreenBorderSparkleStyleConfig;
  accentFallback: string;
  onChange: (next: ScreenBorderSparkleStyleConfig) => void;
};

function SparkleItemEditor({
  sparkle,
  index,
  accentFallback,
  onChange,
  onRemove,
  canRemove,
}: {
  sparkle: ScreenBorderSparkleConfig;
  index: number;
  accentFallback: string;
  onChange: (next: ScreenBorderSparkleConfig) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const normalized = normalizeScreenBorderSparkle(sparkle);
  const patch = (partial: Partial<ScreenBorderSparkleConfig>) =>
    onChange({ ...normalized, ...partial });

  return (
    <div
      className={INSPECTOR_NESTED_CARD}
      data-testid={`border-sparkle-item-${index}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
          流光 {index + 1}
        </span>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-gray-400 hover:text-error-600"
            onClick={onRemove}
            aria-label={`删除流光 ${index + 1}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="space-y-0">
        <ScreenColorField
          label="流光颜色"
          value={normalized.color || accentFallback}
          onChange={(color) => patch({ color })}
        />
        <DeAttrSliderField
          label="拖影长度"
          compact
          value={normalized.trailLength}
          min={BORDER_FLOW_TRAIL_LENGTH_MIN_PX}
          max={BORDER_FLOW_TRAIL_LENGTH_MAX_PX}
          step={4}
          unit="px"
          ariaLabel="拖影长度"
          onChange={(trailLength) => patch({ trailLength })}
        />
        <DeAttrSliderField
          label="移动速度"
          compact
          value={normalized.speed}
          min={1}
          max={20}
          step={0.5}
          unit="s"
          ariaLabel="移动速度"
          onChange={(speed) => patch({ speed })}
        />
      </div>
    </div>
  );
}

export function ScreenBorderSparkleStylePanel({
  value,
  accentFallback,
  onChange,
}: ScreenBorderSparkleStylePanelProps) {
  const style = {
    enabled: value?.enabled ?? false,
    sparkles: value?.sparkles?.length
      ? value.sparkles
      : [createScreenBorderSparkle({ color: accentFallback })],
  };

  const patch = (partial: Partial<ScreenBorderSparkleStyleConfig>) =>
    onChange({
      enabled: partial.enabled ?? style.enabled,
      sparkles: partial.sparkles ?? style.sparkles,
    });

  const updateSparkle = (index: number, next: ScreenBorderSparkleConfig) => {
    const sparkles = style.sparkles.map((item, i) => (i === index ? next : item));
    patch({ sparkles });
  };

  const removeSparkle = (index: number) => {
    patch({ sparkles: style.sparkles.filter((_, i) => i !== index) });
  };

  const addSparkle = () => {
    patch({
      sparkles: [...style.sparkles, createScreenBorderSparkle({ color: accentFallback })],
    });
  };

  return (
    <>
      <DeAttrToggleRow
        label="边框流光"
        checked={style.enabled}
        onCheckedChange={(enabled) => patch({ enabled })}
        description="沿边框可见线条运动；光斑裁切高亮段（对标 sc-datav）。"
      />
      {style.enabled ? (
        <>
          <div className="space-y-2 py-2">
            {style.sparkles.map((sparkle, index) => (
              <SparkleItemEditor
                key={sparkle.id}
                sparkle={sparkle}
                index={index}
                accentFallback={accentFallback}
                onChange={(next) => updateSparkle(index, next)}
                onRemove={() => removeSparkle(index)}
                canRemove={style.sparkles.length > 1}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full gap-1.5"
            onClick={addSparkle}
            data-testid="border-sparkle-add"
          >
            <Plus className="size-3.5" />
            添加流光
          </Button>
        </>
      ) : null}
    </>
  );
}

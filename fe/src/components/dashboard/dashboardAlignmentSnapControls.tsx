import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { DashboardAlignmentSnapConfig, DashboardChromeConfig } from "./dashboardStyleConfig";
import {
  MAX_COLLISION_OVERLAP_BUFFER_PX,
  MAX_MARK_LINE_THRESHOLD_PX,
  MIN_COLLISION_OVERLAP_BUFFER_PX,
  MIN_MARK_LINE_THRESHOLD_PX,
  resolveDashboardAlignmentSnap,
  resolveDashboardChrome,
} from "./dashboardChromeConfig";
import { DeAttrSubField, DeAttrToggleRow } from "./dashboardInspectorUi";
import { DeAttrSubSliderRow } from "./deAttrSlider";
import {
  INSPECTOR_COLLAPSE_TRIGGER,
  INSPECTOR_SWITCH_SIZE,
  InspectorCollapseChevron,
  InspectorHintTip,
} from "./inspectorCompact";

const HINT_AUXILIARY_GRID =
  "编辑态在画布上显示点阵参考线；下方细项可配置碰撞与组件对齐（仅像素/大屏）。";
const HINT_COLLISION_OVERLAP =
  "拖动过程中，两组件在宽、高方向重叠均超过该像素时才预览推挤邻块；松手后任意重叠都会触发碰撞整理。";
const HINT_MARK_LINE_SNAP =
  "拖拽时显示参考线，并与其他组件的边或中心对齐；与「重合阈值」控制的碰撞推挤无关。";
const HINT_SNAP_TARGETS = "选择要对齐到边线还是中心线。";
const HINT_SNAP_EDGES = "与其他组件的外边框贴齐、对齐。";
const HINT_SNAP_CENTERS = "与其他组件的水平/垂直中心线对齐。";
const HINT_MARK_LINE_THRESHOLD =
  "拖动时组件边/中心与参考线相差在该屏幕像素内即吸附；与「重合阈值」控制的碰撞推挤无关。";

type AlignmentSnapControlsProps = {
  chrome: ReturnType<typeof resolveDashboardChrome>;
  alignment: ReturnType<typeof resolveDashboardAlignmentSnap>;
  alignmentSnapRaw?: DashboardAlignmentSnapConfig;
  isPixelLayout: boolean;
  patchChrome: (patch: Partial<DashboardChromeConfig>) => void;
};

function AuxiliaryGridLabel() {
  return (
    <span className="min-w-0 truncate text-theme-xs text-gray-600 dark:text-gray-300">
      辅助对齐网格
    </span>
  );
}

function AuxiliaryGridHint({ text = HINT_AUXILIARY_GRID }: { text?: string }) {
  return <InspectorHintTip text={text} aria-label="辅助对齐网格说明" className="shrink-0" />;
}

function AlignmentSnapDetails({
  alignment,
  alignmentSnapRaw,
  patchChrome,
}: {
  alignment: ReturnType<typeof resolveDashboardAlignmentSnap>;
  alignmentSnapRaw?: DashboardAlignmentSnapConfig;
  patchChrome: (patch: Partial<DashboardChromeConfig>) => void;
}) {
  const snapConfig = (patch: Partial<DashboardAlignmentSnapConfig>) =>
    patchChrome({
      alignmentSnap: {
        ...alignmentSnapRaw,
        ...patch,
      },
    });

  return (
    <div className="space-y-0 border-t border-gray-100 pt-1 dark:border-white/[0.06]">
      <DeAttrSubSliderRow
        label="重合阈值"
        value={alignment.collisionOverlapBufferPx}
        min={MIN_COLLISION_OVERLAP_BUFFER_PX}
        max={MAX_COLLISION_OVERLAP_BUFFER_PX}
        step={1}
        unit="px"
        ariaLabel="重合阈值"
        hint={HINT_COLLISION_OVERLAP}
        onChange={(collisionOverlapBufferPx) => snapConfig({ collisionOverlapBufferPx })}
      />
      <DeAttrToggleRow
        label="组件对齐吸附"
        checked={alignment.enableMarkLineSnap}
        hint={HINT_MARK_LINE_SNAP}
        onCheckedChange={(checked) => snapConfig({ enableMarkLineSnap: checked })}
      />
      <DeAttrSubSliderRow
        label="吸附灵敏度"
        value={alignment.markLineThresholdPx}
        min={MIN_MARK_LINE_THRESHOLD_PX}
        max={MAX_MARK_LINE_THRESHOLD_PX}
        step={1}
        unit="px"
        ariaLabel="吸附灵敏度"
        hint={HINT_MARK_LINE_THRESHOLD}
        disabled={!alignment.enableMarkLineSnap}
        onChange={(markLineThresholdPx) => snapConfig({ markLineThresholdPx })}
      />
      <DeAttrSubField label="吸附目标" hint={HINT_SNAP_TARGETS}>
        <DeAttrToggleRow
          label="边线（贴边/对齐边）"
          checked={alignment.snapEdges}
          hint={HINT_SNAP_EDGES}
          onCheckedChange={(checked) => snapConfig({ snapEdges: checked })}
        />
        <DeAttrToggleRow
          label="中心线"
          checked={alignment.snapCenters}
          hint={HINT_SNAP_CENTERS}
          onCheckedChange={(checked) => snapConfig({ snapCenters: checked })}
        />
      </DeAttrSubField>
    </div>
  );
}

/** 像素大屏：辅助网格开关 + 可折叠对齐吸附细项 */
export function AlignmentSnapControls({
  chrome,
  alignment,
  alignmentSnapRaw,
  isPixelLayout,
  patchChrome,
}: AlignmentSnapControlsProps) {
  const [open, setOpen] = useState(false);

  if (!isPixelLayout) {
    return (
      <div className="border-b border-gray-100 py-2.5 last:border-b-0 dark:border-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <AuxiliaryGridLabel />
            <AuxiliaryGridHint text="编辑态在画布上显示点阵参考线。" />
          </div>
          <Switch
            checked={chrome.showAuxiliaryGrid}
            onCheckedChange={(checked) => patchChrome({ showAuxiliaryGrid: checked })}
            aria-label="辅助对齐网格"
            size={INSPECTOR_SWITCH_SIZE}
          />
        </div>
      </div>
    );
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-b border-gray-100 last:border-b-0 dark:border-white/[0.06]"
      data-testid="alignment-snap-section"
    >
      <div className="flex items-center gap-1 py-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <CollapsibleTrigger
            className={cn(
              INSPECTOR_COLLAPSE_TRIGGER,
              "flex min-w-0 flex-1 items-center gap-1 rounded-md py-0.5 pr-1 text-left",
              "transition-colors hover:bg-gray-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand-500/30",
              "dark:hover:bg-white/[0.04]",
            )}
            aria-label={open ? "收起对齐吸附设置" : "展开对齐吸附设置"}
          >
            <InspectorCollapseChevron size="md" />
            <AuxiliaryGridLabel />
          </CollapsibleTrigger>
          <AuxiliaryGridHint />
        </div>
        <div
          className="shrink-0 pl-1"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Switch
            checked={chrome.showAuxiliaryGrid}
            onCheckedChange={(checked) => patchChrome({ showAuxiliaryGrid: checked })}
            aria-label="辅助对齐网格"
            size={INSPECTOR_SWITCH_SIZE}
          />
        </div>
      </div>
      <CollapsibleContent data-testid="alignment-snap-controls" className="pb-2 pl-5">
        <AlignmentSnapDetails
          alignment={alignment}
          alignmentSnapRaw={alignmentSnapRaw}
          patchChrome={patchChrome}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

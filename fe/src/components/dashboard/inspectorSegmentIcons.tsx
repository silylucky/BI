import type { ReactNode } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  PanelBottom,
  PanelLeft,
  PanelRight,
  PanelTop,
  StretchVertical,
} from "lucide-react";

export const SEGMENT_ICON_CLASS = "size-3.5 shrink-0";

export type InspectorSegmentOption = {
  value: string;
  label: ReactNode;
  ariaLabel: string;
  disabled?: boolean;
};

/** 文本水平对齐：左 / 中 / 右（对标 DE + RichTextToolbar） */
export const HORIZONTAL_ALIGN_SEGMENT_OPTIONS: InspectorSegmentOption[] = [
  {
    value: "left",
    label: <AlignLeft className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "左对齐",
  },
  {
    value: "center",
    label: <AlignCenter className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "居中对齐",
  },
  {
    value: "right",
    label: <AlignRight className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "右对齐",
  },
];

/** 图例水平对齐（对标 DE 位置 · 左组） */
export const LEGEND_H_ALIGN_SEGMENT_OPTIONS: InspectorSegmentOption[] = [
  {
    value: "left",
    label: <AlignLeft className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "水平居左",
  },
  {
    value: "center",
    label: <AlignCenter className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "水平居中",
  },
  {
    value: "right",
    label: <AlignRight className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "水平居右",
  },
];

/** 图例垂直对齐（对标 DE 位置 · 右组） */
export const LEGEND_V_ALIGN_SEGMENT_OPTIONS: InspectorSegmentOption[] = [
  {
    value: "top",
    label: <PanelTop className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "垂直居上",
  },
  {
    value: "middle",
    label: <StretchVertical className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "垂直居中",
  },
  {
    value: "bottom",
    label: <PanelBottom className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "垂直居下",
  },
];

/** @deprecated 使用 LEGEND_H_ALIGN + LEGEND_V_ALIGN */
export const LEGEND_POSITION_SEGMENT_OPTIONS: InspectorSegmentOption[] = [
  {
    value: "top",
    label: <PanelTop className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "图例在上",
  },
  {
    value: "bottom",
    label: <PanelBottom className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "图例在下",
  },
  {
    value: "left",
    label: <PanelLeft className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "图例在左",
  },
  {
    value: "right",
    label: <PanelRight className={SEGMENT_ICON_CLASS} aria-hidden />,
    ariaLabel: "图例在右",
  },
];

import { useRef } from "react";
import {
  DASHBOARD_CONFIG_RAIL_CONTENT_CLASS,
  DASHBOARD_EDIT_RAIL_SCROLL_CLASS,
  DASHBOARD_EDIT_RAIL_SCROLL_CLIP_CLASS,
} from "./dashboardEditRailLayout";
import {
  DashboardStyleSections,
  DashboardWidgetStyleSections,
} from "./dashboardConfigPanels";
import { LinkageRulesPanel } from "./LinkageRulesPanel";
import { DashboardConfigSection } from "./DashboardConfigSection";
import type { Linkage } from "./dashboardFilterUtils";
import type { DashboardStyleConfig, LayoutWidget } from "./layoutUtils";
import {
  applyDashboardStylePatch,
  resetDashboardColorsToActiveThemeBundle,
  switchDashboardThemeBundle,
} from "./dashboardThemeVariants";

export type DashboardStylePatch =
  | Partial<DashboardStyleConfig>
  | ((prev: DashboardStyleConfig) => Partial<DashboardStyleConfig>);

type DashboardContextInspectorProps = {
  widgetCount: number;
  widgets: LayoutWidget[];
  styleConfig: DashboardStyleConfig;
  onStyleChange: (value: DashboardStyleConfig) => void;
  onWidgetsChange?: (widgets: LayoutWidget[]) => void;
  embedded?: boolean;
  isPixelLayout?: boolean;
  dashboardId?: string;
  linkage?: Linkage | null;
  effectiveLinkage?: Linkage | null;
  onLinkageChange?: (linkage: Linkage) => void;
};

/** DataEase 对标：画布空白时右侧「仪表板配置」手风琴（§5 样式分组顺序） */
export function DashboardContextInspector({
  widgetCount,
  widgets,
  styleConfig,
  onStyleChange,
  onWidgetsChange,
  embedded = false,
  isPixelLayout = false,
  dashboardId,
  linkage,
  effectiveLinkage,
  onLinkageChange,
}: DashboardContextInspectorProps) {
  const styleConfigRef = useRef(styleConfig);
  styleConfigRef.current = styleConfig;
  const widgetsRef = useRef(widgets);
  widgetsRef.current = widgets;

  const patchStyle = (patch: DashboardStylePatch) => {
    const resolved =
      typeof patch === "function" ? patch(styleConfigRef.current) : patch;
    const bundle = applyDashboardStylePatch(
      styleConfigRef.current,
      widgetsRef.current,
      resolved,
    );
    onStyleChange(bundle.styleConfig);
    onWidgetsChange?.(bundle.widgets);
  };

  const sections = (
    <>
      <DashboardStyleSections
        styleConfig={styleConfig}
        patchStyle={patchStyle}
        isPixelLayout={isPixelLayout}
        onSwitchColorScheme={(scheme) => {
          const bundle = switchDashboardThemeBundle(styleConfig, widgets, scheme);
          onStyleChange(bundle.styleConfig);
          onWidgetsChange?.(bundle.widgets);
        }}
        onResetColorsToTheme={() => {
          const bundle = resetDashboardColorsToActiveThemeBundle(styleConfig, widgets);
          onStyleChange(bundle.styleConfig);
          onWidgetsChange?.(bundle.widgets);
        }}
      />
      <DashboardWidgetStyleSections
        styleConfig={styleConfig}
        patchStyle={patchStyle}
        isPixelLayout={isPixelLayout}
      />
      {dashboardId && onLinkageChange && (effectiveLinkage ?? linkage)?.filters?.length ? (
        <DashboardConfigSection
          title="筛选联动"
          defaultOpen
          data-testid="dashboard-linkage-section"
        >
          <LinkageRulesPanel
            embedded
            draftMode
            dashboardId={dashboardId}
            linkage={linkage ?? null}
            effectiveLinkage={effectiveLinkage}
            widgets={widgets}
            onLinkageChange={onLinkageChange}
          />
        </DashboardConfigSection>
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div className={DASHBOARD_CONFIG_RAIL_CONTENT_CLASS} data-testid="dashboard-config-inspector">
        {sections}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 h-full w-full flex-col" data-testid="dashboard-config-inspector">
      <div className="shrink-0 border-b border-gray-100 px-4 py-3 dark:border-white/[0.06]">
        <div className={DASHBOARD_CONFIG_RAIL_CONTENT_CLASS}>
          <p className="text-theme-sm font-semibold text-gray-800 dark:text-white/90">仪表板配置</p>
          <p className="mt-0.5 text-theme-xs text-gray-500 dark:text-gray-400">
            {widgetCount > 0 ? `${widgetCount} 个组件` : "点击画布空白处编辑看板样式"}
          </p>
        </div>
      </div>
      <div className={DASHBOARD_EDIT_RAIL_SCROLL_CLIP_CLASS}>
        <div className={DASHBOARD_EDIT_RAIL_SCROLL_CLASS}>
          <div className={DASHBOARD_CONFIG_RAIL_CONTENT_CLASS}>{sections}</div>
        </div>
      </div>
    </div>
  );
}

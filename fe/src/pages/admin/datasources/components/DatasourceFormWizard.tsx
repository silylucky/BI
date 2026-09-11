import { ArrowLeft } from "lucide-react";
import { ConnectorCategoryCard } from "@/components/datasources/ConnectorCategoryCard";
import { Button } from "@/components/ui/button";
import {
  connectorTypeIcon,
  DISPLAY_GROUP_META,
  type ConnectorTypeItem,
  type DisplayGroup,
} from "@/lib/connector-taxonomy";
import { CONNECTOR_FIELD_HINTS, connectorPickerSubtitle } from "./datasource-form-constants";
import type { DatasourceWizardStep } from "./DatasourceWizardStepper";

type Props = {
  wizardStep: DatasourceWizardStep;
  selectedGroup: DisplayGroup | null;
  visibleGroups: DisplayGroup[];
  groupedTypes: Map<DisplayGroup, ConnectorTypeItem[]>;
  onSelectGroup: (group: DisplayGroup) => void;
  onBackToCategory: () => void;
  onSelectType: (type: string, port: string) => void;
};

export function DatasourceFormWizard({
  wizardStep,
  selectedGroup,
  visibleGroups,
  groupedTypes,
  onSelectGroup,
  onBackToCategory,
  onSelectType,
}: Props) {
  if (wizardStep === "category") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-theme-base font-semibold text-gray-900 dark:text-white">选择数据源大类</h2>
          <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">
            按引擎类型分组，先选大类再选具体连接器。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visibleGroups.map((group) => {
            const items = groupedTypes.get(group) ?? [];
            const meta = DISPLAY_GROUP_META[group];
            const Icon = connectorTypeIcon(items[0]?.type ?? group, group);
            return (
              <ConnectorCategoryCard
                key={group}
                variant="category"
                label={items[0]?.categoryLabel ?? meta.label}
                description={meta.description}
                count={items.length}
                icon={Icon}
                onSelect={() => onSelectGroup(group)}
              />
            );
          })}
        </div>
      </div>
    );
  }

  if (wizardStep === "type" && selectedGroup) {
    const groupMeta = DISPLAY_GROUP_META[selectedGroup];
    const groupLabel =
      groupedTypes.get(selectedGroup)?.[0]?.categoryLabel ?? groupMeta.label;

    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-theme-base font-semibold text-gray-900 dark:text-white">
              选择 {groupLabel} 连接器
            </h2>
            <p className="mt-1 text-theme-sm text-gray-500 dark:text-gray-400">{groupMeta.description}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onBackToCategory}>
            <ArrowLeft className="size-4" aria-hidden />
            返回大类
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(groupedTypes.get(selectedGroup) ?? []).map((t) => {
            const Icon = connectorTypeIcon(t.type, t.displayGroup);
            return (
              <ConnectorCategoryCard
                key={t.type}
                variant="type"
                label={t.displayName}
                subtitle={connectorPickerSubtitle(t.type, t.displayGroup, {
                  queryCapable: t.queryCapable,
                  syncFetchImplemented: t.syncFetchImplemented,
                })}
                typeId={t.type}
                icon={Icon}
                onSelect={() => {
                  const hints = CONNECTOR_FIELD_HINTS[t.type];
                  onSelectType(t.type, hints?.port ?? "3306");
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

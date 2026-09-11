import { resolveCustomVizStylePropertyLabel } from "./customVizManifestLabels";

export type StyleProperty = {
  type?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  step?: number;
  title?: string;
  description?: string;
  enum?: string[];
  enumNames?: string[];
  /** 单字段分组标题；可被 x-styleSections 覆盖 */
  "x-section"?: string;
};

export type StyleSectionDef = {
  title: string;
  propertyKeys: string[];
};

export function readStyleSchemaProperties(
  styleSchema: Record<string, unknown> | undefined,
): Record<string, StyleProperty> {
  const props = styleSchema?.properties;
  if (!props || typeof props !== "object") return {};
  return props as Record<string, StyleProperty>;
}

function inferPropertySchema(key: string, val: unknown): StyleProperty {
  const title = resolveCustomVizStylePropertyLabel(key);
  if (typeof val === "boolean") return { type: "boolean", title };
  if (typeof val === "number") return { type: "number", title };
  if (typeof val === "string" && /^#/.test(val)) {
    return { type: "string", format: "color", title };
  }
  return { type: "string", title };
}

/** manifest 未写 styleSchema 时，从 defaultStyle 键推断最小可编辑 schema。 */
export function inferStyleSchemaFromDefault(
  defaultStyle: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!defaultStyle || Object.keys(defaultStyle).length === 0) return undefined;
  const properties: Record<string, StyleProperty> = {};
  for (const [key, val] of Object.entries(defaultStyle)) {
    properties[key] = inferPropertySchema(key, val);
  }
  return { type: "object", properties };
}

export function resolveCustomVizStyleSchema(
  styleSchema: Record<string, unknown> | undefined,
  defaultStyle: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const explicit = readStyleSchemaProperties(styleSchema);
  if (Object.keys(explicit).length > 0) return styleSchema;
  return inferStyleSchemaFromDefault(defaultStyle);
}

export function mergeCustomVizStyleValue(
  layoutStyle: Record<string, unknown> | undefined,
  defaultStyle: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return { ...(defaultStyle ?? {}), ...(layoutStyle ?? {}) };
}

/** 将 styleSchema 属性拆成折叠区块；支持 x-styleSections 与 x-section。 */
export function groupCustomVizStyleProperties(
  styleSchema: Record<string, unknown> | undefined,
): StyleSectionDef[] {
  const properties = readStyleSchemaProperties(styleSchema);
  const keys = Object.keys(properties);
  if (keys.length === 0) return [];

  const rawSections = styleSchema?.["x-styleSections"];
  if (Array.isArray(rawSections) && rawSections.length > 0) {
    const used = new Set<string>();
    const sections: StyleSectionDef[] = [];
    for (const item of rawSections) {
      if (!item || typeof item !== "object") continue;
      const title =
        typeof (item as { title?: string }).title === "string"
          ? (item as { title: string }).title.trim()
          : "组件样式";
      const props = (item as { properties?: unknown }).properties;
      if (!Array.isArray(props)) continue;
      const propertyKeys = props.filter(
        (k): k is string => typeof k === "string" && Object.hasOwn(properties, k),
      );
      propertyKeys.forEach((k) => used.add(k));
      if (propertyKeys.length > 0) sections.push({ title, propertyKeys });
    }
    const rest = keys.filter((k) => !used.has(k));
    if (rest.length > 0) sections.push({ title: "其他", propertyKeys: rest });
    return sections.length > 0 ? sections : [{ title: "组件样式", propertyKeys: keys }];
  }

  const bySection = new Map<string, string[]>();
  for (const key of keys) {
    const sectionTitle = properties[key]?.["x-section"]?.trim() || "组件样式";
    const list = bySection.get(sectionTitle) ?? [];
    list.push(key);
    bySection.set(sectionTitle, list);
  }
  if (bySection.size <= 1) {
    return [{ title: bySection.keys().next().value ?? "组件样式", propertyKeys: keys }];
  }
  return [...bySection.entries()].map(([title, propertyKeys]) => ({ title, propertyKeys }));
}
